import { createExpressErrorHandler } from "../adapters/express";
import { createErrorBoundary } from "../core/create-error-boundary";

/** @deprecated Create a boundary and pass it to createExpressErrorHandler. */
export const globalErrorHandler = createExpressErrorHandler(
  createErrorBoundary({
    logger: {
      error: (context, message) => console.error(message, context)
    }
  })
);
