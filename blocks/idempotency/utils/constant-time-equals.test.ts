import { describe, expect, it } from "vitest";
import { constantTimeEquals } from "./constant-time-equals";

describe("constantTimeEquals", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEquals("abc", "abc")).toBe(true);
  });

  it("returns true for identical 64-char hashes", () => {
    const hash = "a".repeat(64);
    expect(constantTimeEquals(hash, hash)).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(constantTimeEquals("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths without throwing", () => {
    // timingSafeEqual would throw on length mismatch; the helper must not.
    expect(constantTimeEquals("abc", "abcd")).toBe(false);
    expect(constantTimeEquals("", "a")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(constantTimeEquals("ABC", "abc")).toBe(false);
  });

  it("treats a non-string (malformed/legacy record) as a mismatch without throwing", () => {
    // The store may hand us a record whose request_hash is missing/undefined;
    // this must read as "different", never crash with a TypeError.
    expect(constantTimeEquals(undefined as never, "abc")).toBe(false);
    expect(constantTimeEquals("abc", undefined as never)).toBe(false);
    expect(constantTimeEquals("abc", 42 as never)).toBe(false);
  });
});
