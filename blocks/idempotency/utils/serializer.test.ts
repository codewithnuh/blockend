import { describe, expect, it } from "vitest";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import { serialize } from "./serializer";

/**
 * Security-focused unit tests for the deterministic serializer.
 *
 * The serializer sits at the boundary between attacker-controlled request
 * bodies and the idempotency hash — it must never blow the stack, never hang,
 * and never produce unstable fingerprints.
 */
describe("serialize - security & robustness", () => {
  describe("deep nesting (stack-overflow DoS protection)", () => {
    it("rejects payloads nested deeper than the limit with a typed error, not a RangeError", () => {
      let deep: Record<string, unknown> = { leaf: true };
      for (let i = 0; i < 150; i++) {
        deep = { nested: deep };
      }

      let caught: unknown;
      try {
        serialize(deep);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(IdempotencyError);
      expect((caught as IdempotencyError).code).toBe(
        IDEMPOTENCY_ERROR_CODES.UNSUPPORTED_REQUEST_VALUE
      );
    });

    it("rejects deeply nested arrays at the limit", () => {
      let deep: unknown[] = ["leaf"];
      for (let i = 0; i < 150; i++) {
        deep = [deep];
      }

      expect(() => serialize(deep)).toThrow(IdempotencyError);
    });

    it("accepts nesting within the limit", () => {
      let value: Record<string, unknown> = { leaf: true };
      for (let i = 0; i < 50; i++) {
        value = { nested: value };
      }

      expect(serialize(value)).toContain('"leaf":true');
    });
  });

  describe("circular references (infinite-recursion protection)", () => {
    it("rejects a direct self-cycle with a typed error", () => {
      const value: Record<string, unknown> = {};
      value.self = value;

      let caught: unknown;
      try {
        serialize(value);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(IdempotencyError);
      expect((caught as IdempotencyError).code).toBe(
        IDEMPOTENCY_ERROR_CODES.UNSUPPORTED_REQUEST_VALUE
      );
    });

    it("rejects a cycle inside an array", () => {
      const value: unknown[] = [];
      value.push(value);

      expect(() => serialize(value)).toThrow(IdempotencyError);
    });

    it("rejects a mutual object cycle", () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      a.next = b;
      b.next = a;

      expect(() => serialize(a)).toThrow(IdempotencyError);
    });

    it("allows shared (diamond) references — not a cycle", () => {
      const shared = { x: 1 };
      const value = { a: shared, b: shared };

      // A shared reference must serialize identically to its inlined copy.
      expect(serialize(value)).toBe(serialize({ a: { x: 1 }, b: { x: 1 } }));
    });
  });

  describe("prototype-key handling", () => {
    it("serializes an own `__proto__` property deterministically (JSON.parse creates own props safely)", () => {
      // JSON.parse creates `__proto__` as an own data property, not via the
      // prototype setter — the serializer must hash it, not silently drop it.
      const first = JSON.parse('{"a": 1, "__proto__": {"polluted": true}}');
      const second = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}');

      expect(serialize(first)).toBe(serialize(second));
      expect(serialize(first)).toContain('"__proto__"');
    });

    it("does not follow inherited properties (own keys only)", () => {
      // A prototype-polluted object must not affect the fingerprint.
      const polluted: Record<string, unknown> = { a: 1 };
      Object.setPrototypeOf(polluted, { inherited: "x" });

      expect(serialize(polluted)).toBe('{"a":1}');
    });
  });

  describe("non-deterministic values keep failing", () => {
    it.each([
      ["undefined", undefined],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["-Infinity", -Infinity],
      ["BigInt", 123n],
      ["function", () => {}],
      ["symbol", Symbol("x")]
    ])("rejects %s", (_name, value) => {
      expect(() => serialize(value)).toThrow(IdempotencyError);
    });
  });

  describe("determinism regressions", () => {
    it("ignores key order but preserves array order", () => {
      expect(serialize({ b: [1, 2], a: { y: 1, x: 2 } })).toBe('{"a":{"x":2,"y":1},"b":[1,2]}');
    });

    it('distinguishes -0 from 0? (documented: JSON.stringify(-0) === "0", same fingerprint)', () => {
      // This is an accepted limitation: -0 and 0 hash identically because
      // JSON.stringify collapses them. Both are the same numeric value.
      expect(serialize(-0)).toBe(serialize(0));
    });
  });
});
