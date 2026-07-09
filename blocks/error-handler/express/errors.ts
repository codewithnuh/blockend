import { HTTP_STATUS } from "./http-status.js";

/**
 * Common error catalog. Use with `throwError(ERRORS.NOT_FOUND)` or
 * reference `.message` / `.status` directly when building your own AppError.
 *
 * This is a starting set, not an exhaustive one — add your own entries
 * as your domain needs them. It's your file now.
 */
export const ERRORS = {
  VALIDATION_FAILED: {
    message: "Validation failed",
    status: HTTP_STATUS.BAD_REQUEST
  },
  BAD_REQUEST: {
    message: "Bad request",
    status: HTTP_STATUS.BAD_REQUEST
  },
  INVALID_CREDENTIALS: {
    message: "Invalid credentials",
    status: HTTP_STATUS.UNAUTHORIZED
  },
  UNAUTHORIZED: {
    message: "Unauthorized access",
    status: HTTP_STATUS.UNAUTHORIZED
  },
  FORBIDDEN: {
    message: "You do not have permission to perform this action",
    status: HTTP_STATUS.FORBIDDEN
  },
  TOKEN_EXPIRED: {
    message: "Session expired. Please log in again.",
    status: HTTP_STATUS.UNAUTHORIZED
  },
  INVALID_TOKEN: {
    message: "Invalid token",
    status: HTTP_STATUS.UNAUTHORIZED
  },
  TOKEN_TYPE_MISMATCH: {
    message: "Token type mismatch",
    status: HTTP_STATUS.UNAUTHORIZED
  },
  TOKEN_REVOKED: {
    message: "Token has been revoked",
    status: HTTP_STATUS.UNAUTHORIZED
  },
  NOT_FOUND: {
    message: "Not found",
    status: HTTP_STATUS.NOT_FOUND
  },
  USER_ALREADY_EXISTS: {
    message: "User already exists",
    status: HTTP_STATUS.CONFLICT
  },
  DUPLICATE_RESOURCE: {
    message: "Resource already exists",
    status: HTTP_STATUS.CONFLICT
  },
  UNPROCESSABLE: {
    message: "Unable to process the request",
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY
  },
  INTERNAL_SERVER_ERROR: {
    message: "Internal server error",
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR
  },
  SERVICE_UNAVAILABLE: {
    message: "Service temporarily unavailable",
    status: HTTP_STATUS.SERVICE_UNAVAILABLE
  }
} as const;

export type ErrorKey = keyof typeof ERRORS;
