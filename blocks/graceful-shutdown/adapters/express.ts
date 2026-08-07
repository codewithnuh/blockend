import type { NextFunction, Request, Response } from "express";
import type { Server } from "node:http";
import type { ShutdownStateProvider, ShutdownTask } from "../types";
import { NodeConnectionTracker } from "../core/connection-tracker";
import { createHttpShutdownTask } from "../utils/http";

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Express middleware that rejects incoming requests with 503
 * when the application is shutting down.
 *
 * Register this as the FIRST middleware — before routes, before auth,
 * before everything. A request that arrives during shutdown should
 * never reach your route handlers.
 *
 * Usage:
 *   app.use(createShutdownMiddleware(shutdown));
 */
export function createShutdownMiddleware(provider: ShutdownStateProvider) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!provider.isShuttingDownState) {
      next();
      return;
    }

    res
      .set("Connection", "close")
      .set("Retry-After", "30")
      .set("Content-Type", "application/json")
      .status(503)
      .json({
        error: "service_unavailable",
        message: "Server is shutting down"
      });
  };
}

// ─── Tracker factory ──────────────────────────────────────────────────────────

/**
 * Creates and attaches a NodeConnectionTracker to an Express server.
 *
 * Call this after createServer() but before server.listen().
 * Pass the returned tracker to GracefulShutdown via the constructor
 * or setConnectionTracker().
 *
 * Usage:
 *   const server = createServer(app);
 *   const tracker = createExpressTracker(server);
 *   const shutdown = new GracefulShutdown({ connectionTracker: tracker });
 */
export function createExpressTracker(server: Server): NodeConnectionTracker {
  return new NodeConnectionTracker().attach(server);
}

// ─── Shutdown task factory ────────────────────────────────────────────────────

/**
 * Convenience re-export — Express uses the standard Node HTTP shutdown task.
 * No Express-specific logic needed here because server.close() works the same.
 *
 * IMPORTANT: registering this task is required. A ConnectionTracker only waits
 * for requests to drain; it never closes the server. Without this task the
 * listen handle stays alive and the process never exits.
 *
 * Usage:
 *   shutdown.addTask(createExpressShutdownTask(server));
 */
export function createExpressShutdownTask(
  server: Server,
  options?: { timeout?: number }
): ShutdownTask {
  // Express doesn't need anything beyond the base Node HTTP task.
  // This re-export exists so adapter users import from one place.
  return createHttpShutdownTask(server, options);
}
