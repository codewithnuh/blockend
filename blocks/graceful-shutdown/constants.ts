/**
 * Centralised defaults and suggested priority levels.
 *
 * Keeping them here lets callers tune behaviour and guarantees the core and its
 * utilities never drift out of sync.
 */

/** Priority used when a task does not specify one. */
export const DEFAULT_PRIORITY = 50;

/** Hard kill timeout — process exits regardless once this elapses. */
export const DEFAULT_HARD_TIMEOUT_MS = 30_000;

/** Default per-task timeout when `task.timeout` is not set. */
export const DEFAULT_TASK_TIMEOUT_MS = 10_000;

/** Default timeout for waiting on active connections to drain. */
export const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;

/** HTTP servers need more time to drain active requests than most tasks. */
export const DEFAULT_HTTP_CLOSE_TIMEOUT_MS = 15_000;

/** How often `waitForDrain` polls whether requests have finished. */
export const DRAIN_POLL_INTERVAL_MS = 50;

/**
 * Suggested priority levels. Higher values run first.
 *
 * The ordering is deliberate: stop accepting new work before flushing the
 * resources that depend on it.
 */
export const PRIORITY = {
  /** HTTP servers — stop traffic first. */
  HTTP_SERVER: 100,
  /** Message queue consumers — stop consuming before flushing. */
  QUEUE_CONSUMER: 80,
  /** Job queues / workers. */
  JOB_QUEUE: 60,
  /** Database connection pools. */
  DB_POOL: 40,
  /** Caches (Redis etc.). */
  CACHE: 20,
  /** Loggers / telemetry — flush last so we keep logs from everything above. */
  LOGGERS: 10
} as const;
