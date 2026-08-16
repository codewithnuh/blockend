import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { IdempotencyHandler } from "../core/idempotency-handler";
import type { IdempotencyCache } from "../interfaces/cache";
import type { CreateRecordResult, CachedResponse, IdempotencyRecord } from "../types";
import type { DeleteExpiredParams, FindAllFilters, IdempotencyStore } from "../interfaces/store";
import { idempotent } from "./fastify";
import type { FastifyIdempotencyOptions } from "./fastify";

// ---------------------------------------------------------------------------
// In-memory IdempotencyStore / IdempotencyCache (test doubles)
// ---------------------------------------------------------------------------

class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly retryCounts = new Map<string, number>();

  private id(key: string, operation: string, userId: string): string {
    return `${operation}:${userId}:${key}`;
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
    return [...this.records.values()]
      .filter((record) => {
        if (filters.status && record.status !== filters.status) return false;
        if (filters.updatedBefore && record.updatedAt > filters.updatedBefore) {
          return false;
        }
        return true;
      })
      .slice(0, filters.limit);
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

  async incrementRetryCount(key: string, operation: string, userId: string): Promise<number> {
    const id = this.id(key, operation, userId);
    const next = (this.retryCounts.get(id) ?? 0) + 1;
    this.retryCounts.set(id, next);
    return next;
  }

  async delete(key: string, operation: string, userId: string): Promise<void> {
    this.records.delete(this.id(key, operation, userId));
  }

  async deleteExpired({ expiredBefore, statuses, limit }: DeleteExpiredParams): Promise<number> {
    let deleted = 0;

    for (const [id, record] of this.records) {
      if (deleted >= (limit ?? Number.POSITIVE_INFINITY)) {
        break;
      }

      if (record.expiresAt < expiredBefore && (statuses as string[]).includes(record.status)) {
        this.records.delete(id);
        deleted++;
      }
    }

    return deleted;
  }

  /** Test helper: seed a record directly (bypasses the create path). */
  seed(record: IdempotencyRecord): void {
    this.records.set(this.id(record.key, record.operation, record.userId), {
      ...record
    });
  }

  /** Test helper: wipe all state. */
  clear(): void {
    this.records.clear();
    this.retryCounts.clear();
  }
}

function makeRecord(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  return {
    key: "key-1",
    userId: "user-1",
    operation: "pay",
    requestHash: "request-hash",
    status: "SUCCESS",
    response: { id: 42 },
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
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
// App builders
// ---------------------------------------------------------------------------

type Payload = { received: { amount: number }; executions: number };

function createWrapperApp(
  handler: IdempotencyHandler,
  options: FastifyIdempotencyOptions = {},
  executeImpl?: () => Promise<unknown>
): { app: FastifyInstance; executions: () => number } {
  let executions = 0;

  const app = Fastify({ logger: false });
  app.post(
    "/pay",
    idempotent(
      handler,
      async (request): Promise<Payload> => {
        executions++;
        if (executeImpl) {
          await executeImpl();
        }
        return { received: request.body as { amount: number }, executions };
      },
      options
    )
  );

  return { app, executions: () => executions };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Fastify adapter (integration, real server via inject)", () => {
  it("executes once and replays the stored response for a duplicate request", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app, executions } = createWrapperApp(handler);

    const first = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(first.statusCode).toBe(200);
    expect(executions()).toBe(1);

    const replay = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(executions()).toBe(1);
  });

  it("rejects reusing a key with a different payload as 409", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app } = createWrapperApp(handler);

    await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    const conflict = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 200 }
    });

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("KEY_REUSED_WITH_DIFFERENT_REQUEST");
  });

  it("rejects a concurrent duplicate with 409 REQUEST_IN_PROGRESS", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reached = false;

    const { app } = createWrapperApp(handler, {}, async () => {
      reached = true;
      await gate;
    });

    // Fire request A without awaiting it; it blocks inside the business logic.
    const first = app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    await vi.waitFor(() => expect(reached).toBe(true));

    // Request B arrives while A holds the PROCESSING lock.
    const second = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe("REQUEST_IN_PROGRESS");

    release();
    const firstResponse = await first;
    expect(firstResponse.statusCode).toBe(200);
  });

  it("requires a key when requireKey is set", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app } = createWrapperApp(handler, { requireKey: true });

    const missing = await app.inject({
      method: "POST",
      url: "/pay",
      payload: { amount: 100 }
    });

    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.code).toBe("KEY_REQUIRED");
  });

  it("runs the route unprotected when no key is present and none is required", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app, executions } = createWrapperApp(handler);

    const passthrough = await app.inject({
      method: "POST",
      url: "/pay",
      payload: { amount: 100 }
    });

    expect(passthrough.statusCode).toBe(200);
    expect(executions()).toBe(1);
  });

  it("marks a failed execution FAILED and blocks later retries with 409 REQUEST_FAILED", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    let shouldFail = true;

    const { app } = createWrapperApp(handler, {}, async () => {
      if (shouldFail) {
        throw new Error("business logic exploded");
      }
    });

    const failed = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(failed.statusCode).toBe(500);

    // Even if the logic would now succeed, the key is poisoned.
    shouldFail = false;
    const retry = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(retry.statusCode).toBe(409);
    expect(retry.json().error.code).toBe("REQUEST_FAILED");
  });

  it("maps store unavailability to 503", async () => {
    const store = new InMemoryIdempotencyStore();
    store.create = async (): Promise<CreateRecordResult> => {
      throw new Error("database connection lost");
    };

    const handler = new IdempotencyHandler(store);
    const { app } = createWrapperApp(handler);

    const response = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("STORE_UNAVAILABLE");
  });
});

describe("Fastify adapter (integration) - failure modes & resilience", () => {
  it("releases the lock on a transient failure so the client can retry", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    let shouldFail = true;

    const { app, executions } = createWrapperApp(
      handler,
      { isPermanentError: () => false },
      async () => {
        if (shouldFail) {
          throw new Error("transient network blip");
        }
      }
    );

    const failed = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(failed.statusCode).toBe(500);
    expect(executions()).toBe(1);

    // The transient failure released the lock (record deleted), so the SAME
    // key re-executes instead of being blocked.
    shouldFail = false;
    const retried = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(retried.statusCode).toBe(200);
    expect(executions()).toBe(2);
  });

  it("poisons the key after MAX_ALLOWED_RETRIES transient failures", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    let shouldFail = true;

    const { app, executions } = createWrapperApp(
      handler,
      { isPermanentError: () => false },
      async () => {
        if (shouldFail) {
          throw new Error("flaky");
        }
      }
    );

    // 3 transient failures: the first two release the lock, the third marks
    // the record FAILED (MAX_ALLOWED_RETRIES exhausted).
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/pay",
        headers: { "idempotency-key": "key-1" },
        payload: { amount: 100 }
      });
      expect(res.statusCode).toBe(500);
    }
    expect(executions()).toBe(3);

    shouldFail = false;
    const blocked = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe("REQUEST_FAILED");
  });

  it("isolates keys per user and per operation", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const counts = new Map<string, number>();

    const app = Fastify({ logger: false });
    app.post(
      "/:operation",
      idempotent(
        handler,
        async (request) => {
          const operation = (request.params as { operation: string }).operation;
          const user = (request.headers["x-user-id"] as string | undefined) ?? "anon";
          const id = `${operation}:${user}`;
          const count = (counts.get(id) ?? 0) + 1;
          counts.set(id, count);
          return { operation, user, count };
        },
        {
          getUserId: (request) => (request.headers["x-user-id"] as string | undefined) ?? "anon",
          getOperation: (request) => (request.params as { operation: string }).operation
        }
      )
    );

    const alicePay = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1", "x-user-id": "alice" },
      payload: { amount: 100 }
    });
    expect(alicePay.statusCode).toBe(200);
    expect(alicePay.json()).toEqual({
      operation: "pay",
      user: "alice",
      count: 1
    });

    // Same key, user and operation -> replay, not a re-execution.
    const alicePayReplay = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1", "x-user-id": "alice" },
      payload: { amount: 100 }
    });
    expect(alicePayReplay.json()).toEqual({
      operation: "pay",
      user: "alice",
      count: 1
    });

    // Same key, different user -> independent execution.
    const bobPay = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1", "x-user-id": "bob" },
      payload: { amount: 100 }
    });
    expect(bobPay.statusCode).toBe(200);
    expect(bobPay.json()).toEqual({ operation: "pay", user: "bob", count: 1 });

    // Same key + user, different operation -> independent execution.
    const aliceRefund = await app.inject({
      method: "POST",
      url: "/refund",
      headers: { "idempotency-key": "key-1", "x-user-id": "alice" },
      payload: { amount: 100 }
    });
    expect(aliceRefund.statusCode).toBe(200);
    expect(aliceRefund.json()).toEqual({
      operation: "refund",
      user: "alice",
      count: 1
    });
  });

  it("hashes only the configured body slice via getBody", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app } = createWrapperApp(handler, {
      getBody: (request) => (request.body as { amount?: number }).amount
    });

    const first = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100, note: "a" }
    });
    expect(first.statusCode).toBe(200);

    // A changed field that is NOT part of the hash does not conflict.
    const ignored = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100, note: "b" }
    });
    expect(ignored.statusCode).toBe(200);
    expect(ignored.json()).toEqual(first.json());

    // A change to the hashed field DOES conflict.
    const conflict = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 200, note: "c" }
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("KEY_REUSED_WITH_DIFFERENT_REQUEST");
  });

  it("serves a replay from the L1 cache even if the store is empty", async () => {
    const store = new InMemoryIdempotencyStore();
    const cache = new InMemoryCache();
    const handler = new IdempotencyHandler(store, cache);
    let executions = 0;

    const app = Fastify({ logger: false });
    app.post(
      "/pay",
      idempotent(handler, async (request) => {
        executions++;
        return { received: request.body, executions };
      })
    );

    const first = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });
    expect(first.statusCode).toBe(200);
    expect(executions).toBe(1);

    // Wipe the store: the cache alone must still serve the replay.
    store.clear();

    const replay = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(executions).toBe(1);
  });

  it("recoverStuckRecords frees stale PROCESSING locks so keys fail fast", async () => {
    const store = new InMemoryIdempotencyStore();
    const handler = new IdempotencyHandler(store);

    // A request that crashed mid-execution left a stale PROCESSING lock.
    store.seed(
      makeRecord({
        userId: "anonymous",
        operation: "POST:/pay",
        requestHash: handler.hashRequest({ amount: 100 }),
        status: "PROCESSING",
        updatedAt: new Date(Date.now() - 10 * 60 * 1000)
      })
    );

    const result = await handler.recoverStuckRecords();
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });

    // The key is now poisoned: a retry fails fast with 409 instead of hanging
    // or double-executing.
    const { app } = createWrapperApp(handler);
    const retry = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });
    expect(retry.statusCode).toBe(409);
    expect(retry.json().error.code).toBe("REQUEST_FAILED");
  });

  it("cleanupExpiredRecords purges expired keys so they can be reused", async () => {
    const store = new InMemoryIdempotencyStore();
    const handler = new IdempotencyHandler(store);

    store.seed(
      makeRecord({
        userId: "anonymous",
        operation: "POST:/pay",
        requestHash: handler.hashRequest({ amount: 100 }),
        status: "SUCCESS",
        expiresAt: new Date(Date.now() - 60_000)
      })
    );

    // Sanity: before cleanup, the key replays the stored (expired) response.
    const { app: blockedApp } = createWrapperApp(handler);
    const blocked = await blockedApp.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });
    expect(blocked.statusCode).toBe(200);

    const cleaned = await handler.cleanupExpiredRecords();
    expect(cleaned.deleted).toBe(1);

    // The key is freed: a new request executes fresh instead of being blocked.
    const { app, executions } = createWrapperApp(handler);
    const fresh = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });
    expect(fresh.statusCode).toBe(200);
    expect(executions()).toBe(1);
  });

  it("captures reply.send-style routes end-to-end and replays the stored payload", async () => {
    const store = new InMemoryIdempotencyStore();
    const handler = new IdempotencyHandler(store);
    let executions = 0;

    const app = Fastify({ logger: false });
    app.post(
      "/pay",
      idempotent(handler, async (_request, reply) => {
        executions++;
        reply.send({ ok: true, executions });
      })
    );

    const first = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ ok: true, executions: 1 });

    const replay = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });
    expect(replay.statusCode).toBe(200);
    // The stored payload is replayed — executions did not increment.
    expect(replay.json()).toEqual({ ok: true, executions: 1 });
    expect(executions).toBe(1);
  });

  it("rejects an unserializable payload with 400 UNSUPPORTED_REQUEST_VALUE", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app } = createWrapperApp(handler, {
      getBody: () => Number.NaN
    });

    const response = await app.inject({
      method: "POST",
      url: "/pay",
      headers: { "idempotency-key": "key-1" },
      payload: { amount: 100 }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("UNSUPPORTED_REQUEST_VALUE");
  });
});
