import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ErrorBoundary, ErrorContextInput } from "../types/index";

/** Options for the Fastify error handler adapter. */
export interface FastifyErrorHandlerOptions {
  getContext?: (request: FastifyRequest) => ErrorContextInput;
}

/** Register a Fastify error handler backed by an {@link ErrorBoundary}. */
export function registerFastifyErrorHandler(
  app: FastifyInstance,
  boundary: ErrorBoundary,
  options: FastifyErrorHandlerOptions = {}
): void {
  app.setErrorHandler(async (error, request, reply) => {
    const customContext = options.getContext?.(request);

    const context = {
      ...customContext,
      requestId: request.id,
      method: request.method,
      path: (request.url ?? "").split("?")[0] ?? ""
    };

    const result = await boundary.handle(error, context);

    return reply.status(result.statusCode).send(result.body);
  });
}
