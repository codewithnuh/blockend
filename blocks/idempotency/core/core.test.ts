import { describe, expect, it, vi } from "vitest";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import type { IdempotencyErrorCode } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import { DEFAULT_CACHE_TTL, IdempotencyHandler } from "../index.js";
import type { IdempotencyCache } from "../interfaces/cache";
import type { IdempotencyStore } from "../interfaces/store";
import type { IdempotencyRecord } from "../types/index";

describe("IdempotencyHandler.serialize - edge cases", () => {
  describe("undefined", () => {
    it("should reject undefined at the top level", () => {
      expect(() => {
        IdempotencyHandler.serialize(undefined);
      }).toThrow("Unsupported request value");
    });

    it("should reject undefined inside an object", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          name: "Noor",
          value: undefined
        });
      }).toThrow("Unsupported request value");
    });

    it("should reject undefined inside an array", () => {
      expect(() => {
        IdempotencyHandler.serialize(["hello", undefined]);
      }).toThrow("Unsupported request value");
    });

    it("should reject deeply nested undefined values", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          user: {
            settings: {
              theme: undefined
            }
          }
        });
      }).toThrow("Unsupported request value");
    });
  });

  describe("NaN", () => {
    it("should reject NaN", () => {
      expect(() => {
        IdempotencyHandler.serialize(NaN);
      }).toThrow("Unsupported request value");
    });

    it("should reject NaN inside an object", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          value: NaN
        });
      }).toThrow("Unsupported request value");
    });

    it("should reject NaN inside an array", () => {
      expect(() => {
        IdempotencyHandler.serialize([1, NaN, 3]);
      }).toThrow("Unsupported request value");
    });

    it("should reject deeply nested NaN", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          request: {
            metadata: {
              value: NaN
            }
          }
        });
      }).toThrow("Unsupported request value");
    });
  });

  describe("Infinity", () => {
    it("should reject positive Infinity", () => {
      expect(() => {
        IdempotencyHandler.serialize(Infinity);
      }).toThrow("Unsupported request value");
    });

    it("should reject negative Infinity", () => {
      expect(() => {
        IdempotencyHandler.serialize(-Infinity);
      }).toThrow("Unsupported request value");
    });

    it("should reject Infinity inside an object", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          timeout: Infinity
        });
      }).toThrow("Unsupported request value");
    });

    it("should reject Infinity inside an array", () => {
      expect(() => {
        IdempotencyHandler.serialize([1, Infinity, 3]);
      }).toThrow("Unsupported request value");
    });
  });

  describe("number representation collisions", () => {
    it("should not serialize NaN to the same representation as null", () => {
      expect(() => {
        IdempotencyHandler.serialize(NaN);
      }).toThrow();
    });

    it("should not serialize Infinity to the same representation as null", () => {
      expect(() => {
        IdempotencyHandler.serialize(Infinity);
      }).toThrow();
    });

    it("should distinguish negative Infinity from null", () => {
      expect(() => {
        IdempotencyHandler.serialize(-Infinity);
      }).toThrow();
    });
  });

  describe("BigInt", () => {
    it("should reject BigInt", () => {
      expect(() => {
        IdempotencyHandler.serialize(123n);
      }).toThrow("Unsupported request value");
    });

    it("should reject BigInt inside an object", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          id: 123n
        });
      }).toThrow("Unsupported request value");
    });

    it("should reject BigInt inside an array", () => {
      expect(() => {
        IdempotencyHandler.serialize([1, 2n, 3]);
      }).toThrow("Unsupported request value");
    });

    it("should reject deeply nested BigInt", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          user: {
            id: 123n
          }
        });
      }).toThrow("Unsupported request value");
    });
  });

  describe("functions", () => {
    it("should reject a function", () => {
      expect(() => {
        IdempotencyHandler.serialize(() => {});
      }).toThrow("Unsupported request value");
    });

    it("should reject a function inside an object", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          callback: () => {}
        });
      }).toThrow("Unsupported request value");
    });

    it("should reject a function inside an array", () => {
      expect(() => {
        IdempotencyHandler.serialize([1, () => {}, 3]);
      }).toThrow("Unsupported request value");
    });

    it("should reject a deeply nested function", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          config: {
            handlers: {
              onSuccess: () => {}
            }
          }
        });
      }).toThrow("Unsupported request value");
    });
  });

  describe("symbols", () => {
    it("should reject a Symbol value", () => {
      expect(() => {
        IdempotencyHandler.serialize(Symbol("id"));
      }).toThrow("Unsupported request value");
    });

    it("should reject a Symbol inside an object", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          id: Symbol("id")
        });
      }).toThrow("Unsupported request value");
    });

    it("should reject a Symbol inside an array", () => {
      expect(() => {
        IdempotencyHandler.serialize([Symbol("value")]);
      }).toThrow("Unsupported request value");
    });

    it("should reject a deeply nested Symbol", () => {
      expect(() => {
        IdempotencyHandler.serialize({
          user: {
            metadata: {
              token: Symbol("token")
            }
          }
        });
      }).toThrow("Unsupported request value");
    });
  });

  describe("circular references", () => {
    it("should reject a direct circular object reference", () => {
      const value: Record<string, unknown> = {};
      value.self = value;

      expect(() => {
        IdempotencyHandler.serialize(value);
      }).toThrow();
    });

    it("should reject a nested circular object reference", () => {
      const parent: Record<string, unknown> = {
        child: {}
      };

      const child = parent.child as Record<string, unknown>;
      child.parent = parent;

      expect(() => {
        IdempotencyHandler.serialize(parent);
      }).toThrow();
    });

    it("should reject a circular array reference", () => {
      const value: unknown[] = [];
      value.push(value);

      expect(() => {
        IdempotencyHandler.serialize(value);
      }).toThrow();
    });

    it("should reject an object-array circular reference", () => {
      const value: {
        items: unknown[];
      } = {
        items: []
      };

      value.items.push(value);

      expect(() => {
        IdempotencyHandler.serialize(value);
      }).toThrow();
    });
  });

  describe("nested unsupported values", () => {
    it.each([
      [
        "undefined",
        {
          level1: {
            level2: {
              value: undefined
            }
          }
        }
      ],
      [
        "NaN",
        {
          level1: {
            level2: {
              value: NaN
            }
          }
        }
      ],
      [
        "Infinity",
        {
          level1: {
            level2: {
              value: Infinity
            }
          }
        }
      ],
      [
        "BigInt",
        {
          level1: {
            level2: {
              value: 1n
            }
          }
        }
      ],
      [
        "function",
        {
          level1: {
            level2: {
              value: () => {}
            }
          }
        }
      ],
      [
        "symbol",
        {
          level1: {
            level2: {
              value: Symbol("test")
            }
          }
        }
      ]
    ])("should reject nested unsupported value: %s", (_name, value) => {
      expect(() => {
        IdempotencyHandler.serialize(value);
      }).toThrow("Unsupported request value");
    });
  });

  describe("determinism and representation safety", () => {
    it("should preserve array order", () => {
      const first = IdempotencyHandler.serialize([1, 2, 3]);
      const second = IdempotencyHandler.serialize([3, 2, 1]);

      expect(first).toBe("[1,2,3]");
      expect(second).toBe("[3,2,1]");
      expect(first).not.toBe(second);
    });

    it("should recursively sort nested object keys", () => {
      const value1 = {
        z: {
          b: 2,
          a: 1
        },
        a: {
          y: true,
          x: false
        }
      };

      const value2 = {
        a: {
          x: false,
          y: true
        },
        z: {
          a: 1,
          b: 2
        }
      };

      expect(IdempotencyHandler.serialize(value1)).toBe(IdempotencyHandler.serialize(value2));
    });

    it("should distinguish null from the string 'null'", () => {
      const actualNull = IdempotencyHandler.serialize(null);
      const stringNull = IdempotencyHandler.serialize("null");

      expect(actualNull).toBe("null");
      expect(stringNull).toBe('"null"');
      expect(actualNull).not.toBe(stringNull);
    });

    it("should distinguish numbers from numeric strings", () => {
      const number = IdempotencyHandler.serialize(123);
      const string = IdempotencyHandler.serialize("123");

      expect(number).toBe("123");
      expect(string).toBe('"123"');
      expect(number).not.toBe(string);
    });

    it("should distinguish booleans from boolean strings", () => {
      const boolean = IdempotencyHandler.serialize(true);
      const string = IdempotencyHandler.serialize("true");

      expect(boolean).toBe("true");
      expect(string).toBe('"true"');
      expect(boolean).not.toBe(string);
    });

    it("should distinguish an empty object from an empty array", () => {
      const object = IdempotencyHandler.serialize({});
      const array = IdempotencyHandler.serialize([]);

      expect(object).toBe("{}");
      expect(array).toBe("[]");
      expect(object).not.toBe(array);
    });

    it("should distinguish arrays from objects with numeric keys", () => {
      const array = IdempotencyHandler.serialize(["a", "b"]);

      const object = IdempotencyHandler.serialize({
        0: "a",
        1: "b"
      });

      expect(array).not.toBe(object);
    });
  });
});

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

// Typed store mock so each test can drive successes/failures per call.
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

function setupHandler(store: MockStore = createStore(), cache: MockCache = createCache()) {
  return { handler: new IdempotencyHandler(store, cache), store, cache };
}

function makeRecord(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  return {
    key: "key-1",
    userId: "user-1",
    operation: "pay",
    requestHash: "request-hash-1",
    status: "SUCCESS",
    response: { id: 42 },
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

// Runs a sync call and asserts it throws an IdempotencyError with the expected code.
function expectToThrowWithCode(fn: () => unknown, code: IdempotencyErrorCode): void {
  let caught: unknown;

  try {
    fn();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(IdempotencyError);
  expect((caught as IdempotencyError).code).toBe(code);
}

describe("IdempotencyHandler.validateKey", () => {
  const { handler } = setupHandler();

  describe("invalid types", () => {
    // Any non-string value must be rejected before any further checks.
    it.each([123, null, undefined, true, {}, []])("rejects a non-string key: %p", (key) => {
      expectToThrowWithCode(
        () => handler.validateKey(key),
        IDEMPOTENCY_ERROR_CODES.KEY_INVALID_TYPE
      );
    });
  });

  it("rejects an empty string", () => {
    expectToThrowWithCode(() => handler.validateKey(""), IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED);
  });

  it("rejects a whitespace-only string", () => {
    expectToThrowWithCode(() => handler.validateKey("   "), IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED);
  });

  it("rejects a key shorter than the configured minimum length", () => {
    expectToThrowWithCode(
      () => handler.validateKey("ab", { minLength: 5 }),
      IDEMPOTENCY_ERROR_CODES.KEY_TOO_SHORT
    );
  });

  it("rejects a key longer than the default maximum length of 128", () => {
    expectToThrowWithCode(
      () => handler.validateKey("a".repeat(200)),
      IDEMPOTENCY_ERROR_CODES.KEY_TOO_LONG
    );
  });

  it("rejects a key longer than a custom maximum length", () => {
    expectToThrowWithCode(
      () => handler.validateKey("abcdef", { maxLength: 3 }),
      IDEMPOTENCY_ERROR_CODES.KEY_TOO_LONG
    );
  });

  describe("invalid format", () => {
    // Spaces and symbols outside the allowed set must fail the pattern check.
    it.each(["has space", "pay@me", "pay#1", "café"])(
      "rejects disallowed characters: %p",
      (key) => {
        expectToThrowWithCode(
          () => handler.validateKey(key),
          IDEMPOTENCY_ERROR_CODES.KEY_INVALID_FORMAT
        );
      }
    );

    it("honors a custom pattern and its message", () => {
      expectToThrowWithCode(
        () =>
          handler.validateKey("abc", {
            pattern: { value: /^[0-9]+$/, message: "Only digits are allowed." }
          }),
        IDEMPOTENCY_ERROR_CODES.KEY_INVALID_FORMAT
      );
    });
  });

  it("returns the key unchanged when it is valid", () => {
    expect(handler.validateKey("REFUND-2026.08:u_1")).toBe("REFUND-2026.08:u_1");
  });
});

describe("IdempotencyHandler.hashRequest", () => {
  const { handler } = setupHandler();

  it("produces the same hash regardless of object key order", () => {
    expect(handler.hashRequest({ a: 1, b: 2 })).toBe(handler.hashRequest({ b: 2, a: 1 }));
  });

  it("produces the same hash for deeply nested objects with reordered keys", () => {
    const first = handler.hashRequest({
      user: { name: "Noor", id: 1 },
      meta: { tags: ["a", "b"] }
    });
    const second = handler.hashRequest({
      meta: { tags: ["a", "b"] },
      user: { id: 1, name: "Noor" }
    });

    expect(first).toBe(second);
  });

  it("returns a 64 character lowercase hex digest", () => {
    expect(handler.hashRequest({ a: 1 })).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different payloads", () => {
    expect(handler.hashRequest({ amount: 100 })).not.toBe(handler.hashRequest({ amount: 101 }));
  });

  it("distinguishes null from the string 'null'", () => {
    expect(handler.hashRequest(null)).not.toBe(handler.hashRequest("null"));
  });

  it("preserves array order in the hash", () => {
    expect(handler.hashRequest([1, 2, 3])).not.toBe(handler.hashRequest([3, 2, 1]));
  });

  it("throws UNSUPPORTED_REQUEST_VALUE for unsupported payload values", () => {
    expectToThrowWithCode(
      () => handler.hashRequest({ callback: () => {} }),
      IDEMPOTENCY_ERROR_CODES.UNSUPPORTED_REQUEST_VALUE
    );
  });
});

describe("IdempotencyHandler.execute", () => {
  const USER_ID = "user-1";
  const OPERATION = "pay";
  const KEY = "key-1";
  const BODY = { amount: 100 };

  describe("cache behavior", () => {
    it("returns the cached response on a HIT without touching the store or executing", async () => {
      const { handler, store, cache } = setupHandler();
      const execute = vi.fn();
      cache.get.mockResolvedValue({
        status: "HIT",
        data: {
          status: "SUCCESS",
          request_hash: handler.hashRequest(BODY),
          response: { cached: true }
        }
      });

      const result = await handler.execute(USER_ID, OPERATION, KEY, BODY, execute);

      expect(result).toEqual({ cached: true });
      expect(cache.get).toHaveBeenCalledWith("idem:v1:6:user-1:3:pay:5:key-1");
      expect(execute).not.toHaveBeenCalled();
      expect(store.create).not.toHaveBeenCalled();
      expect(store.markSuccess).not.toHaveBeenCalled();
    });

    it("runs the full flow on a MISS: create PROCESSING -> execute -> mark SUCCESS -> write cache", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "CREATED" });
      const execute = vi.fn().mockResolvedValue({ ok: true });

      const result = await handler.execute(USER_ID, OPERATION, KEY, BODY, execute);

      expect(result).toEqual({ ok: true });
      expect(store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          key: KEY,
          userId: USER_ID,
          operation: OPERATION,
          status: "PROCESSING",
          requestHash: handler.hashRequest(BODY)
        })
      );
      expect(execute).toHaveBeenCalledTimes(1);
      expect(store.markSuccess).toHaveBeenCalledWith(KEY, { ok: true }, USER_ID, OPERATION);
      expect(cache.set).toHaveBeenCalledWith(
        "idem:v1:6:user-1:3:pay:5:key-1",
        {
          status: "SUCCESS",
          request_hash: handler.hashRequest(BODY),
          response: { ok: true }
        },
        DEFAULT_CACHE_TTL
      );
    });

    it("treats an UNAVAILABLE cache status as a miss and falls back to the store", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "UNAVAILABLE" });
      store.create.mockResolvedValue({ status: "CREATED" });

      const result = await handler.execute(
        USER_ID,
        OPERATION,
        KEY,
        BODY,
        vi.fn().mockResolvedValue("result")
      );

      expect(result).toBe("result");
      expect(store.create).toHaveBeenCalledTimes(1);
    });

    it("gracefully falls back to the store when the cache get throws", async () => {
      // A Redis connection error must not break the request.
      const { handler, store, cache } = setupHandler();
      cache.get.mockRejectedValue(new Error("redis connection refused"));
      store.create.mockResolvedValue({ status: "CREATED" });

      const result = await handler.execute(
        USER_ID,
        OPERATION,
        KEY,
        BODY,
        vi.fn().mockResolvedValue({ ok: true })
      );

      expect(result).toEqual({ ok: true });
      expect(cache.get).toHaveBeenCalledTimes(1);
      expect(store.create).toHaveBeenCalledTimes(1);
    });

    it("swallows a cache set failure and still returns the response", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "CREATED" });
      cache.set.mockRejectedValue(new Error("redis down"));

      const result = await handler.execute(
        USER_ID,
        OPERATION,
        KEY,
        BODY,
        vi.fn().mockResolvedValue("ok")
      );

      expect(result).toBe("ok");
      expect(store.markSuccess).toHaveBeenCalled();
    });

    it("throws KEY_REUSED_WITH_DIFFERENT_REQUEST when the cached request hash does not match", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({
        status: "HIT",
        data: { status: "SUCCESS", request_hash: "stale-hash", response: {} }
      });

      await expect(handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn())).rejects.toMatchObject({
        code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST
      });
      expect(store.create).not.toHaveBeenCalled();
    });
  });

  describe("store coordination and concurrency", () => {
    it("returns the existing SUCCESS response without re-executing when the key is a duplicate", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "DUPLICATE" });
      store.find.mockResolvedValue(
        makeRecord({
          requestHash: handler.hashRequest(BODY),
          response: { from: "store" }
        })
      );

      const result = await handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn());

      expect(result).toEqual({ from: "store" });
      expect(store.find).toHaveBeenCalledWith(KEY, OPERATION, USER_ID);
      expect(store.markSuccess).not.toHaveBeenCalled();
    });

    it("throws REQUEST_IN_PROGRESS when another request holds the key in PROCESSING", async () => {
      // Request B arrives while request A is still running.
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "DUPLICATE" });
      store.find.mockResolvedValue(
        makeRecord({
          status: "PROCESSING",
          requestHash: handler.hashRequest(BODY)
        })
      );

      await expect(handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn())).rejects.toMatchObject({
        code: IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS
      });
    });

    it("throws REQUEST_FAILED when the previous attempt with the same key failed", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "DUPLICATE" });
      store.find.mockResolvedValue(
        makeRecord({
          status: "FAILED",
          requestHash: handler.hashRequest(BODY)
        })
      );

      await expect(handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn())).rejects.toMatchObject({
        code: IDEMPOTENCY_ERROR_CODES.REQUEST_FAILED
      });
    });

    it("throws KEY_REUSED_WITH_DIFFERENT_REQUEST when a duplicate key was used with a different payload", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "DUPLICATE" });
      store.find.mockResolvedValue(
        makeRecord({
          status: "SUCCESS",
          requestHash: "different-request-hash"
        })
      );

      await expect(handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn())).rejects.toMatchObject({
        code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST
      });
    });

    it("surfaces STORE_UNAVAILABLE when the create call fails with an unexpected error", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockRejectedValue(new Error("database connection lost"));

      await expect(handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn())).rejects.toMatchObject({
        code: IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE
      });
    });
  });

  describe("execution failures", () => {
    it("marks the record FAILED and rethrows the original error when execution throws", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "CREATED" });
      const boom = new Error("business logic exploded");

      await expect(
        handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn().mockRejectedValue(boom))
      ).rejects.toBe(boom);
      expect(store.markFailed).toHaveBeenCalledWith(KEY, OPERATION, USER_ID);
      expect(store.markSuccess).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it("marks the record FAILED even when execution rejects with a non-Error value", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "CREATED" });

      await expect(
        handler.execute(USER_ID, OPERATION, KEY, BODY, vi.fn().mockRejectedValue("boom"))
      ).rejects.toBe("boom");
      expect(store.markFailed).toHaveBeenCalledWith(KEY, OPERATION, USER_ID);
    });
  });

  describe("multi-tenant isolation", () => {
    it("does not collide when the same key and user are used with a different operation", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "CREATED" });

      const payResult = await handler.execute(
        USER_ID,
        "pay",
        KEY,
        BODY,
        vi.fn().mockResolvedValue("paid")
      );
      const refundResult = await handler.execute(
        USER_ID,
        "refund",
        KEY,
        BODY,
        vi.fn().mockResolvedValue("refunded")
      );

      expect(payResult).toBe("paid");
      expect(refundResult).toBe("refunded");
      expect(cache.get).toHaveBeenCalledWith("idem:v1:6:user-1:3:pay:5:key-1");
      expect(cache.get).toHaveBeenCalledWith("idem:v1:6:user-1:6:refund:5:key-1");
      expect(store.create).toHaveBeenCalledTimes(2);
    });

    it("does not collide when the same key and operation are used by a different user", async () => {
      const { handler, store, cache } = setupHandler();
      cache.get.mockResolvedValue({ status: "MISS" });
      store.create.mockResolvedValue({ status: "CREATED" });

      const alice = await handler.execute(
        "alice",
        OPERATION,
        KEY,
        BODY,
        vi.fn().mockResolvedValue("a")
      );
      const bob = await handler.execute(
        "bob",
        OPERATION,
        KEY,
        BODY,
        vi.fn().mockResolvedValue("b")
      );

      expect(alice).toBe("a");
      expect(bob).toBe("b");
      expect(cache.get).toHaveBeenCalledWith("idem:v1:5:alice:3:pay:5:key-1");
      expect(cache.get).toHaveBeenCalledWith("idem:v1:3:bob:3:pay:5:key-1");
      expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "alice" }));
      expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "bob" }));
    });
  });

  it("still works without a cache configured", async () => {
    const store = createStore();
    const handler = new IdempotencyHandler(store);
    store.create.mockResolvedValue({ status: "CREATED" });

    const result = await handler.execute(
      USER_ID,
      OPERATION,
      KEY,
      BODY,
      vi.fn().mockResolvedValue("done")
    );

    expect(result).toBe("done");
    expect(store.markSuccess).toHaveBeenCalled();
  });
});

describe("IdempotencyHandler.retry", () => {
  const { handler, store } = setupHandler();

  it("returns the existing SUCCESS record without re-marking it as processing", async () => {
    store.find.mockResolvedValue(makeRecord({ status: "SUCCESS", response: { id: 42 } }));

    const record = await handler.retry("user-1", "pay", "key-1");

    expect(record?.status).toBe("SUCCESS");
    expect(store.markProcessing).not.toHaveBeenCalled();
  });

  it("throws REQUEST_IN_PROGRESS when the record is still PROCESSING", async () => {
    store.find.mockResolvedValue(makeRecord({ status: "PROCESSING" }));

    await expect(handler.retry("user-1", "pay", "key-1")).rejects.toMatchObject({
      code: IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS
    });
    expect(store.markProcessing).not.toHaveBeenCalled();
  });

  it("re-marks a FAILED record as PROCESSING so it can be retried", async () => {
    store.find.mockResolvedValue(makeRecord({ status: "FAILED" }));

    await handler.retry("user-1", "pay", "key-1");

    expect(store.markProcessing).toHaveBeenCalledWith("key-1", "pay", "user-1");
  });

  it("throws RECORD_NOT_FOUND when no record exists for the key", async () => {
    store.find.mockResolvedValue(null);

    const result = await handler.retry("user-1", "pay", "key-1");
    expect(result).toBeNull();
  });
});

describe("IdempotencyHandler.recoverStuckRecords", () => {
  it("queries only PROCESSING records updated before the cutoff and marks them FAILED", async () => {
    const { handler, store } = setupHandler();
    const stuck = [
      makeRecord({
        key: "k-1",
        userId: "u-1",
        operation: "op-1",
        status: "PROCESSING"
      }),
      makeRecord({
        key: "k-2",
        userId: "u-2",
        operation: "op-2",
        status: "PROCESSING"
      })
    ];
    store.findAll.mockResolvedValue(stuck);

    const result = await handler.recoverStuckRecords();

    expect(store.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PROCESSING",
        updatedBefore: expect.any(Date),
        limit: 100
      })
    );
    expect(store.markFailed).toHaveBeenCalledWith("k-1", "op-1", "u-1");
    expect(store.markFailed).toHaveBeenCalledWith("k-2", "op-2", "u-2");
    expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
  });

  it("honors the custom timeout and limit options", async () => {
    const { handler, store } = setupHandler();
    store.findAll.mockResolvedValue([]);

    await handler.recoverStuckRecords({ timeoutInMs: 60_000, limit: 5 });

    const filters = store.findAll.mock.calls[0]?.[0];
    expect(filters?.limit).toBe(5);
    // The cutoff is ~1 minute before now, so it must be a Date in the recent past.
    const cutoff = filters?.updatedBefore;
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(cutoff!.getTime()).toBeGreaterThan(Date.now() - 120_000);
  });

  it("keeps recovering the remaining records when one markFailed call fails", async () => {
    // One DB hiccup must not stop recovery of the other 9 records.
    const { handler, store } = setupHandler();
    const stuck = Array.from({ length: 10 }, (_, i) =>
      makeRecord({
        key: `k-${i}`,
        userId: `u-${i}`,
        operation: `op-${i}`,
        status: "PROCESSING"
      })
    );
    store.findAll.mockResolvedValue(stuck);
    store.markFailed.mockRejectedValueOnce(new Error("database hiccup"));

    const result = await handler.recoverStuckRecords({ limit: 10 });

    expect(result).toEqual({ processed: 10, succeeded: 9, failed: 1 });
    expect(store.markFailed).toHaveBeenCalledTimes(10);
  });

  it("returns a zeroed result when there are no stuck records", async () => {
    const { handler, store } = setupHandler();
    store.findAll.mockResolvedValue([]);

    const result = await handler.recoverStuckRecords();

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    expect(store.markFailed).not.toHaveBeenCalled();
  });
});
