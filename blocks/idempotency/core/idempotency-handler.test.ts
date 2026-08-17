import { describe, expect, it, vi } from "vitest";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyHandler } from "./idempotency-handler";
import type { IdempotencyCache } from "../interfaces/cache";
import type { Logger, Metrics } from "../interfaces/observability";
import type { IdempotencyStore } from "../interfaces/store";
import type { IdempotencyRecord } from "../types/index";

/**
 * Security & robustness tests for the handler orchestration. These complement
 * core.test.ts by exercising the fail-closed paths and invariants that matter
 * under attack or infrastructure degradation.
 */

function createStore() {
  return {
    create:
      vi.fn<
        (...args: Parameters<IdempotencyStore["create"]>) => ReturnType<IdempotencyStore["create"]>
      >(),
    find: vi.fn<
      (...args: Parameters<IdempotencyStore["find"]>) => ReturnType<IdempotencyStore["find"]>
    >(),
    findAll:
      vi.fn<
        (
          ...args: Parameters<IdempotencyStore["findAll"]>
        ) => ReturnType<IdempotencyStore["findAll"]>
      >(),
    delete:
      vi.fn<
        (...args: Parameters<IdempotencyStore["delete"]>) => ReturnType<IdempotencyStore["delete"]>
      >(),
    markSuccess:
      vi.fn<
        (
          ...args: Parameters<IdempotencyStore["markSuccess"]>
        ) => ReturnType<IdempotencyStore["markSuccess"]>
      >(),
    markProcessing:
      vi.fn<
        (
          ...args: Parameters<IdempotencyStore["markProcessing"]>
        ) => ReturnType<IdempotencyStore["markProcessing"]>
      >(),
    incrementRetryCount:
      vi.fn<
        (
          ...args: Parameters<IdempotencyStore["incrementRetryCount"]>
        ) => ReturnType<IdempotencyStore["incrementRetryCount"]>
      >(),
    markFailed:
      vi.fn<
        (
          ...args: Parameters<IdempotencyStore["markFailed"]>
        ) => ReturnType<IdempotencyStore["markFailed"]>
      >(),
    deleteExpired:
      vi.fn<
        (
          ...args: Parameters<IdempotencyStore["deleteExpired"]>
        ) => ReturnType<IdempotencyStore["deleteExpired"]>
      >()
  };
}

function createCache() {
  return {
    get: vi.fn<
      (...args: Parameters<IdempotencyCache["get"]>) => ReturnType<IdempotencyCache["get"]>
    >(),
    set: vi.fn<
      (...args: Parameters<IdempotencyCache["set"]>) => ReturnType<IdempotencyCache["set"]>
    >(),
    delete:
      vi.fn<
        (...args: Parameters<IdempotencyCache["delete"]>) => ReturnType<IdempotencyCache["delete"]>
      >()
  };
}

type MockStore = ReturnType<typeof createStore>;
type MockCache = ReturnType<typeof createCache>;

function setup(
  store: MockStore = createStore(),
  cache: MockCache = createCache(),
  options: { logger?: Logger; metrics?: Metrics } = {}
) {
  const handler = new IdempotencyHandler(store, cache, options);

  return { handler, store, cache };
}

function makeRecord(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  return {
    key: "key-1",
    userId: "user-1",
    operation: "pay",
    requestHash: "hash",
    status: "SUCCESS",
    response: { id: 42 },
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

const USER_ID = "user-1";
const OPERATION = "pay";
const KEY = "key-1";
const BODY = { amount: 100 };

function primeMiss(store: MockStore, cache: MockCache): void {
  cache.get.mockResolvedValue({ status: "MISS" });
  store.create.mockResolvedValue({ status: "CREATED" });
}

describe("IdempotencyHandler - fail-closed & security paths", () => {
  it("fails CLOSED when the isPermanentError classifier itself throws", async () => {
    // A buggy classifier must not swallow the real error or leave the record
    // dangling: the record is marked FAILED and the ORIGINAL error rethrown.
    const { handler, store, cache } = setup();
    primeMiss(store, cache);
    const boom = new Error("upstream timeout");

    await expect(
      handler.execute(
        USER_ID,
        OPERATION,
        KEY,
        BODY,
        async () => {
          throw boom;
        },
        {
          isPermanentError: () => {
            throw new Error("classifier broken");
          }
        }
      )
    ).rejects.toBe(boom);

    expect(store.markFailed).toHaveBeenCalledWith(KEY, OPERATION, USER_ID);
  });

  it("emits the latency histogram even when key validation rejects", async () => {
    const metrics: Metrics = {
      increment: vi.fn(),
      histogram: vi.fn()
    };
    const { handler } = setup(createStore(), createCache(), { metrics });

    await expect(handler.execute(USER_ID, OPERATION, " ", BODY, vi.fn())).rejects.toMatchObject({
      code: IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED
    });

    expect(metrics.histogram).toHaveBeenCalledWith(
      "idempotency_latency_seconds",
      expect.any(Number),
      { operation: OPERATION }
    );
  });

  it("emits the latency histogram even when hashing rejects", async () => {
    const metrics: Metrics = {
      increment: vi.fn(),
      histogram: vi.fn()
    };
    const { handler } = setup(createStore(), createCache(), { metrics });

    await expect(
      handler.execute(USER_ID, OPERATION, KEY, { bad: undefined }, vi.fn())
    ).rejects.toMatchObject({
      code: IDEMPOTENCY_ERROR_CODES.UNSUPPORTED_REQUEST_VALUE
    });

    expect(metrics.histogram).toHaveBeenCalledWith(
      "idempotency_latency_seconds",
      expect.any(Number),
      { operation: OPERATION }
    );
  });

  it("treats a record with a missing request_hash as a key-reuse mismatch (never a silent hit)", async () => {
    const { handler, store, cache } = setup();
    cache.get.mockResolvedValue({ status: "MISS" });
    store.create.mockResolvedValue({ status: "DUPLICATE" });
    // Malformed/legacy record without a request_hash — must NOT replay.
    store.find.mockResolvedValue(
      makeRecord({ status: "SUCCESS", requestHash: undefined as never })
    );

    await expect(handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn())).rejects.toMatchObject({
      code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST
    });
  });

  it("surfaces STORE_UNAVAILABLE when marking SUCCESS fails (result was executed but not persisted)", async () => {
    const { handler, store, cache } = setup();
    primeMiss(store, cache);
    store.markSuccess.mockRejectedValue(new Error("db connection lost"));

    await expect(
      handler.execute(USER_ID, OPERATION, KEY, BODY, async () => "done")
    ).rejects.toMatchObject({
      code: IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE
    });
  });

  it("surfaces STORE_UNAVAILABLE when the store throws a non-idempotency error on create", async () => {
    const { handler, store, cache } = setup();
    cache.get.mockResolvedValue({ status: "MISS" });
    store.create.mockRejectedValue(new Error("connection pool exhausted"));

    await expect(handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn())).rejects.toMatchObject({
      code: IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE
    });
  });
});

describe("IdempotencyHandler - transient failure retry accounting", () => {
  it("increments the retry count and releases the lock while retries remain", async () => {
    const { handler, store, cache } = setup();
    primeMiss(store, cache);
    store.incrementRetryCount.mockResolvedValue(1);

    await expect(
      handler.execute(
        USER_ID,
        OPERATION,
        KEY,
        BODY,
        async () => {
          throw new Error("transient");
        },
        { isPermanentError: () => false }
      )
    ).rejects.toThrow("transient");

    expect(store.incrementRetryCount).toHaveBeenCalledWith(KEY, OPERATION, USER_ID);
    // Lock released so the client can retry immediately.
    expect(store.delete).toHaveBeenCalledWith(KEY, OPERATION, USER_ID);
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it("marks the record FAILED once retries are exhausted", async () => {
    const { handler, store, cache } = setup();
    primeMiss(store, cache);
    // MAX_ALLOWED_RETRIES = 3 — the third failure poisons the key.
    store.incrementRetryCount.mockResolvedValue(3);

    await expect(
      handler.execute(
        USER_ID,
        OPERATION,
        KEY,
        BODY,
        async () => {
          throw new Error("flaky");
        },
        { isPermanentError: () => false }
      )
    ).rejects.toThrow("flaky");

    expect(store.markFailed).toHaveBeenCalledWith(KEY, OPERATION, USER_ID);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("rethrows a non-Error rejection unchanged", async () => {
    const { handler, store, cache } = setup();
    primeMiss(store, cache);

    await expect(
      handler.execute(USER_ID, OPERATION, KEY, BODY, async () => {
        throw "string-boom";
      })
    ).rejects.toBe("string-boom");
    expect(store.markFailed).toHaveBeenCalled();
  });
});

describe("IdempotencyHandler - retry()", () => {
  it("re-opens a FAILED record without touching an in-flight one", async () => {
    const { handler, store } = setup();
    store.find.mockResolvedValueOnce(makeRecord({ status: "FAILED" }));
    store.find.mockResolvedValueOnce(makeRecord({ status: "PROCESSING" }));

    await handler.retry(USER_ID, OPERATION, KEY);
    expect(store.markProcessing).toHaveBeenCalledWith(KEY, OPERATION, USER_ID);

    store.markProcessing.mockClear();
    await expect(handler.retry(USER_ID, OPERATION, KEY)).rejects.toMatchObject({
      code: IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS
    });
  });

  it("returns null when no record exists", async () => {
    const { handler, store } = setup();
    store.find.mockResolvedValue(null);

    expect(await handler.retry(USER_ID, OPERATION, KEY)).toBeNull();
  });
});

describe("IdempotencyHandler - multi-tenant isolation at the store boundary", () => {
  it("never collides records across users: same key + same body is scoped per user", async () => {
    const { handler, store, cache } = setup();
    cache.get.mockResolvedValue({ status: "MISS" });
    store.create.mockResolvedValue({ status: "CREATED" });

    await handler.execute("alice", OPERATION, KEY, BODY, async () => "a");
    await handler.execute("bob", OPERATION, KEY, BODY, async () => "b");

    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({ key: KEY, userId: "alice" })
    );
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ key: KEY, userId: "bob" }));
    // Two distinct PROCESSING locks — one per tenant.
    expect(store.create).toHaveBeenCalledTimes(2);
  });
});
