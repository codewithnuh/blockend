// Hono on Node (`@hono/node-server`) runs on a plain Node http server, so the
// generic NodeConnectionTracker attaches to that server and the Node HTTP
// shutdown task closes it. The 503 behaviour is a standard Hono middleware.

import type { Server } from "node:http";
import type { MiddlewareHandler } from "hono";

import type { ShutdownStateProvider, ShutdownTask } from "../types";
import { NodeConnectionTracker } from "../core/connection-tracker";
import { createHttpShutdownTask } from "../utils/http";

// ─── Middleware (503) ─────────────────────────────────────────────────────────

/**
 * Hono middleware that rejects incoming requests with 503 once the
 * application is shutting down.
 *
 * Register it before your routes:
 *   app.use('*', createHonoShutdownMiddleware(shutdown));
 */
export function createHonoShutdownMiddleware(provider: ShutdownStateProvider): MiddlewareHandler {
  return async (c, next) => {
    if (!provider.isShuttingDownState) {
      return next();
    }

    return c.json({ error: "service_unavailable", message: "Server is shutting down" }, 503, {
      Connection: "close",
      "Retry-After": "30"
    });
  };
}

// ─── Tracker factory ──────────────────────────────────────────────────────────

/**
 * Creates and attaches a NodeConnectionTracker to the Node http server that
 * `@hono/node-server` created for a Hono app.
 *
 * Usage:
 *   const server = createServer(getRequestListener(app.fetch));
 *   const tracker = createHonoTracker(server);
 *   const shutdown = new GracefulShutdown({ connectionTracker: tracker });
 */
export function createHonoTracker(server: Server): NodeConnectionTracker {
  return new NodeConnectionTracker().attach(server);
}

// ─── Shutdown task factory ────────────────────────────────────────────────────

/**
 * Creates a shutdown task that closes the Node http server backing a Hono app.
 *
 * IMPORTANT: registering this task is required. A ConnectionTracker only waits
 * for requests to drain; it never closes the server.
 *
 * Usage:
 *   shutdown.addTask(createHonoShutdownTask(server));
 */
export function createHonoShutdownTask(
  server: Server,
  options?: { timeout?: number }
): ShutdownTask {
  return createHttpShutdownTask(server, options);
}
