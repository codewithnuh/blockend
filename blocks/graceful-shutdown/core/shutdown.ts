import { EventEmitter } from "node:events";

import {
  DEFAULT_DRAIN_TIMEOUT_MS,
  DEFAULT_HARD_TIMEOUT_MS,
  DEFAULT_PRIORITY,
  DEFAULT_TASK_TIMEOUT_MS
} from "../constants";
import { withTimeout } from "../utils/index";
import type { ConnectionTracker } from "../types";
import type {
  GracefulShutdownOptions,
  ShutdownReason,
  ShutdownResult,
  ShutdownStateProvider,
  ShutdownTask,
  TaskFailure
} from "../types";

/**
 * Coordinates and executes the cleanup tasks that run on shutdown.
 *
 * Emits lifecycle events: `beforeShutdown`, `draining`, `drained`,
 * `drainTimeout`, and `afterShutdown`.
 *
 * Lifecycle:
 *   1. `beforeShutdown` — listeners stop starting new work.
 *   2. Drain active connections (if a tracker is configured) — in-flight
 *      requests keep their resources until they finish.
 *   3. Run registered tasks in priority order (highest first).
 *   4. `afterShutdown` — with the aggregate result.
 *
 * A hard timeout (unconfigurable to disable) forces `process.exit(1)` if the
 * whole run exceeds `hardTimeoutMs`.
 */
export class GracefulShutdown extends EventEmitter implements ShutdownStateProvider {
  // States
  private _isShuttingDown = false;
  private shutdownPromise: Promise<ShutdownResult> | null = null;

  // Configuration
  private readonly hardTimeoutMs: number;
  private readonly defaultTaskTimeoutMs: number;
  private readonly stopOnError: boolean;
  private readonly onTaskComplete?: GracefulShutdownOptions["onTaskComplete"];
  private readonly connectionTracker: ConnectionTracker | undefined;
  private readonly drainTimeoutMs: number;

  // Registry
  private tasks: Map<string, ShutdownTask> = new Map();

  constructor(options: GracefulShutdownOptions = {}) {
    super();
    this.hardTimeoutMs = options.hardTimeoutMs ?? DEFAULT_HARD_TIMEOUT_MS;
    this.defaultTaskTimeoutMs = options.defaultTaskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
    this.stopOnError = options.stopOnError ?? false;
    this.onTaskComplete = options.onTaskComplete;
    this.connectionTracker = options.connectionTracker;
    this.drainTimeoutMs = options.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS;

    // Disable signal handling when the caller invokes shutdown() manually
    // (e.g. in tests, or when the app provides its own signal wiring).
    if (options.installSignalHandlers !== false) {
      this._installSignalHandlers();
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** `true` while the application is shutting down. Used by readiness probes. */
  get isShuttingDownState(): boolean {
    return this._isShuttingDown;
  }

  /**
   * Register a shutdown task. Tasks with the same name replace existing ones.
   *
   * If shutdown has already started, the task runs immediately instead.
   */
  addTask(task: ShutdownTask): this {
    if (this._isShuttingDown) {
      console.warn(
        `[shutdown] Task "${task.name}" added after shutdown started — running immediately`
      );
      Promise.resolve(task.handler()).catch((err) =>
        console.error(`[shutdown] Immediate task "${task.name}" failed:`, err)
      );
      return this;
    }

    this.tasks.set(task.name, task);
    return this;
  }

  /**
   * Remove a previously registered task by name. Returns `true` if it existed.
   */
  removeTask(name: string): boolean {
    return this.tasks.delete(name);
  }

  /** Returns registered task names, ordered highest priority first. */
  getTaskNames(): string[] {
    return [...this.tasks.values()]
      .sort((a, b) => (b.priority ?? DEFAULT_PRIORITY) - (a.priority ?? DEFAULT_PRIORITY))
      .map((task) => task.name);
  }

  /**
   * Start (or resume) a graceful shutdown.
   *
   * Idempotent — every caller receives the exact same in-flight result promise,
   * identical by reference. Concurrent callers can race to trigger shutdown and
   * all await the same run.
   *
   * Deliberately NOT `async`: an `async` function wraps the value it returns in
   * a fresh adapter promise, which would break reference identity and make the
   * second call return a different object than the first.
   */
  shutdown(reason: ShutdownReason = "manual"): Promise<ShutdownResult> {
    // Each caller shares the same promise, so shutdown runs exactly once.
    if (this.shutdownPromise) return this.shutdownPromise;

    this._isShuttingDown = true;
    const startMs = Date.now();
    console.info(`[shutdown] Starting graceful shutdown. Reason: ${reason}`);

    // Reserve the shared promise NOW so any re-entrant call — e.g. from a
    // beforeShutdown listener emitted below — receives the same run instead of
    // recursively starting a second one.
    let finish!: (result: ShutdownResult) => void;
    let fail!: (err: unknown) => void;
    const reserved = new Promise<ShutdownResult>((res, rej) => {
      finish = res;
      fail = rej;
    });
    this.shutdownPromise = reserved;

    // Hard timeout — last resort. Cannot be disabled.
    const hardTimer = setTimeout(() => {
      console.error(`[shutdown] Hard timeout of ${this.hardTimeoutMs}ms exceeded. Forcing exit.`);
      process.exit(1);
    }, this.hardTimeoutMs);
    hardTimer.unref(); // Don't keep the event loop alive if we finish first.

    // Defer everything that can throw (listeners, draining, tasks) into an
    // async runner so any failure settles the shared `reserved` promise. This
    // keeps `shutdown()` a plain synchronous function that hands every caller
    // the exact same promise object — the property both idempotency and
    // re-entrancy rely on.
    void (async () => {
      try {
        // Allow listeners to do pre-shutdown work (e.g. stop cron jobs) BEFORE
        // we begin draining.
        this.emit("beforeShutdown", reason);
        // Kick off the drain + task sequence and settle the reserved promise
        // with its outcome, clearing the hard timer when it completes.
        finish(await this._performShutdown(startMs));
      } catch (err) {
        fail(err);
      } finally {
        clearTimeout(hardTimer);
      }
    })();

    return this.shutdownPromise;
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  /** Drain active connections, then run registered tasks. */
  private async _performShutdown(startMs: number): Promise<ShutdownResult> {
    // Drain step — skipped entirely if no tracker is configured.
    // Connections are drained FIRST so the resources (DB, cache) they may be
    // using are still alive until every in-flight request has finished.
    if (this.connectionTracker) {
      this.emit("draining");
      try {
        await this.connectionTracker.waitForDrain(this.drainTimeoutMs);
        this.emit("drained");
      } catch {
        // Drain timed out — log and continue; tasks still need to run.
        console.warn("[shutdown] Connection drain timed out — proceeding to tasks");
        this.emit("drainTimeout");
      }
    }

    // Stop the server and run the remaining registered tasks.
    return this._runTasks(startMs);
  }

  /** Run all registered tasks in priority order, collecting results. */
  private async _runTasks(startMs: number): Promise<ShutdownResult> {
    const completed: string[] = [];
    const failed: TaskFailure[] = [];

    const sorted = [...this.tasks.values()].sort(
      (a, b) => (b.priority ?? DEFAULT_PRIORITY) - (a.priority ?? DEFAULT_PRIORITY)
    );

    for (const task of sorted) {
      const taskStart = Date.now();
      const timeout = task.timeout ?? this.defaultTaskTimeoutMs;

      try {
        await withTimeout(Promise.resolve(task.handler()), timeout, task.name);
        const duration = Date.now() - taskStart;
        completed.push(task.name);
        this.onTaskComplete?.(task.name, duration);
        console.info(`[shutdown] Task "${task.name}" completed in ${duration}ms`);
      } catch (err) {
        const duration = Date.now() - taskStart;
        const error = err instanceof Error ? err : new Error(String(err));
        failed.push({ name: task.name, error });
        this.onTaskComplete?.(task.name, duration, error);
        console.error(`[shutdown] Task "${task.name}" failed after ${duration}ms:`, error.message);

        if (this.stopOnError) {
          console.error(`[shutdown] stopOnError=true — aborting remaining tasks`);
          break;
        }
      }
    }

    const result: ShutdownResult = {
      success: failed.length === 0,
      completed,
      failed,
      durationMs: Date.now() - startMs
    };

    // Emit after all tasks, whether successful or not.
    this.emit("afterShutdown", result);
    console.info(
      `[shutdown] Complete. ${completed.length} succeeded, ${failed.length} failed. Total: ${result.durationMs}ms`
    );

    return result;
  }

  /**
   * Install OS signal handlers. Called once at construction, unless
   * `installSignalHandlers: false`.
   *
   * `uncaughtException` / `unhandledRejection` are intentionally NOT handled
   * here — those are application-level concerns. Handle them in your app entry
   * point, then call `shutdown('uncaughtException')`.
   */
  private _installSignalHandlers(): void {
    const handle = (signal: ShutdownReason) => {
      // If shutdown is already underway, a further signal means "hurry up": the
      // first signal starts a graceful drain, any subsequent signal forces exit
      // so a stuck process can never outlive the caller's patience forever.
      if (this._isShuttingDown) {
        console.error(`[shutdown] Second signal (${signal}) — forcing immediate exit.`);
        process.exit(1);
        return;
      }

      console.info(`[shutdown] Signal received: ${signal}`);
      this.shutdown(signal)
        .then((result) => process.exit(result.success ? 0 : 1))
        .catch((err) => {
          console.error("[shutdown] Unexpected error during shutdown:", err);
          process.exit(1);
        });
    };

    // `on` (not `once`) so a repeated signal is still observed and can force exit.
    process.on("SIGTERM", () => handle("SIGTERM"));
    process.on("SIGINT", () => handle("SIGINT"));
    process.on("SIGQUIT", () => handle("SIGQUIT"));
  }
}

/**
 * Pre-built singleton for apps that need a single shutdown manager.
 *
 * Note: a singleton carries global state. Prefer creating a fresh
 * `GracefulShutdown` per process so tests and workers stay isolated.
 */
export const gracefulShutdown = new GracefulShutdown();
