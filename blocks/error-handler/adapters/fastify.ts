import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ErrorBoundary, ErrorContextInput } from "../types/index";

export interface FastifyErrorHandlerOptions {
  getContext?: (request: FastifyRequest) => ErrorContextInput;
}

/** Registers a Fastify error handler backed by the provided error boundary. */
export function registerFastifyErrorHandler(
  app: FastifyInstance,
  boundary: ErrorBoundary,
  options: FastifyErrorHandlerOptions = {}
): void {
  app.setErrorHandler(async (error, request, reply) => {
    const context = {
      requestId: request.id,
      method: request.method,
      path: request.url,
      ...options.getContext?.(request)
    };
    const result = await boundary.handle(error, context);
    return reply.status(result.statusCode).send(result.body);
  });
}
