import type { NextFunction, Request, Response } from "express";
import type { ErrorBoundary, ErrorContextInput } from "../types/index";

interface RequestWithId extends Request {
  id?: string;
}

export interface ExpressErrorHandlerOptions {
  getContext?: (request: Request) => ErrorContextInput;
}

/** Extracts the standard error context available on an Express request. */
function defaultContext(request: RequestWithId): ErrorContextInput {
  const header = request.headers["x-request-id"];
  const headerId = Array.isArray(header) ? header[0] : header;
  return {
    method: request.method,
    path: request.path,
    ...(request.id ? { requestId: request.id } : headerId ? { requestId: headerId } : {})
  };
}

/** Creates Express error middleware that delegates response handling to a boundary. */
export function createExpressErrorHandler(
  boundary: ErrorBoundary,
  options: ExpressErrorHandlerOptions = {}
) {
  return async (
    error: unknown,
    request: Request,
    response: Response,
    // oxlint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
  ): Promise<void> => {
    const context = { ...defaultContext(request), ...options.getContext?.(request) };
    const result = await boundary.handle(error, context);
    response.status(result.statusCode).json(result.body);
  };
}
