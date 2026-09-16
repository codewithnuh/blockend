import type { AppErrorOptions, ClassifiedError, ErrorClassifier } from "../types/index";
import { AppError } from "./app-error";
import { inferCategory, inferSeverity, resolveStatusCode } from "./defaults";
import type { NormalizedInput } from "./normalize";

/** Converts an application error into the boundary's framework-neutral representation. */
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

/** Classifies an unrecognized thrown value as a non-operational internal error. */
function unknownError(input: NormalizedInput): ClassifiedError {
  const raw = input.raw as Record<string, unknown> | undefined;
  const rawStatus = raw && typeof raw === "object" ? (raw.status ?? raw.statusCode) : undefined;
  const statusCode =
    typeof rawStatus === "number" &&
    Number.isInteger(rawStatus) &&
    rawStatus >= 400 &&
    rawStatus <= 599
      ? rawStatus
      : 500;

  return {
    name: input.error.name,
    code: "INTERNAL_SERVER_ERROR",
    message: input.error.message,
    statusCode,
    category: statusCode === 500 ? "INTERNAL" : inferCategory(statusCode),
    severity: inferSeverity(statusCode),
    isOperational: false,
    ...(input.error.stack === undefined ? {} : { stack: input.error.stack }),
    ...(input.error.cause === undefined ? {} : { cause: input.error.cause })
  };
}

/** Applies safe status, category, and severity defaults to a custom classification. */
function normalizeClassifierResult(options: AppErrorOptions): AppError {
  const statusCode = resolveStatusCode(options.statusCode, options.category);
  return new AppError({
    ...options,
    statusCode,
    category: options.category ?? inferCategory(statusCode),
    severity: options.severity ?? inferSeverity(statusCode)
  });
}

/** Classify a normalized error using an optional custom classifier, falling back to unknownError. */
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
