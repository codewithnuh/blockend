import type { ErrorCategory, ErrorSeverity } from "../types/index";

export const INTERNAL_ERROR_MESSAGE = "Internal server error";

const STATUS_BY_CATEGORY: Readonly<Record<string, number>> = {
  BAD_REQUEST: 400,
  VALIDATION: 400,
  AUTHENTICATION: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503
};

/** Returns a valid HTTP error status, falling back to category defaults or 500. */
export function resolveStatusCode(statusCode?: number, category?: ErrorCategory): number {
  if (
    statusCode !== undefined &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 599
  ) {
    return statusCode;
  }
  return (category && STATUS_BY_CATEGORY[category]) || 500;
}

/** Infers the closest error category for an HTTP status code. */
export function inferCategory(statusCode: number): ErrorCategory {
  if (statusCode === 400 || statusCode === 422) return "VALIDATION";
  if (statusCode === 401) return "AUTHENTICATION";
  if (statusCode === 403) return "AUTHORIZATION";
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 409) return "CONFLICT";
  if (statusCode === 429) return "RATE_LIMIT";
  if (statusCode === 503) return "SERVICE_UNAVAILABLE";
  if (statusCode >= 500) return "INTERNAL";
  return "BAD_REQUEST";
}

/** Infers whether an HTTP error should be observed as a warning or an error. */
export function inferSeverity(statusCode: number): ErrorSeverity {
  return statusCode >= 500 ? "error" : "warning";
}
