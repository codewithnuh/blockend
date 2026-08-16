import crypto from "crypto";

/**
 * Constant-time string comparison for secret-ish values such as request hashes.
 *
 * WHY: comparing two strings with `!==` short-circuits on the first differing
 * byte, so an attacker probing stored values could measure timing differences
 * and learn prefix information. `crypto.timingSafeEqual` runs in time
 * proportional to the input length regardless of where the difference is.
 *
 * NOTE: this is defense-in-depth — a 256-bit SHA-256 digest cannot realistically
 * be recovered via timing on its own — but the check is cheap and removes the
 * leak class entirely. Lengths are compared first because `timingSafeEqual`
 * throws when the buffers differ in length (and request hashes are always
 * 64-char lowercase hex, so a length mismatch means "different" anyway).
 */
export function constantTimeEquals(a: string, b: string): boolean {
  // Defensive: a malformed/legacy record may carry a non-string hash (e.g.
  // `undefined`). Treat it as a mismatch — never crash the request with a
  // TypeError, and never let a missing hash pass the comparison.
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}
