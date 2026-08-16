/**
 * Adapter-agnostic HTTP helpers shared by every framework adapter.
 *
 * The framework adapters (Express / Fastify / Hono) translate `IdempotencyError`
 * into HTTP responses. The status mapping and the error envelope are identical
 * across frameworks, so they live here once instead of being copied into each
 * adapter.
 */
import type { IdempotencyErrorCode } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";

// Default error code -> HTTP status mapping.
export const DEFAULT_STATUS_MAP: Record<IdempotencyErrorCode, number> = {
  // Client input problems -> 400
  KEY_INVALID_TYPE: 400,
  KEY_REQUIRED: 400,
  KEY_TOO_SHORT: 400,
  KEY_TOO_LONG: 400,
  KEY_INVALID_FORMAT: 400,
  UNSUPPORTED_REQUEST_VALUE: 400,
  // Idempotency conflicts -> 409 Conflict
  KEY_REUSED_WITH_DIFFERENT_REQUEST: 409,
  REQUEST_IN_PROGRESS: 409,
  REQUEST_FAILED: 409,
  // Lookups
  RECORD_NOT_FOUND: 404,
  // Infrastructure
  STORE_UNAVAILABLE: 503,
  CACHE_UNAVAILABLE: 503,
  // Should not happen; treat as a server error
  INVALID_CACHED_RESPONSE: 500
};

/**
 * Maps an `IdempotencyError` to the HTTP status it should be served with.
 */
export function idempotencyErrorStatus(
  error: IdempotencyError,
  statusMap?: Partial<Record<IdempotencyErrorCode, number>>
): number {
  return statusMap?.[error.code] ?? DEFAULT_STATUS_MAP[error.code] ?? 500;
}

/**
 * Builds the standard error envelope: `{ error: { code, message } }`.
 */
export function buildErrorEnvelope(error: IdempotencyError): {
  error: { code: string; message: string };
} {
  return { error: { code: error.code, message: error.message } };
}
