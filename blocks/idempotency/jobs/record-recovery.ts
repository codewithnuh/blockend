import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";
import type { Logger, Metrics } from "../interfaces/observability";
import type {
  IdempotencyStore,
  RecoverStuckRecordsOptions,
  RecoveryResult
} from "../interfaces/store";

/**
 * Recovers operations that got stuck in 'PROCESSING' state (e.g., a node
 * crashed mid-execution and never released its lock). Such records are marked
 * 'FAILED' so clients can safely retry or inspect the outcome.
 *
 * RESILIENCE INVARIANT: a single failing `markFailed` call (e.g. a DB hiccup)
 * must not abort recovery of the remaining records — each record is processed
 * independently and the outcome is counted in `failed`.
 *
 * LEASE-RACE WARNING: recovery assumes a PROCESSING record whose `updatedAt` is
 * older than `timeoutInMs` is dead. If a legitimate operation runs LONGER than
 * the timeout (no heartbeat), recovery can mark it FAILED while it is still
 * executing — allowing a retry to re-run it (double execution) and/or losing
 * its result. Mitigations for long-running jobs: (1) keep a heartbeat that
 * touches `updatedAt`; (2) make the store's `markFailed` conditional
 * (`UPDATE ... WHERE status = 'PROCESSING'`) so a just-completed SUCCESS
 * record can never be flipped to FAILED.
 */
export async function recoverStuckRecords(
  store: IdempotencyStore,
  logger: Logger,
  metrics: Metrics,
  {
    timeoutInMs = 5 * 60 * 1000, // 5 minutes threshold by default
    limit = 100
  }: RecoverStuckRecordsOptions = {}
): Promise<RecoveryResult> {
  const cutoffTime = new Date(Date.now() - timeoutInMs);

  const stuckRecords = await store.findAll({
    status: "PROCESSING",
    updatedBefore: cutoffTime,
    limit
  });

  const result: RecoveryResult = {
    processed: stuckRecords.length,
    succeeded: 0,
    failed: 0
  };

  for (const record of stuckRecords) {
    try {
      await markRecordFailed(store, metrics, record.userId, record.operation, record.key);
      result.succeeded++;
    } catch {
      result.failed++;
    }
  }

  metrics.increment("idempotency_recovered_records_total", result.succeeded, {
    status: "success"
  });
  if (result.failed > 0) {
    metrics.increment("idempotency_recovered_records_total", result.failed, {
      status: "failed"
    });
  }

  logger.info(
    {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed
    },
    "Stuck idempotency records recovery completed"
  );

  return result;
}

/**
 * Marks a single record FAILED, translating infrastructure failures into a
 * typed `IdempotencyError` while preserving the original error for
 * `IdempotencyError` cases.
 */
async function markRecordFailed(
  store: IdempotencyStore,
  metrics: Metrics,
  userId: string,
  operation: string,
  key: string
): Promise<void> {
  try {
    await store.markFailed(key, operation, userId);
  } catch (error) {
    metrics.increment("idempotency_store_errors_total", 1, { operation });
    if (error instanceof IdempotencyError) {
      throw error;
    }

    throw new IdempotencyError(
      IDEMPOTENCY_ERROR_CODES.STORE_UNAVAILABLE,
      "Failed to update the record to failed."
    );
  }
}
