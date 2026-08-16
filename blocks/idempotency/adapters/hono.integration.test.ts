import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { IdempotencyHandler } from "../core/idempotency-handler";
import type { IdempotencyCache } from "../interfaces/cache";
import type { CreateRecordResult, CachedResponse, IdempotencyRecord } from "../types";
import type { DeleteExpiredParams, FindAllFilters, IdempotencyStore } from "../interfaces/store";
import { getIdempotencyContext, idempotencyMiddleware, idempotent } from "./hono";
import type { HonoIdempotencyOptions } from "./hono";

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
  options: HonoIdempotencyOptions = {},
  executeImpl?: () => Promise<unknown>
): { app: Hono; executions: () => number } {
  let executions = 0;

  const app = new Hono();
  app.post(
    "/pay",
    idempotent(
      handler,
      async (c): Promise<Payload> => {
        executions++;
        if (executeImpl) {
          await executeImpl();
        }
        return { received: (await c.req.json()) as { amount: number }, executions };
      },
      options
    )
  );

  return { app, executions: () => executions };
}

function createCaptureApp(
  handler: IdempotencyHandler,
  options: HonoIdempotencyOptions = {},
  executeImpl?: () => Promise<unknown>
): { app: Hono; executions: () => number } {
  let executions = 0;

  const app = new Hono();
  app.post("/pay", idempotencyMiddleware(handler, options), async (c) => {
    executions++;
    if (executeImpl) {
      await executeImpl();
    }
    return c.json({ received: await c.req.json(), executions });
  });

  return { app, executions: () => executions };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Hono adapter (integration, wrapper style)", () => {
  it("executes once and replays the stored response for a duplicate request", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app, executions } = createWrapperApp(handler);

    const first = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(first.status).toBe(200);
    expect(executions()).toBe(1);

    const replay = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(executions()).toBe(1);
  });

  it("rejects reusing a key with a different payload as 409", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app } = createWrapperApp(handler);

    await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    const conflict = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 200 })
    });

    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe("KEY_REUSED_WITH_DIFFERENT_REQUEST");
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
    const first = app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    await vi.waitFor(() => expect(reached).toBe(true));

    // Request B arrives while A holds the PROCESSING lock.
    const second = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("REQUEST_IN_PROGRESS");

    release();
    const firstResponse = await first;
    expect(firstResponse.status).toBe(200);
  });

  it("requires a key when requireKey is set", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app } = createWrapperApp(handler, { requireKey: true });

    const missing = await app.request("/pay", {
      method: "POST",
      body: JSON.stringify({ amount: 100 })
    });

    expect(missing.status).toBe(400);
    expect((await missing.json()).error.code).toBe("KEY_REQUIRED");
  });

  it("runs the route unprotected when no key is present and none is required", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app, executions } = createWrapperApp(handler);

    const passthrough = await app.request("/pay", {
      method: "POST",
      body: JSON.stringify({ amount: 100 })
    });

    expect(passthrough.status).toBe(200);
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

    const failed = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(failed.status).toBe(500);

    // Even if the logic would now succeed, the key is poisoned.
    shouldFail = false;
    const retry = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(retry.status).toBe(409);
    expect((await retry.json()).error.code).toBe("REQUEST_FAILED");
  });

  it("maps store unavailability to 503", async () => {
    const store = new InMemoryIdempotencyStore();
    store.create = async (): Promise<CreateRecordResult> => {
      throw new Error("database connection lost");
    };

    const handler = new IdempotencyHandler(store);
    const { app } = createWrapperApp(handler);

    const response = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("STORE_UNAVAILABLE");
  });
});

describe("Hono adapter (integration) - failure modes & resilience", () => {
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

    const failed = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(failed.status).toBe(500);
    expect(executions()).toBe(1);

    shouldFail = false;
    const retried = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(retried.status).toBe(200);
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

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/pay", {
        method: "POST",
        headers: { "idempotency-key": "key-1" },
        body: JSON.stringify({ amount: 100 })
      });
      expect(res.status).toBe(500);
    }
    expect(executions()).toBe(3);

    shouldFail = false;
    const blocked = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.code).toBe("REQUEST_FAILED");
  });

  it("isolates keys per user and per operation", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const counts = new Map<string, number>();

    const app = new Hono();
    app.post(
      "/:operation",
      idempotent(
        handler,
        async (c) => {
          const operation = c.req.param("operation");
          const user = c.req.header("x-user-id") ?? "anon";
          const id = `${operation}:${user}`;
          const count = (counts.get(id) ?? 0) + 1;
          counts.set(id, count);
          return { operation, user, count };
        },
        {
          getUserId: (c) => c.req.header("x-user-id") ?? "anon",
          getOperation: (c) => c.req.param("operation") ?? "unknown"
        }
      )
    );

    const alicePay = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1", "x-user-id": "alice" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(alicePay.status).toBe(200);
    expect(await alicePay.json()).toEqual({
      operation: "pay",
      user: "alice",
      count: 1
    });

    // Same key, user and operation -> replay.
    const alicePayReplay = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1", "x-user-id": "alice" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(await alicePayReplay.json()).toEqual({
      operation: "pay",
      user: "alice",
      count: 1
    });

    // Same key, different user -> independent execution.
    const bobPay = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1", "x-user-id": "bob" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(bobPay.status).toBe(200);
    expect(await bobPay.json()).toEqual({ operation: "pay", user: "bob", count: 1 });

    // Same key + user, different operation -> independent execution.
    const aliceRefund = await app.request("/refund", {
      method: "POST",
      headers: { "idempotency-key": "key-1", "x-user-id": "alice" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(aliceRefund.status).toBe(200);
    expect(await aliceRefund.json()).toEqual({
      operation: "refund",
      user: "alice",
      count: 1
    });
  });

  it("hashes only the configured body slice via getBody", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app } = createWrapperApp(handler, {
      getBody: async (c) => ((await c.req.raw.clone().json()) as { amount?: number }).amount
    });

    const first = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100, note: "a" })
    });
    expect(first.status).toBe(200);

    // A changed field that is NOT part of the hash does not conflict.
    const ignored = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100, note: "b" })
    });
    expect(ignored.status).toBe(200);
    expect(await ignored.json()).toEqual(await first.json());

    // A change to the hashed field DOES conflict.
    const conflict = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 200, note: "c" })
    });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe("KEY_REUSED_WITH_DIFFERENT_REQUEST");
  });

  it("serves a replay from the L1 cache even if the store is empty", async () => {
    const store = new InMemoryIdempotencyStore();
    const cache = new InMemoryCache();
    const handler = new IdempotencyHandler(store, cache);
    let executions = 0;

    const app = new Hono();
    app.post(
      "/pay",
      idempotent(handler, async (c) => {
        executions++;
        return { received: await c.req.json(), executions };
      })
    );

    const first = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(first.status).toBe(200);
    expect(executions).toBe(1);

    // Wipe the store: the cache alone must still serve the replay.
    store.clear();

    const replay = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(executions).toBe(1);
  });

  it("recoverStuckRecords frees stale PROCESSING locks so keys fail fast", async () => {
    const store = new InMemoryIdempotencyStore();
    const handler = new IdempotencyHandler(store);

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

    const { app } = createWrapperApp(handler);
    const retry = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(retry.status).toBe(409);
    expect((await retry.json()).error.code).toBe("REQUEST_FAILED");
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

    const { app: blockedApp } = createWrapperApp(handler);
    const blocked = await blockedApp.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(blocked.status).toBe(200);

    const cleaned = await handler.cleanupExpiredRecords();
    expect(cleaned.deleted).toBe(1);

    const { app, executions } = createWrapperApp(handler);
    const fresh = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });
    expect(fresh.status).toBe(200);
    expect(executions()).toBe(1);
  });

  it("rejects an unserializable payload with 400 UNSUPPORTED_REQUEST_VALUE", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app } = createWrapperApp(handler, {
      getBody: () => Number.NaN
    });

    const response = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_REQUEST_VALUE");
  });

  it("exposes the idempotency context to the route mid-flight", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const app = new Hono();
    app.post(
      "/pay",
      idempotent(handler, async (c) => ({
        ctx: getIdempotencyContext(c)
      }))
    );

    const res = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    const body = (await res.json()) as {
      ctx: { key: string; operation: string; outcome: string };
    };
    expect(body.ctx).toMatchObject({
      key: "key-1",
      userId: "anonymous",
      operation: "POST:/pay",
      outcome: "processing"
    });
  });
});

describe("Hono adapter (integration) - capture middleware style", () => {
  it("captures the downstream c.json payload and replays it", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    const { app, executions } = createCaptureApp(handler);

    const first = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      received: { amount: 100 },
      executions: 1
    });
    expect(executions()).toBe(1);

    const replay = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({
      received: { amount: 100 },
      executions: 1
    });
    expect(executions()).toBe(1);
  });

  it("marks the record FAILED when the route throws, and blocks the retry", async () => {
    const handler = new IdempotencyHandler(new InMemoryIdempotencyStore());
    let shouldFail = true;

    const app = new Hono();
    app.post("/pay", idempotencyMiddleware(handler), async (c) => {
      if (shouldFail) {
        throw new Error("route exploded");
      }
      return c.json({ ok: true });
    });
    // Hono error handler: 500 with the message.
    app.onError((err, c) => c.json({ error: err.message }, 500));

    const failed = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toBe("route exploded");

    // The error body must NOT be recorded as a success — the record is FAILED.
    shouldFail = false;
    const retry = await app.request("/pay", {
      method: "POST",
      headers: { "idempotency-key": "key-1" },
      body: JSON.stringify({ amount: 100 })
    });

    expect(retry.status).toBe(409);
    expect((await retry.json()).error.code).toBe("REQUEST_FAILED");
  });
});
