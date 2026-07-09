import type { MiddlewareHandler } from "hono";
import { logger, runWithLoggerContext } from "../core.js";

export function honoLoggerAdapter(): MiddlewareHandler {
  return async (c, next) => {
    const rawId = c.req.header("x-request-id");
    const start = performance.now();

    // Wrap the next execution flow in your core ALS context
    await runWithLoggerContext(rawId, async (requestId) => {
      // Attach the generated/incoming ID to Hono's execution context variables
      c.set("requestId", requestId);

      // Continue processing the request chain
      await next();

      // Log response details after execution has completed
      logger.info(
        {
          http: {
            method: c.req.method,
            path: c.req.path,
            statusCode: c.res.status,
            durationMs: Math.round(performance.now() - start)
          }
        },
        `HTTP ${c.req.method} ${c.req.path} completed`
      );
    });
  };
}
