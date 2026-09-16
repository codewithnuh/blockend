import type { Context, Env, ErrorHandler, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErrorBoundary, ErrorContextInput } from "../types/index";

export interface HonoErrorHandlerOptions<E extends Env = Env> {
  getContext?: (context: Context<E>) => ErrorContextInput;
}

/** Reads a request ID from Hono variables or the incoming request header. */
function requestIdFromContext<E extends Env>(context: Context<E>): string | undefined {
  const contextId = (context.var as Record<string, unknown>).requestId;
  if (typeof contextId === "string") return contextId;
  return context.req.header("x-request-id");
}

/** Creates a Hono error handler that delegates serialization to a boundary. */
export function createHonoErrorHandler<E extends Env = Env>(
  boundary: ErrorBoundary,
  options: HonoErrorHandlerOptions<E> = {}
): ErrorHandler<E> {
  return async (error, context) => {
    const requestId = requestIdFromContext(context);
    const errorContext = {
      method: context.req.method,
      path: context.req.path,
      ...(requestId === undefined ? {} : { requestId }),
      ...options.getContext?.(context)
    };
    const result = await boundary.handle(error, errorContext);
    return context.json(result.body, result.statusCode as ContentfulStatusCode);
  };
}

/** Registers a boundary-backed error handler on a Hono application. */
export function registerHonoErrorHandler<E extends Env>(
  app: Hono<E>,
  boundary: ErrorBoundary,
  options: HonoErrorHandlerOptions<E> = {}
): void {
  app.onError(createHonoErrorHandler(boundary, options));
}
