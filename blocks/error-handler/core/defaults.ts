import type { ErrorCategory, ErrorSeverity } from "../types/index";

/** Sentinel message used for non-operational errors in client responses. */
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

/** Return a valid 4xx/5xx status from an explicit code, category mapping, or 500 fallback. */
export function resolveStatusCode(statusCode?: number, category?: ErrorCategory): number {
  if (
    statusCode !== undefined &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 599
  ) {
    return statusCode;
  }
  if (category !== undefined && Object.hasOwn(STATUS_BY_CATEGORY, category)) {
    return STATUS_BY_CATEGORY[category] ?? 500;
  }
  return 500;
}

/** Derive an {@link ErrorCategory} from an HTTP status code. */
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

/** Map a status code to a severity level: 5xx = error, 4xx = warning. */
export function inferSeverity(statusCode: number): ErrorSeverity {
  return statusCode >= 500 ? "error" : "warning";
}
