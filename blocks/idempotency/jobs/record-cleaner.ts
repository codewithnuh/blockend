import type { Logger, Metrics } from "../interfaces/observability";
import type { IdempotencyStore } from "../interfaces/store";

export type CleanupExpiredOptions = {
  limit?: number;
};

export type CleanupResult = {
  deleted: number;
};

/**
 * Deletes expired idempotency records. Intended to be run periodically by a
 * background worker or cron job.
 *
 * SAFETY INVARIANT: only records with status 'SUCCESS' or 'FAILED' are deleted.
 * Records marked 'PROCESSING' are intentionally excluded here, even if expired:
 * if a long-running job passed its expiry timestamp, purging its lock would let
 * a duplicate incoming request acquire a fresh lock and run concurrently.
 * Active or stuck 'PROCESSING' locks are instead handled by
 * `recoverStuckRecords()` in `jobs/record-recovery`.
 */
export async function cleanupExpiredRecords(
  store: IdempotencyStore,
  logger: Logger,
  metrics: Metrics,
  { limit = 500 }: CleanupExpiredOptions = {}
): Promise<CleanupResult> {
  const now = new Date();

  try {
    const deleted = await store.deleteExpired({
      expiredBefore: now,
      statuses: ["SUCCESS", "FAILED"],
      limit
    });

    metrics.increment("idempotency_cleaned_records_total", deleted);
    logger.info(
      { deleted, expiredBefore: now, limit },
      "Expired idempotency records cleanup completed"
    );

    return { deleted };
  } catch (error) {
    metrics.increment("idempotency_store_errors_total", 1, {
      operation: "cleanup"
    });
    logger.error(
      { error: error instanceof Error ? error.message : error },
      "Failed to clean up expired idempotency records"
    );
    throw error;
  }
}
