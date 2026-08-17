import type { CreateRecordResult, IdempotencyRecord } from "../types/index";

export interface FindAllFilters {
  status?: "PROCESSING" | "SUCCESS" | "FAILED";
  updatedBefore?: Date;
  limit?: number;
}

export interface RecoverStuckRecordsOptions {
  timeoutInMs?: number;
  limit?: number;
}

export interface RecoveryResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export interface DeleteExpiredParams {
  /** Cutoff timestamp; purge rows where expires_at < expiredBefore */
  expiredBefore: Date;
  /**
   * Only delete non-active records (SUCCESS/FAILED).
   * Excludes PROCESSING records to prevent deleting active locks during long jobs.
   */
  statuses: Array<"SUCCESS" | "FAILED">;
  /** Optional batch limit to prevent database lock escalation during cleanup */
  limit?: number;
}

export interface IdempotencyStore {
  create(record: IdempotencyRecord): Promise<CreateRecordResult>;

  find(key: string, operation: string, userId: string): Promise<IdempotencyRecord | null>;

  /** Query records with optional filtering for background jobs or adapters */
  findAll(filters?: FindAllFilters): Promise<IdempotencyRecord[]>;

  markSuccess(key: string, response: unknown, userId: string, operation: string): Promise<void>;

  markProcessing(key: string, operation: string, userId: string): Promise<void>;

  markFailed(key: string, operation: string, userId: string): Promise<void>;

  /**
   * Increments the retry counter for a key and returns the updated count.
   *
   * CONTRACT: the counter MUST survive record deletion. The handler deletes a
   * record after a transient failure (so the client can retry) and then
   * creates a fresh one on the next attempt — if the counter lived on the row
   * and reset on re-creation, `MAX_ALLOWED_RETRIES` would never be reached and
   * the key would never be poisoned. Implementations should keep the count in
   * a location that outlives the row (e.g. a dedicated counter table/column
   * upserted by key, never reset on re-create).
   */
  incrementRetryCount(key: string, operation: string, userId: string): Promise<number>;

  /** Deletes/releases an idempotency record (e.g., after a transient error) */
  delete(key: string, operation: string, userId: string): Promise<void>;

  /**
   * Deletes expired records matching specific status conditions.
   * Returns the count of deleted rows.
   */
  deleteExpired(params: DeleteExpiredParams): Promise<number>;
}
