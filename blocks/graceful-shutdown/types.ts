/**
 * Shared types and contracts for the graceful-shutdown block.
 */

// ─── Tasks ────────────────────────────────────────────────────────────────────

/** A function that performs part of the cleanup. May be sync or async. */
export type ShutdownHandler = () => Promise<void> | void;

/**
 * The reason a shutdown was triggered. Free-form strings are allowed so callers
 * can use custom reasons, e.g. `'deploy'`.
 */
export type ShutdownReason =
  | "SIGTERM"
  | "SIGINT"
  | "SIGQUIT"
  | "uncaughtException"
  | "unhandledRejection"
  | "manual"
  | (string & {});

/** A single unit of cleanup work registered against the shutdown manager. */
export interface ShutdownTask {
  /** Human-readable name, used in logs and results. Should be unique. */
  name: string;
  /** The cleanup work to run. */
  handler: ShutdownHandler;
  /** Per-task timeout in ms. Overrides `defaultTaskTimeoutMs`. */
  timeout?: number;
  /**
   * Higher = runs first. See {@link PRIORITY} for suggested conventions,
   * e.g. `PRIORITY.HTTP_SERVER` (100).
   */
  priority?: number;
}

/** A task that failed during shutdown, together with the error it threw. */
export interface TaskFailure {
  name: string;
  error: Error;
}

/** The final, aggregate outcome of a shutdown run. */
export interface ShutdownResult {
  /** `true` when no task failed. */
  success: boolean;
  /** Names of tasks that completed successfully. */
  completed: string[];
  /** Tasks that threw an error or timed out. */
  failed: TaskFailure[];
  /** Total time taken to run the tasks, in ms. */
  durationMs: number;
}

// ─── Shutdown state ───────────────────────────────────────────────────────────

/** Any object that exposes the current shutdown status, for observability. */
export interface ShutdownStateProvider {
  /** `true` while the application is shutting down. Used by readiness probes. */
  readonly isShuttingDownState: boolean;
}

// ─── Options ──────────────────────────────────────────────────────────────────

/** Options accepted by `GracefulShutdown`. */
export interface GracefulShutdownOptions {
  /** Hard kill timeout. After this, `process.exit(1)` fires regardless. Default: 30s */
  hardTimeoutMs?: number;
  /** Default per-task timeout if `task.timeout` is not set. Default: 10s */
  defaultTaskTimeoutMs?: number;
  /** If `true`, stop running tasks on the first failure. Default: `false` */
  stopOnError?: boolean;
  /**
   * If `true`, register SIGTERM/SIGINT/SIGQUIT handlers automatically.
   * Set to `false` to call `shutdown()` manually (e.g. in tests). Default: `true`
   */
  installSignalHandlers?: boolean;
  /**
   * Called when a task completes or fails. Use for metrics/observability,
   * e.g. recording task duration to Prometheus.
   */
  onTaskComplete?: (name: string, durationMs: number, error?: Error) => void;
  /** Optional connection tracker the shutdown waits on before running tasks. */
  connectionTracker?: ConnectionTracker;
  /** How long to wait for active connections to drain. Default: 10s */
  drainTimeoutMs?: number;
}

// ─── HTTP 503 helper ──────────────────────────────────────────────────────────

/** Options for the `handleNode503` request-interception helper. */
export interface Node503Options {
  /** HTTP status code returned. Default: `503`. */
  statusCode?: number;
  /** Response body. Objects are JSON-serialised. Default: a JSON error body. */
  body?: Record<string, unknown> | string;
  /** Additional response headers to set. */
  headers?: Record<string, string | number | readonly string[]>;
}

// ─── Connection tracker ───────────────────────────────────────────────────────

/**
 * The contract an in-flight-request tracker must fulfill.
 *
 * The shutdown manager depends on this interface only — never on a concrete
 * implementation.
 */
export interface ConnectionTracker {
  /**
   * Current number of requests that have started but not yet finished.
   *
   * Readonly — only the tracker itself mutates it. External code reads it for
   * observability (metrics, logging, health checks).
   */
  readonly activeCount: number;

  /**
   * Resolves when `activeCount` reaches `0`, or rejects if that has not
   * happened within `timeoutMs`. Resolves immediately if already drained.
   *
   * @param timeoutMs How long to wait before giving up.
   */
  waitForDrain(timeoutMs: number): Promise<void>;
}

/**
 * Optional extension for trackers that attach to and detach from a server.
 *
 * Not required by the core, but useful for adapters that need explicit
 * lifecycle control (e.g. `NodeConnectionTracker`).
 */
export interface AttachableConnectionTracker extends ConnectionTracker {
  /**
   * Attach the tracker to a server instance. Must be called before the server
   * starts accepting requests. Returns `this` for fluent chaining.
   */
  attach(server: unknown): this;
  /** Detach from the server. Implement when secure reuse across tests is needed. */
  detach?(): void;
}
