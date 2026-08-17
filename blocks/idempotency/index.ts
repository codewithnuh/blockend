/**
 * Master barrel export for the idempotency library.
 *
 * Re-exports the complete public API so consumers can import everything from a
 * single entry point, exactly as they could from the previous monolithic
 * `IdempotencyHandler` module:
 *
 *   import { IdempotencyHandler, DEFAULT_CACHE_TTL } from "idempotency/core";
 *
 * The module is decomposed into focused sub-modules (errors, interfaces, types,
 * utils, services, jobs) — see `core/idempotency-handler.ts` for the main class.
 */

// Errors
export { IDEMPOTENCY_ERROR_CODES } from "./errors/codes";
export type { IdempotencyErrorCode } from "./errors/codes";
export { IdempotencyError } from "./errors/idempotency-errors";

// Interfaces
export type { IdempotencyCache } from "./interfaces/cache";
export type {
  DeleteExpiredParams,
  FindAllFilters,
  IdempotencyStore,
  RecoverStuckRecordsOptions,
  RecoveryResult
} from "./interfaces/store";
export { noopLogger, noopMetrics } from "./interfaces/observability";
export type { Logger, Metrics, MetricName } from "./interfaces/observability";

// Types
export type {
  CachedResponse,
  CreateIdempotencyRecord,
  CreateProcessingResult,
  CreateRecordResult,
  IdempotencyRecord,
  IdempotencyStatus
} from "./types/index";

// Services
export { CacheManager, DEFAULT_CACHE_TTL } from "./services/cache-manager";

// Utils
export {
  DEFAULT_MAX_KEY_LENGTH,
  DEFAULT_MIN_KEY_LENGTH,
  UUID_REGEX,
  validateKey
} from "./utils/key-validator";
export type { KeyValidationOptions } from "./utils/key-validator";
export { hashRequest, serialize } from "./utils/serializer";

// Jobs
export { cleanupExpiredRecords } from "./jobs/record-cleaner";
export type { CleanupExpiredOptions, CleanupResult } from "./jobs/record-cleaner";
export { recoverStuckRecords } from "./jobs/record-recovery";

// Core handler
export { IdempotencyHandler } from "./core/idempotency-handler";
export type { IdempotencyHandlerOptions } from "./core/idempotency-handler";
