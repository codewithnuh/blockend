import { createExpressErrorHandler } from "../adapters/express";
import { createErrorBoundary } from "../core/create-error-boundary";
import type { AppErrorOptions } from "../types/index";

function classifyZodError(error: unknown): AppErrorOptions | null {
  if (
    error !== null &&
    typeof error === "object" &&
    (error as { name?: string }).name === "ZodError" &&
    Array.isArray((error as { issues?: unknown[] }).issues)
  ) {
    return {
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      statusCode: 400,
      category: "VALIDATION",
      isOperational: true
    };
  }
  return null;
}

/** @deprecated Create a boundary and pass it to createExpressErrorHandler. */
export const globalErrorHandler = createExpressErrorHandler(
  createErrorBoundary({
    // oxlint-disable-next-line no-console
    logger: { error: (ctx, msg) => console.error(msg, ctx) },
    classifier: classifyZodError
  })
);
