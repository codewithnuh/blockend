import crypto from "crypto";
import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";

/**
 * Maximum object/array nesting depth accepted by `serialize`.
 *
 * SECURITY: without a depth bound, an attacker-controlled body that nests
 * objects thousands of levels deep (or contains a cyclic reference) would
 * recurse until the JS stack overflows, surfacing as a raw `RangeError` (500)
 * instead of a clean, typed client error. Bounding the depth turns that DoS
 * vector into a deterministic `UNSUPPORTED_REQUEST_VALUE` rejection.
 */
const MAX_SERIALIZE_DEPTH = 100;

/**
 * Deterministically stringifies a payload structure.
 *
 * Why not plain `JSON.stringify`? `JSON.stringify({ a: 1, b: 2 })` differs from
 * `JSON.stringify({ b: 2, a: 1 })`. By sorting object keys recursively, two
 * logically-identical payloads always produce byte-identical strings, which is
 * the foundation for stable request hashing.
 *
 * REPRESENTATION SAFETY: primitives are encoded with `JSON.stringify` so that
 * `null` ("null") is distinguishable from the string "null" ('"null"'), and
 * numbers from numeric strings. Arrays keep their order (order is significant).
 *
 * REJECTED VALUES: `undefined`, `NaN`, `±Infinity`, `BigInt`, functions,
 * symbols, cycles, and nesting deeper than `MAX_SERIALIZE_DEPTH` are rejected
 * because their stringification is non-deterministic, runtime-dependent, or a
 * stack-overflow risk — hashing them would produce unstable fingerprints.
 */
export function serialize(value: unknown): string {
  return serializeInternal(value, 0, new WeakSet<object>());
}

function serializeInternal(value: unknown, depth: number, seen: WeakSet<object>): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number") {
    // NaN or Infinity produce inconsistent output across JS runtimes
    if (!Number.isFinite(value)) {
      throw unsupported();
    }

    return JSON.stringify(value);
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (depth > MAX_SERIALIZE_DEPTH) {
      throw unsupported();
    }

    // Cycle detection: a container that is already on the current recursion
    // path is a cyclic reference, which would otherwise recurse forever.
    // Containers are removed from `seen` when their subtree finishes so shared
    // (diamond) references — which are legal — are not mistaken for cycles.
    if (seen.has(value)) {
      throw unsupported();
    }

    seen.add(value);

    try {
      const items = value.map((item) => serializeInternal(item, depth + 1, seen));

      return `[${items.join(",")}]`;
    } finally {
      seen.delete(value);
    }
  }

  if (typeof value === "object") {
    if (depth > MAX_SERIALIZE_DEPTH) {
      throw unsupported();
    }

    if (seen.has(value)) {
      throw unsupported();
    }

    seen.add(value);

    try {
      const object = value as Record<string, unknown>;

      // Sorting object keys is what guarantees payload hashing consistency
      const entries = Object.keys(object)
        .sort()
        .map((key) => {
          const serializedKey = JSON.stringify(key);
          const serializedValue = serializeInternal(object[key], depth + 1, seen);

          return `${serializedKey}:${serializedValue}`;
        });

      return `{${entries.join(",")}}`;
    } finally {
      seen.delete(value);
    }
  }

  throw unsupported();
}

function unsupported(): IdempotencyError {
  return new IdempotencyError(
    IDEMPOTENCY_ERROR_CODES.UNSUPPORTED_REQUEST_VALUE,
    "Unsupported request value for deterministic serialization."
  );
}

/**
 * Produces a stable SHA-256 fingerprint of a request payload.
 *
 * The digest is a 64-character lowercase hex string and is the value stored as
 * `request_hash` on records and cache entries. Two identical payloads always
 * yield the same hash regardless of object key ordering; two different payloads
 * yield different hashes (barring SHA-256 collisions).
 */
export function hashRequest(body: unknown): string {
  const serialized = serialize(body);

  return crypto.createHash("sha256").update(serialized).digest("hex");
}
