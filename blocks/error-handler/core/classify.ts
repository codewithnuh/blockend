import type { AppErrorOptions, ClassifiedError, ErrorClassifier } from "../types/index";
import { AppError } from "./app-error";
import { inferCategory, inferSeverity, resolveStatusCode } from "./defaults";
import type { NormalizedInput } from "./normalize";

function toClassifiedError(error: AppError): ClassifiedError {
  return {
    name: error.name,
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    category: error.category,
    severity: error.severity,
    isOperational: error.isOperational,
    ...(error.stack === undefined ? {} : { stack: error.stack }),
    ...(error.cause === undefined ? {} : { cause: error.cause }),
    ...(error.metadata === undefined ? {} : { metadata: error.metadata }),
    ...(error.details === undefined ? {} : { details: error.details })
  };
}

function unknownError(input: NormalizedInput): ClassifiedError {
  return {
    name: input.error.name,
    code: "INTERNAL_SERVER_ERROR",
    message: input.error.message,
    statusCode: 500,
    category: "INTERNAL",
    severity: "error",
    isOperational: false,
    ...(input.error.stack === undefined ? {} : { stack: input.error.stack }),
    ...(input.error.cause === undefined ? {} : { cause: input.error.cause })
  };
}

function normalizeClassifierResult(options: AppErrorOptions): AppError {
  const statusCode = resolveStatusCode(options.statusCode, options.category);
  return new AppError({
    ...options,
    statusCode,
    category: options.category ?? inferCategory(statusCode),
    severity: options.severity ?? inferSeverity(statusCode)
  });
}

export function classifyError(
  input: NormalizedInput,
  classifier?: ErrorClassifier
): ClassifiedError {
  if (input.raw instanceof AppError) return toClassifiedError(input.raw);

  if (classifier) {
    try {
      const result = classifier(input.raw);
      if (result) return toClassifiedError(normalizeClassifierResult(result));
    } catch {
      // An extension failure must not break the boundary.
    }
  }

  return unknownError(input);
}
