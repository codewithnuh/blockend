import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { Express, Request, Response } from "express";
import request from "supertest";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import { IdempotencyHandler } from "../core/idempotency-handler";
import type { IdempotencyCache } from "../interfaces/cache";
import type { CreateRecordResult, CachedResponse, IdempotencyRecord } from "../types";
import type { DeleteExpiredParams, FindAllFilters, IdempotencyStore } from "../interfaces/store";
import { idempotent } from "./express";

// ---------------------------------------------------------------------------
// Compact in-memory doubles (same semantics as express.integration.test.ts)
// ---------------------------------------------------------------------------

class InMemoryStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  // NOTE: real stores scope by SEPARATE columns (e.g. Prisma
  // @@unique([operation, user_id, key])). A naive string join would reproduce
  // the very collision bug this test suite guards against, so the map key is
  // encoded unambiguously with JSON.stringify.
  private id(key: string, operation: string, userId: string): string {
    return JSON.stringify([operation, userId, key]);
  }

  async create(record: IdempotencyRecord): Promise<CreateRecordResult> {
    const id = this.id(record.key, record.operation, record.userId);

    if (this.records.has(id)) {
      return { status: "DUPLICATE" };
    }

    this.records.set(id, { ...record });
    return { status: "CREATED" };
  }

  async find(key: string, operation: string, userId: string): Promise<IdempotencyRecord | null> {
    return this.records.get(this.id(key, operation, userId)) ?? null;
  }

  async findAll(filters: FindAllFilters = {}): Promise<IdempotencyRecord[]> {
    return [...this.records.values()].filter((record) => {
      if (filters.status && record.status !== filters.status) return false;
      if (filters.updatedBefore && record.updatedAt > filters.updatedBefore) {
        return false;
      }
      return true;
    });
  }

  async markSuccess(
    key: string,
    response: unknown,
    userId: string,
    operation: string
  ): Promise<void> {
    const record = this.records.get(this.id(key, operation, userId));
    if (record) {
      record.status = "SUCCESS";
      record.response = response;
      record.updatedAt = new Date();
    }
  }

  async markProcessing(key: string, operation: string, userId: string): Promise<void> {
    const record = this.records.get(this.id(key, operation, userId));
    if (record) {
      record.status = "PROCESSING";
      record.updatedAt = new Date();
    }
  }

  async markFailed(key: string, operation: string, userId: string): Promise<void> {
    const record = this.records.get(this.id(key, operation, userId));
    if (record) {
      record.status = "FAILED";
      record.updatedAt = new Date();
    }
  }

  async incrementRetryCount(_key: string, _operation: string, _userId: string): Promise<number> {
    return 1;
  }

  async delete(key: string, operation: string, userId: string): Promise<void> {
    this.records.delete(this.id(key, operation, userId));
  }

  async deleteExpired(_: DeleteExpiredParams): Promise<number> {
    return 0;
  }
}

class InMemoryCache implements IdempotencyCache {
  private readonly entries = new Map<string, { value: CachedResponse; expiresAt: number }>();

  async get(key: string): Promise<{ status: "MISS" } | { status: "HIT"; data: CachedResponse }> {
    const entry = this.entries.get(key);

    if (!entry || entry.expiresAt < Date.now()) {
      return { status: "MISS" };
    }

    return { status: "HIT", data: entry.value };
  }

  async set(key: string, value: CachedResponse, ttl: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + ttl });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

// ---------------------------------------------------------------------------
// App builder: per-user scoping via the x-user-id header (attacker-controlled)
// ---------------------------------------------------------------------------

type ScopedApp = {
  app: Express;
  executions: () => number;
};

function createScopedApp(handler: IdempotencyHandler): ScopedApp {
  let executions = 0;

  const app = express();
  app.use(express.json());
  app.post(
    "/pay",
    idempotent(
      handler,
      async (req) => {
        executions++;
        const user = req.headers["x-user-id"] as string;
        return { user, executions };
      },
      {
        getUserId: (req) => req.headers["x-user-id"] as string | undefined,
        getOperation: () => "POST:/pay"
      }
    )
  );

  return { app, executions: () => executions };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Express adapter - cache-key collision security (integration)", () => {
  it("never lets one tenant read another tenant's cached response via a colliding key", async () => {
    // Under a naive `idem:<op>:<user>:<key>` cache key, tenant (user="a",
    // key="b:c") and tenant (user="a:b", key="c") map to the SAME cache key.
    // The user id comes from an attacker-controllable header here, making the
    // collision exploitable. With length-prefixed keys the scopes stay apart.
    const store = new InMemoryStore();
    const cache = new InMemoryCache();
    const handler = new IdempotencyHandler(store, cache);
    const { app, executions } = createScopedApp(handler);

    const first = await request(app)
      .post("/pay")
      .set("x-user-id", "a")
      .set("Idempotency-Key", "b:c")
      .send({ amount: 100 });

    expect(first.status).toBe(200);
    expect(first.body).toEqual({ user: "a", executions: 1 });

    // Same colliding cache key under the old format, same payload hash — if
    // the cache keyed by scope, this would replay tenant "a"'s response.
    const second = await request(app)
      .post("/pay")
      .set("x-user-id", "a:b")
      .set("Idempotency-Key", "c")
      .send({ amount: 100 });

    expect(second.status).toBe(200);
    // The response carries tenant "a:b"'s OWN identity — tenant "a"'s stored
    // payload was NOT replayed. (executions is a global counter, so it is 2.)
    expect(second.body).toEqual({ user: "a:b", executions: 2 });
    expect(executions()).toBe(2);
  });

  it("executes independently for different users even with identical key + payload", async () => {
    const handler = new IdempotencyHandler(new InMemoryStore(), new InMemoryCache());
    const { app, executions } = createScopedApp(handler);

    const alice = await request(app)
      .post("/pay")
      .set("x-user-id", "alice")
      .set("Idempotency-Key", "key-1")
      .send({ amount: 100 });
    expect(alice.body).toEqual({ user: "alice", executions: 1 });

    // Bob presents the SAME key and SAME payload — the user scope must make
    // this an independent execution, not a replay of Alice's response. The
    // global executions counter increments (bob really ran) and — crucially —
    // the response carries BOB's identity, never Alice's stored payload.
    const bob = await request(app)
      .post("/pay")
      .set("x-user-id", "bob")
      .set("Idempotency-Key", "key-1")
      .send({ amount: 100 });

    expect(bob.status).toBe(200);
    expect(bob.body).toEqual({ user: "bob", executions: 2 });
    expect(executions()).toBe(2);

    // And Alice's own replay still returns HER stored response.
    const aliceReplay = await request(app)
      .post("/pay")
      .set("x-user-id", "alice")
      .set("Idempotency-Key", "key-1")
      .send({ amount: 100 });
    expect(aliceReplay.body).toEqual({ user: "alice", executions: 1 });
    expect(executions()).toBe(2);
  });
});

describe("Express adapter - response already sent (double-send guard)", () => {
  it("does not attempt a second send when the route responded before the idempotency layer failed", async () => {
    // The route (running inside execute) sends a response and THEN the
    // idempotency layer rejects. Without the headersSent guard the adapter
    // would call sendIdempotencyError and crash with "headers already sent".
    const execute = vi
      .fn<Parameters<IdempotencyHandler["execute"]>, ReturnType<IdempotencyHandler["execute"]>>()
      .mockImplementation(async (_u, _o, _k, _b, run) => {
        await run();
        throw new IdempotencyError(
          IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS,
          "concurrent request"
        );
      });
    const handler = { execute } as unknown as IdempotencyHandler;

    const app = express();
    app.use(express.json());
    app.post(
      "/pay",
      idempotent(handler, async (_req, res) => {
        res.json({ sent: true });
      })
    );
    app.use((err: unknown, _req: Request, res: Response, _next: unknown) => {
      res.status(500).json({ error: String(err) });
    });

    const response = await request(app)
      .post("/pay")
      .set("Idempotency-Key", "key-1")
      .send({ amount: 100 });

    // The route's response is what the client sees — exactly one send.
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sent: true });
  });
});

describe("Express adapter - missing key behavior", () => {
  it("rejects missing keys with 400 when requireKey is set (no unprotected execution)", async () => {
    const handler = new IdempotencyHandler(new InMemoryStore());

    const strictApp = express();
    strictApp.use(express.json());
    strictApp.post(
      "/pay",
      idempotent(handler, async () => ({ ok: true }), {
        requireKey: true,
        getUserId: (req) => req.headers["x-user-id"] as string | undefined,
        getOperation: () => "POST:/pay"
      })
    );

    const missing = await request(strictApp)
      .post("/pay")
      .set("x-user-id", "alice")
      .send({ amount: 100 });

    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe(IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED);
  });
});
