import type { IncomingMessage, Server, ServerResponse } from "node:http";

import { DEFAULT_HTTP_CLOSE_TIMEOUT_MS, PRIORITY } from "../constants";
import type { Node503Options, ShutdownStateProvider, ShutdownTask } from "../types";
import { shouldRejectRequest } from "./state";
import { withTimeout } from "./timeout";

/**
 * Rejects an incoming Node.js HTTP request while the app is shutting down.
 * Returns `true` if the request was handled (rejected), `false` otherwise.
 *
 * Used inside framework adapters, not directly in application code.
 */
export function handleNode503(
  _req: IncomingMessage,
  res: ServerResponse,
  provider: ShutdownStateProvider,
  options?: Node503Options
): boolean {
  if (!shouldRejectRequest(provider)) return false;

  const statusCode = options?.statusCode ?? 503;
  const body =
    typeof options?.body === "string"
      ? options.body
      : JSON.stringify(
          options?.body ?? { error: "service_unavailable", message: "Server is shutting down" }
        );

  res.setHeader("Connection", "close");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Retry-After", "30");

  if (options?.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      res.setHeader(key, value);
    }
  }

  res.statusCode = statusCode;
  res.end(body);
  return true;
}

/**
 * Creates a shutdown task that gracefully closes a Node.js HTTP server.
 *
 * Stops accepting new connections, closes idle keep-alive connections, then
 * waits for active requests to finish (up to the task timeout).
 *
 * Uses `PRIORITY.HTTP_SERVER` (100) so traffic stops before DB pools close.
 */
export function createHttpShutdownTask(
  server: Server,
  options?: { timeout?: number }
): ShutdownTask {
  const timeout = options?.timeout ?? DEFAULT_HTTP_CLOSE_TIMEOUT_MS;
  return {
    name: "http-server",
    priority: PRIORITY.HTTP_SERVER,
    timeout,
    handler: () =>
      // Enforce the deadline here, inside the task itself, so the task stays
      // robust even if it is invoked directly rather than scheduled through
      // GracefulShutdown (its runner also wraps handlers with withTimeout, so
      // this is belt-and-braces rather than duplication).
      withTimeout(
        new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) {
              // ERR_SERVER_NOT_RUNNING means it was already closed — not a real error.
              if ((err as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING") {
                return resolve();
              }
              return reject(err);
            }
            resolve();
          });

          // Close idle keep-alive connections immediately so `close()` resolves
          // faster; an idle connection would otherwise block shutdown for the
          // full timeout.
          if (typeof server.closeIdleConnections === "function") {
            server.closeIdleConnections();
          }
        }),
        timeout,
        "http-server"
      )
  };
}
