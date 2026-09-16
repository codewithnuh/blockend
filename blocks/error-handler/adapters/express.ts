import type { NextFunction, Request, Response } from "express";
import type { ErrorBoundary, ErrorContextInput } from "../types/index";

interface RequestWithId extends Request {
  id?: string;
}

/** Options for the Express error handler adapter. */
export interface ExpressErrorHandlerOptions {
  getContext?: (request: Request) => ErrorContextInput;
}

function defaultContext(request: RequestWithId): ErrorContextInput {
  const header = request.headers["x-request-id"];
  const headerId = Array.isArray(header) ? header[0] : header;
  return {
    method: request.method,
    path: request.path,
    ...(request.id ? { requestId: request.id } : headerId ? { requestId: headerId } : {})
  };
}

/** Create an Express error-handler middleware backed by an {@link ErrorBoundary}. */
export function createExpressErrorHandler(
  boundary: ErrorBoundary,
  options: ExpressErrorHandlerOptions = {}
) {
  return async (
    error: unknown,
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> => {
    if (response.headersSent) {
      next(error);
      return;
    }
    const context = { ...defaultContext(request), ...options.getContext?.(request) };
    const result = await boundary.handle(error, context);
    response.status(result.statusCode).json(result.body);
  };
}
