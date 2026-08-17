import { describe, expect, it, vi } from "vitest";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import type { IdempotencyCache } from "../interfaces/cache";
import type { Logger, Metrics } from "../interfaces/observability";
import { CacheManager } from "./cache-manager";

function createLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createMetrics(): Metrics {
  return { increment: vi.fn(), histogram: vi.fn() };
}
function createCache(overrides: Partial<IdempotencyCache> = {}) {
  const get = vi.fn<
    (...args: Parameters<IdempotencyCache["get"]>) => ReturnType<IdempotencyCache["get"]>
  >(async () => ({ status: "MISS" }));
  const set = vi.fn<
    (...args: Parameters<IdempotencyCache["set"]>) => ReturnType<IdempotencyCache["set"]>
  >(async () => {});
  const del = vi.fn<
    (...args: Parameters<IdempotencyCache["delete"]>) => ReturnType<IdempotencyCache["delete"]>
  >(async () => {});

  return {
    cache: { get, set, delete: del, ...overrides },
    get,
    set,
    delete: del
  };
}

describe("CacheManager - key isolation (cross-scope collision)", () => {
  it("produces distinct cache keys for scopes that collide under a naive join", async () => {
    // Under the old `idem:<op>:<user>:<key>` format, scope (userId="a",
    // operation="pay", key="b:c") and scope (userId="a:b", operation="pay",
    // key="c") BOTH encode to "idem:pay:a:b:c" — a cross-tenant cache
    // collision. The length-prefixed encoding must separate them.
    const { cache, get } = createCache();
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    await manager.getCachedResponse("a", "pay", "b:c", "hash-1");
    await manager.getCachedResponse("a:b", "pay", "c", "hash-1");

    const keys = get.mock.calls.map((call) => call[0]);
    expect(keys[0]).toBe("idem:v1:1:a:3:pay:3:b:c");
    expect(keys[1]).toBe("idem:v1:3:a:b:3:pay:1:c");
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("calls the cache with unambiguous length-prefixed keys", async () => {
    const { cache, get } = createCache();
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    await manager.getCachedResponse("user-1", "pay", "key-1", "h");
    expect(get).toHaveBeenCalledWith("idem:v1:6:user-1:3:pay:5:key-1");
  });
});

describe("CacheManager.getCachedResponse", () => {
  it("returns null when no cache is configured", async () => {
    const manager = new CacheManager(undefined, createLogger(), createMetrics());

    expect(await manager.getCachedResponse("u", "op", "k", "h")).toBeNull();
  });

  it("returns the payload on a well-formed HIT with a matching hash", async () => {
    const { cache, get } = createCache();
    get.mockResolvedValue({
      status: "HIT",
      data: { status: "SUCCESS", request_hash: "abc", response: { ok: true } }
    });
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    const result = await manager.getCachedResponse("u", "op", "k", "abc");

    expect(result).toEqual({
      status: "HIT",
      data: { status: "SUCCESS", request_hash: "abc", response: { ok: true } }
    });
  });

  it("treats a HIT with a FAILED status as invalid: fall back + invalidate", async () => {
    const { cache, get, delete: del } = createCache();
    get.mockResolvedValue({
      status: "HIT",
      data: { status: "FAILED", request_hash: "abc", response: {} }
    });
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    const result = await manager.getCachedResponse("u", "op", "k", "abc");

    expect(result).toBeNull();
    expect(del).toHaveBeenCalledWith("idem:v1:1:u:2:op:1:k");
  });

  it("treats a HIT with a missing request_hash as invalid: fall back + invalidate", async () => {
    const { cache, get, delete: del } = createCache();
    get.mockResolvedValue({
      status: "HIT",
      data: { status: "SUCCESS", response: {} }
    } as never);
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    expect(await manager.getCachedResponse("u", "op", "k", "abc")).toBeNull();
    expect(del).toHaveBeenCalled();
  });

  it("throws KEY_REUSED_WITH_DIFFERENT_REQUEST on a hash mismatch", async () => {
    const { cache, get } = createCache();
    get.mockResolvedValue({
      status: "HIT",
      data: { status: "SUCCESS", request_hash: "abc", response: {} }
    });
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    await expect(manager.getCachedResponse("u", "op", "k", "different")).rejects.toMatchObject({
      code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST
    });
  });

  it("swallows underlying cache failures and falls back to the store", async () => {
    const { cache, get } = createCache();
    get.mockRejectedValue(new Error("redis connection refused"));
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    expect(await manager.getCachedResponse("u", "op", "k", "h")).toBeNull();
  });

  it("treats UNAVAILABLE as a miss", async () => {
    const { cache, get } = createCache();
    get.mockResolvedValue({ status: "UNAVAILABLE" });
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    expect(await manager.getCachedResponse("u", "op", "k", "h")).toBeNull();
  });
});

describe("CacheManager.setCachedResponse", () => {
  it("is a no-op without a cache", async () => {
    const manager = new CacheManager(undefined, createLogger(), createMetrics());

    await expect(
      manager.setCachedResponse("u", "op", "k", "h", { ok: true })
    ).resolves.toBeUndefined();
  });

  it("stores the response under the length-prefixed key with the default TTL", async () => {
    const { cache, set } = createCache();
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    await manager.setCachedResponse("u", "op", "k", "h", { ok: true });

    expect(set).toHaveBeenCalledWith(
      "idem:v1:1:u:2:op:1:k",
      { status: "SUCCESS", request_hash: "h", response: { ok: true } },
      86_400_000
    );
  });

  it("swallows cache write failures (database remains the source of truth)", async () => {
    const { cache, set } = createCache();
    set.mockRejectedValue(new Error("redis down"));
    const manager = new CacheManager(cache, createLogger(), createMetrics());

    await expect(
      manager.setCachedResponse("u", "op", "k", "h", { ok: true })
    ).resolves.toBeUndefined();
  });
});
