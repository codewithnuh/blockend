import type {
  ClassifiedError,
  CreateErrorBoundaryOptions,
  ErrorBoundary,
  ErrorContext,
  ErrorEvent
} from "../types/index";
import { classifyError } from "./classify";
import { enrichErrorContext } from "./context";
import { normalizeError } from "./normalize";
import { sanitizeErrorData } from "./sanitize";
import { serializeErrorResponse } from "./serialize";

/** Builds the sanitized event shape shared by logging and reporting hooks. */
function createEvent(error: ClassifiedError, context: ErrorContext): ErrorEvent {
  return {
    error: {
      name: error.name,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      category: error.category,
      severity: error.severity,
      isOperational: error.isOperational,
      ...(error.stack === undefined ? {} : { stack: error.stack }),
      ...(error.cause === undefined ? {} : { cause: error.cause }),
      ...(error.metadata === undefined ? {} : { metadata: error.metadata })
    },
    context
  };
}

/** Create a framework-agnostic error boundary with optional logger, reporter, and classifier. */
export function createErrorBoundary(options: CreateErrorBoundaryOptions = {}): ErrorBoundary {
  const serializer = options.serializer ?? serializeErrorResponse;
  const sensitiveKeys = options.sensitiveKeys ?? [];

  return {
    async handle(error, contextInput = {}) {
      const normalized = normalizeError(error);
      const classified = classifyError(normalized, options.classifier);
      const context = sanitizeErrorData(enrichErrorContext(contextInput), sensitiveKeys);
      const safeError = sanitizeErrorData(classified, sensitiveKeys);
      const event = sanitizeErrorData(createEvent(safeError, context), sensitiveKeys);

      if (options.logger) {
        try {
          options.logger.error(event as unknown as Record<string, unknown>, "Application error");
        } catch {
          // Logging must not change the response path.
        }
      }

      if (options.reporter) {
        try {
          await options.reporter.report(event);
        } catch {
          // Reporting must not replace the application error.
        }
      }

      let body;
      try {
        body = serializer(safeError, context);
      } catch {
        body = serializeErrorResponse(safeError, context);
      }

      return {
        statusCode: safeError.isOperational ? safeError.statusCode : 500,
        body
      };
    }
  };
}
