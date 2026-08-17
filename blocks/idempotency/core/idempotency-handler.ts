import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import type { IdempotencyCache } from "../interfaces/cache";
import type { Logger, Metrics } from "../interfaces/observability";
import { noopLogger, noopMetrics } from "../interfaces/observability";
import type {
  IdempotencyStore,
  RecoverStuckRecordsOptions,
  RecoveryResult
} from "../interfaces/store";
import type {
  CreateIdempotencyRecord,
  CreateProcessingResult,
  IdempotencyRecord
} from "../types/index";
import { validateKey } from "../utils/key-validator";
import type { KeyValidationOptions } from "../utils/key-validator";
import { hashRequest, serialize } from "../utils/serializer";
import { constantTimeEquals } from "../utils/constant-time-equals";
import { CacheManager } from "../services/cache-manager";
import { cleanupExpiredRecords } from "../jobs/record-cleaner";
import type { CleanupExpiredOptions, CleanupResult } from "../jobs/record-cleaner";
import { recoverStuckRecords } from "../jobs/record-recovery";

export type IdempotencyHandlerOptions = {
  logger?: Logger;
  metrics?: Metrics;
};

const DEFAULT_RECORD_TTL = 24 * 60 * 60 * 1000;
const MAX_ALLOWED_RETRIES = 3;

/**
 * IdempotencyHandler wraps business logic so that retries of the same request
 * are safe: a request keyed by (operation, userId, key) executes exactly once,
 * and subsequent attempts receive the stored result instead.
 *
 * The class deliberately focuses on orchestration only. All heavy lifting is
 * delegated to focused modules:
 *   - key validation   -> utils/key-validator
 *   - hashing          -> utils/serializer
 *   - L1 cache         -> services/cache-manager
 *   - background jobs  -> jobs/record-cleaner, jobs/record-recovery
 *
 * Public API (execute, validateKey, serialize, hashRequest,
 * cleanupExpiredRecords, recoverStuckRecords, retry) is fully
 * backward-compatible with the previous monolithic implementation.
 */
export class IdempotencyHandler {
  private readonly logger: Logger;
  private readonly metrics: Metrics;
  private readonly cacheManager: CacheManager;

  constructor(
    private readonly store: IdempotencyStore,
    cache?: IdempotencyCache,
    options: IdempotencyHandlerOptions = {}
  ) {
    this.logger = options.logger ?? noopLogger;
    this.metrics = options.metrics ?? noopMetrics;
    this.cacheManager = new CacheManager(cache, this.logger, this.metrics);
  }

  /**
   * Sanitizes and validates the incoming idempotency key.
   * Delegates to `utils/key-validator`, which trims BEFORE length checks so
   * whitespace alone can't bypass length limits or bloat storage.
   *
   * @returns the cleaned key; callers MUST use this returned value, not the raw input.
   */
  public validateKey(key: unknown, options?: KeyValidationOptions): string {
    return validateKey(key, options);
  }

  /**
   * Deterministically stringifies a payload structure (recursively sorted keys,
   * order-preserving arrays, non-ambiguous primitive encodings). Rejects
   * non-deterministic values (undefined, NaN, Infinity, BigInt, functions,
   * symbols). See `utils/serializer` for details.
   */
  public static serialize(value: unknown): string {
    return serialize(value);
  }

  /**
   * Produces a stable SHA-256 fingerprint of a request payload so identical
   * payloads (regardless of key order) hash identically.
   */
  public hashRequest(body: unknown): string {
    return hashRequest(body);
  }

  /**
   * Intended to be run periodically by a background worker or cron job.
   *
   * SAFETY INVARIANT: only deletes records with status 'SUCCESS' or 'FAILED'.
   * Records marked 'PROCESSING' are intentionally excluded here, even if
   * expired — purging an active lock would allow a duplicate incoming request
   * to grab a new lock and run concurrently. Stuck locks are handled by
   * `recoverStuckRecords()` instead.
   */
  public async cleanupExpiredRecords(options?: CleanupExpiredOptions): Promise<CleanupResult> {
    return cleanupExpiredRecords(this.store, this.logger, this.metrics, options);
  }

  /**
   * Recovers operations stuck in 'PROCESSING' (e.g., node crashed mid-execution)
   * by marking them 'FAILED' so clients can safely retry or inspect the outcome.
   */
  public async recoverStuckRecords(options?: RecoverStuckRecordsOptions): Promise<RecoveryResult> {
    return recoverStuckRecords(this.store, this.logger, this.metrics, options);
  }

  /**
   * Manually re-opens a failed record to 'PROCESSING' to allow retry attempts.
   */
  public async retry(
    userId: string,
    operation: string,
    key: string
  ): Promise<IdempotencyRecord | null> {
    const record = await this.store.find(key, operation, userId);

    if (!record) {
      return null;
    }

    // Already completed successfully; no retry needed
    if (record.status === "SUCCESS") {
      return record;
    }

    // Another thread or node is already processing this job
    if (record.status === "PROCESSING") {
      this.metrics.increment("idempotency_duplicates_total", 1, {
        operation,
        status: "processing"
      });
      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS,
        "The request is already being processed."
      );
    }

    // Re-acquire lock for failed operation
    if (record.status === "FAILED") {
      await this.markRecordProcessing(userId, operation, key);

      return {
        ...record,
        status: "PROCESSING",
        updatedAt: new Date()
      };
    }

    throw new IdempotencyError(
      IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE,
      "Unable to retry the idempotency record."
    );
  }

  /**
   * Main entrypoint for wrapping business logic with idempotency.
   *
   * Flow:
   * 1. Validate key -> Hash body payload.
   * 2. Check L1 cache (Redis/Memory). Hit -> return response immediately.
   * 3. Acquire DB lock (create PROCESSING record).
   * 4. Run `execute()` callback.
   * 5. Success -> Mark DB record SUCCESS & sync L1 cache.
   * 6. Error -> Check if error is transient or permanent:
   *    - Permanent error: Mark FAILED immediately (blocks identical retries).
   *    - Transient error: Increment retry count. Delete record if retries
   *      remain so the client can retry.
   */
  public async execute(
    userId: string,
    operation: string,
    key: string,
    body: unknown,
    execute: () => Promise<unknown>,
    options?: { isPermanentError?: (err: unknown) => boolean }
  ): Promise<unknown> {
    const startTime = performance.now();

    // The entire flow — including key validation and body hashing — runs
    // inside the try so the latency histogram is always emitted, even when an
    // attacker-controlled key/body is rejected up front.
    try {
      const validKey = this.validateKey(key);
      const requestHash = this.hashRequest(body);

      // 1. Fast path: check short-lived cache hit
      const cachedResponse = await this.cacheManager.getCachedResponse(
        userId,
        operation,
        validKey,
        requestHash
      );

      if (cachedResponse?.status === "HIT") {
        return cachedResponse.data.response;
      }

      const expiresAt = new Date(Date.now() + DEFAULT_RECORD_TTL);

      // 2. Lock phase: Atomic insert into DB
      const result = await this.createProcessingRecord({
        key: validKey,
        request_hash: requestHash,
        response: null,
        status: "PROCESSING",
        expires_at: expiresAt,
        user_id: userId,
        operation
      });

      // 3. Return cached DB result if request was completed previously
      if (result.kind === "EXISTING_SUCCESS") {
        return result.response;
      }

      // 4. Lock acquired successfully -> run actual business logic
      try {
        const response = await execute();

        await this.markRecordSuccess(userId, operation, validKey, response);

        // Async write to L1 cache; non-blocking failure
        await this.cacheManager.setCachedResponse(
          userId,
          operation,
          validKey,
          requestHash,
          response
        );

        this.logger.info(
          { key: validKey, userId, operation, status: "executed_success" },
          "Idempotent operation executed and recorded successfully"
        );

        return response;
      } catch (error) {
        // FAIL CLOSED: if the caller's error classifier itself throws, treat
        // the failure as permanent (mark the record FAILED) and rethrow the
        // ORIGINAL error — never let a classifier bug swallow the real cause
        // or leave the lock dangling.
        let permanent = true;

        try {
          permanent = options?.isPermanentError ? options.isPermanentError(error) : true;
        } catch {
          permanent = true;
        }

        if (permanent) {
          // Permanent business logic failure (e.g., validation fail) -> save as FAILED
          await this.markRecordFailed(userId, operation, validKey);
        } else {
          // Transient failure (e.g., DB connection drop) -> increment counter
          const retryCount = await this.incrementRetryCount(userId, operation, validKey);

          if (retryCount >= MAX_ALLOWED_RETRIES) {
            await this.markRecordFailed(userId, operation, validKey);
          } else {
            // Delete lock row so caller can retry immediately on next request
            await this.deleteRecord(userId, operation, validKey);
          }
        }

        this.logger.error(
          {
            key: validKey,
            userId,
            operation,
            permanent,
            error: error instanceof Error ? error.message : error
          },
          "Idempotent operation execution failed"
        );

        throw error;
      }
    } finally {
      const durationInSeconds = (performance.now() - startTime) / 1000;
      this.metrics.histogram("idempotency_latency_seconds", durationInSeconds, {
        operation
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private store-coordination helpers (used by execute()/retry() orchestration)
  // ---------------------------------------------------------------------------

  /**
   * Attempts an atomic insert of a PROCESSING lock record.
   *
   * - On `CREATED`: the lock is ours; execute the business logic.
   * - On `DUPLICATE`: the key already exists; inspect the existing row and
   *   either return its stored SUCCESS response, or reject with the
   *   appropriate idempotency error (in-progress / failed / hash mismatch).
   */
  private async createProcessingRecord({
    key,
    request_hash,
    response,
    expires_at,
    status,
    user_id,
    operation
  }: CreateIdempotencyRecord & {
    operation: string;
  }): Promise<CreateProcessingResult> {
    const record: IdempotencyRecord = {
      key,
      requestHash: request_hash,
      response,
      expiresAt: expires_at,
      status,
      userId: user_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      operation
    };

    try {
      // Primary DB call: attempts an atomic insert (e.g. INSERT INTO ... ON CONFLICT DO NOTHING)
      const result = await this.store.create(record);

      if (result.status === "CREATED") {
        return { kind: "CREATED", record };
      }

      // Insert failed due to duplicate key; fetch existing row state
      const existingData = await this.findRecordByKey(user_id, operation, key);

      return this.handleExistingRecord(existingData, request_hash);
    } catch (error) {
      if (error instanceof IdempotencyError) {
        throw error;
      }

      this.metrics.increment("idempotency_store_errors_total", 1, {
        operation
      });
      this.logger.error(
        {
          key,
          userId: user_id,
          operation,
          error: error instanceof Error ? error.message : error
        },
        "Idempotency store error during record creation"
      );

      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE,
        "The idempotency store is currently unavailable."
      );
    }
  }

  /**
   * Inspects a pre-existing record (the insert was a DUPLICATE) and decides the
   * outcome: return the stored SUCCESS response, or throw the correct error.
   */
  private handleExistingRecord(
    existingData: IdempotencyRecord,
    requestHash: string
  ): CreateProcessingResult {
    this.metrics.increment("idempotency_duplicates_total", 1, {
      operation: existingData.operation,
      status: existingData.status.toLowerCase()
    });

    // Key reuse with payload mismatch -> reject immediately. Compared in
    // constant time so hash probing can't leak prefix information.
    if (!constantTimeEquals(existingData.requestHash, requestHash)) {
      this.logger.warn(
        {
          key: existingData.key,
          userId: existingData.userId,
          operation: existingData.operation
        },
        "Idempotency key reused with different request body"
      );
      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.KEY_REUSED_WITH_DIFFERENT_REQUEST,
        "Idempotency key was already used with a different request."
      );
    }

    if (existingData.status === "SUCCESS") {
      this.logger.info(
        {
          key: existingData.key,
          userId: existingData.userId,
          operation: existingData.operation
        },
        "Returning existing success response from store"
      );
      return {
        kind: "EXISTING_SUCCESS",
        // Return the stored response payload (not the full record) so callers
        // receive the same shape as a fresh execution.
        response: existingData.response
      };
    }

    if (existingData.status === "PROCESSING") {
      this.logger.warn(
        {
          key: existingData.key,
          userId: existingData.userId,
          operation: existingData.operation
        },
        "Concurrent request blocked; key is currently processing"
      );
      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.REQUEST_IN_PROGRESS,
        "The request is already being processed."
      );
    }

    if (existingData.status === "FAILED") {
      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.REQUEST_FAILED,
        "The previous request with this idempotency key failed."
      );
    }

    throw new IdempotencyError(
      IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE,
      "Unknown idempotency record status."
    );
  }

  private async findRecordByKey(userId: string, operation: string, key: string) {
    const record = await this.store.find(key, operation, userId);

    if (!record) {
      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.RECORD_NOT_FOUND,
        "No idempotency record found."
      );
    }

    return record;
  }

  private async markRecordSuccess(
    userId: string,
    operation: string,
    key: string,
    response: unknown
  ): Promise<void> {
    try {
      await this.store.markSuccess(key, response, userId, operation);
    } catch (error) {
      this.metrics.increment("idempotency_store_errors_total", 1, {
        operation
      });
      if (error instanceof IdempotencyError) {
        throw error;
      }

      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE,
        "Failed to update the record to success."
      );
    }
  }

  private async markRecordProcessing(
    userId: string,
    operation: string,
    key: string
  ): Promise<void> {
    try {
      await this.store.markProcessing(key, operation, userId);
    } catch (error) {
      this.metrics.increment("idempotency_store_errors_total", 1, {
        operation
      });
      if (error instanceof IdempotencyError) {
        throw error;
      }

      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE,
        "Failed to update the record to processing."
      );
    }
  }

  private async markRecordFailed(userId: string, operation: string, key: string): Promise<void> {
    try {
      await this.store.markFailed(key, operation, userId);
    } catch (error) {
      this.metrics.increment("idempotency_store_errors_total", 1, {
        operation
      });
      if (error instanceof IdempotencyError) {
        throw error;
      }

      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE,
        "Failed to update the record to failed."
      );
    }
  }

  private async incrementRetryCount(
    userId: string,
    operation: string,
    key: string
  ): Promise<number> {
    try {
      return await this.store.incrementRetryCount(key, operation, userId);
    } catch (error) {
      this.metrics.increment("idempotency_store_errors_total", 1, {
        operation
      });
      if (error instanceof IdempotencyError) {
        throw error;
      }

      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE,
        "Failed to increment retry count."
      );
    }
  }

  private async deleteRecord(userId: string, operation: string, key: string): Promise<void> {
    try {
      await this.store.delete(key, operation, userId);
    } catch (error) {
      this.metrics.increment("idempotency_store_errors_total", 1, {
        operation
      });
      this.logger.error(
        {
          key,
          userId,
          operation,
          error: error instanceof Error ? error.message : error
        },
        "Failed to delete idempotency record"
      );
    }
  }
}
