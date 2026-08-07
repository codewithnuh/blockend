// Fastify is built directly on the Node http server, so the generic
// NodeConnectionTracker can attach to `fastify.server`. The 503 behaviour is
// wired through an onRequest hook (it must be registered before listen()).

import type { FastifyInstance } from "fastify";

import { DEFAULT_HTTP_CLOSE_TIMEOUT_MS, PRIORITY } from "../constants";
import type { ShutdownStateProvider, ShutdownTask } from "../types";
import { NodeConnectionTracker } from "../core/connection-tracker";

// ─── Tracker factory ──────────────────────────────────────────────────────────

/**
 * Creates and attaches a NodeConnectionTracker to a Fastify instance.
 *
 * Fastify wraps a Node http server (`fastify.server`), so the same request /
 * finish / close events drive the in-flight counter.
 *
 * Usage:
 *   const tracker = createFastifyTracker(fastify);
 *   const shutdown = new GracefulShutdown({ connectionTracker: tracker });
 */
export function createFastifyTracker(fastify: FastifyInstance): NodeConnectionTracker {
  return new NodeConnectionTracker().attach(fastify.server);
}

// ─── Shutdown hook (503) ──────────────────────────────────────────────────────

/**
 * Registers an `onRequest` hook that rejects new requests with 503 once the
 * application is shutting down.
 *
 * Must be called BEFORE `fastify.listen()`.
 *
 * Alternative (built into Fastify): call
 * `await fastify.listen({ port, return503OnClosing: true })` — that returns 503
 * only while `fastify.close()` is running. This hook covers the larger window
 * from when `shutdown()` starts until the server actually closes.
 *
 * Usage:
 *   registerFastifyShutdownHooks(fastify, shutdown);
 */
export function registerFastifyShutdownHooks(
  fastify: FastifyInstance,
  provider: ShutdownStateProvider
): void {
  fastify.addHook("onRequest", async (_request, reply) => {
    if (provider.isShuttingDownState) {
      return reply
        .code(503)
        .header("Connection", "close")
        .header("Retry-After", "30")
        .type("application/json")
        .send({ error: "service_unavailable", message: "Server is shutting down" });
    }
  });
}

// ─── Shutdown task factory ────────────────────────────────────────────────────

/**
 * Creates a shutdown task that gracefully closes a Fastify instance.
 *
 * `fastify.close()` stops accepting connections and waits for in-flight
 * requests and onClose hooks to finish. Idle keep-alive connections are closed
 * first so `close()` does not block on them.
 *
 * IMPORTANT: registering this task is required. A ConnectionTracker only waits
 * for requests to drain; it never closes the server.
 *
 * Usage:
 *   shutdown.addTask(createFastifyShutdownTask(fastify));
 */
export function createFastifyShutdownTask(
  fastify: FastifyInstance,
  options?: { timeout?: number }
): ShutdownTask {
  return {
    name: "fastify-server",
    priority: PRIORITY.HTTP_SERVER,
    timeout: options?.timeout ?? DEFAULT_HTTP_CLOSE_TIMEOUT_MS,
    handler: async () => {
      // Release idle keep-alive sockets so close() resolves promptly.
      if (typeof fastify.server.closeIdleConnections === "function") {
        fastify.server.closeIdleConnections();
      }

      try {
        await fastify.close();
      } catch (err) {
        // Already closed is not an error.
        if ((err as NodeJS.ErrnoException)?.code === "ERR_SERVER_NOT_RUNNING") {
          return;
        }
        throw err;
      }
    }
  };
}
