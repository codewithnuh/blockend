import { describe, expect, it } from "vitest";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import { DEFAULT_MAX_KEY_LENGTH, UUID_REGEX, validateKey } from "./key-validator";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error instanceof IdempotencyError ? error.code : undefined;
  }
}

describe("validateKey - security & edge cases", () => {
  it("trims BEFORE length checks so padded input cannot bypass limits", () => {
    // Raw length is 7, trimmed length is 3.
    const cleaned = validateKey("  abc  ", { minLength: 3 });
    expect(cleaned).toBe("abc");
  });

  it("does not let trailing whitespace bloat storage", () => {
    const cleaned = validateKey("key-1\t");
    expect(cleaned).toBe("key-1");
  });

  it("rejects whitespace-only input as missing", () => {
    expect(codeOf(() => validateKey(" \t\n "))).toBe(IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED);
  });

  it("applies maxLength to the trimmed value", () => {
    expect(codeOf(() => validateKey("abcdef", { maxLength: 3 }))).toBe(
      IDEMPOTENCY_ERROR_CODES.KEY_TOO_LONG
    );
  });

  it("rejects non-strings before anything else", () => {
    for (const bad of [123, null, undefined, true, {}, []]) {
      expect(codeOf(() => validateKey(bad))).toBe(IDEMPOTENCY_ERROR_CODES.KEY_INVALID_TYPE);
    }
  });

  it("allows the cache-delimiter character ':' (scoped per-component downstream)", () => {
    // ':' is in the default charset; the cache layer length-prefixes keys so
    // colons in keys never collide with other scopes.
    expect(validateKey("refund:2026-08")).toBe("refund:2026-08");
  });

  it("enforces the default max length of 128", () => {
    expect(codeOf(() => validateKey("a".repeat(DEFAULT_MAX_KEY_LENGTH + 1)))).toBe(
      IDEMPOTENCY_ERROR_CODES.KEY_TOO_LONG
    );
    expect(validateKey("a".repeat(DEFAULT_MAX_KEY_LENGTH))).toHaveLength(DEFAULT_MAX_KEY_LENGTH);
  });

  describe("UUID mode", () => {
    it("accepts a valid UUID v4", () => {
      const uuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
      expect(UUID_REGEX.test(uuid)).toBe(true);
      expect(validateKey(uuid, { requireUuid: true })).toBe(uuid);
    });

    it("rejects non-UUID input when requireUuid is set", () => {
      expect(codeOf(() => validateKey("not-a-uuid", { requireUuid: true }))).toBe(
        IDEMPOTENCY_ERROR_CODES.KEY_INVALID_FORMAT
      );
    });

    it("rejects a UUID with an invalid version nibble", () => {
      // Version '6' (and '0') are outside RFC 4122 v1-v5.
      expect(UUID_REGEX.test("f47ac10b-58cc-6372-a567-0e02b2c3d479")).toBe(false);
    });

    it("rejects a UUID with an invalid variant nibble", () => {
      expect(UUID_REGEX.test("f47ac10b-58cc-4372-c567-0e02b2c3d479")).toBe(false);
    });
  });

  describe("custom patterns", () => {
    it("honors a custom pattern and reports its message", () => {
      let caught: unknown;
      try {
        validateKey("abc", {
          pattern: { value: /^[0-9]+$/, message: "Only digits allowed." }
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(IdempotencyError);
      expect((caught as IdempotencyError).code).toBe(IDEMPOTENCY_ERROR_CODES.KEY_INVALID_FORMAT);
      expect((caught as IdempotencyError).message).toContain("Only digits allowed.");
    });
  });
});
