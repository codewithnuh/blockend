import { IDEMPOTENCY_ERROR_CODES } from "../errors/codes";
import { IdempotencyError } from "../errors/idempotency-errors";

export type KeyValidationOptions = {
  minLength?: number;
  maxLength?: number;
  requireUuid?: boolean;
  pattern?: {
    value: RegExp;
    message: string;
  };
};

export const DEFAULT_MIN_KEY_LENGTH = 1;
export const DEFAULT_MAX_KEY_LENGTH = 128;

// Strict RFC 4122 pattern for UUID v1-v5 (case-insensitive). v1-v5 is
// distinguished by the version nibble `[1-5]` and the variant nibble `[89abAB]`.
export const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

// Default allowed charset: letters, digits, dots, underscores, hyphens, colons.
const DEFAULT_PATTERN = {
  value: /^[A-Za-z0-9._:-]+$/,
  message:
    "Only letters, numbers, dots (.), underscores (_), hyphens (-), and colons (:) are allowed."
};

/**
 * Sanitizes and validates an idempotency key, returning the cleaned value.
 *
 * INVARIANT (ordering matters): the key is trimmed FIRST, before any length or
 * format checks, so whitespace-only input can't bypass length limits, and so
 * callers never store raw input that contains trailing/leading whitespace.
 *
 * Callers MUST use the returned (trimmed) key, never the raw input.
 */
export function validateKey(
  key: unknown,
  {
    minLength = DEFAULT_MIN_KEY_LENGTH,
    maxLength = DEFAULT_MAX_KEY_LENGTH,
    requireUuid = false,
    pattern = DEFAULT_PATTERN
  }: KeyValidationOptions = {}
): string {
  if (typeof key !== "string") {
    throw new IdempotencyError(
      IDEMPOTENCY_ERROR_CODES.KEY_INVALID_TYPE,
      "Invalid idempotency key. The value must be a string."
    );
  }

  // Always sanitize first; raw input might contain trailing spaces or control whitespace
  const trimmedKey = key.trim();

  if (trimmedKey.length === 0) {
    throw new IdempotencyError(
      IDEMPOTENCY_ERROR_CODES.KEY_REQUIRED,
      "An idempotency key is required."
    );
  }

  if (trimmedKey.length < minLength) {
    throw new IdempotencyError(
      IDEMPOTENCY_ERROR_CODES.KEY_TOO_SHORT,
      `The idempotency key must be at least ${minLength} characters long.`
    );
  }

  if (trimmedKey.length > maxLength) {
    throw new IdempotencyError(
      IDEMPOTENCY_ERROR_CODES.KEY_TOO_LONG,
      `The idempotency key must not exceed ${maxLength} characters.`
    );
  }

  // UUID mode overrides the standard charset regex when explicitly enabled.
  if (requireUuid) {
    if (!UUID_REGEX.test(trimmedKey)) {
      throw new IdempotencyError(
        IDEMPOTENCY_ERROR_CODES.KEY_INVALID_FORMAT,
        "Invalid idempotency key. Key must be a valid UUID v1-v5."
      );
    }
  } else if (!pattern.value.test(trimmedKey)) {
    throw new IdempotencyError(
      IDEMPOTENCY_ERROR_CODES.KEY_INVALID_FORMAT,
      `Invalid idempotency key. ${pattern.message}`
    );
  }

  // Return the cleaned key; callers MUST use this returned value, not the raw input
  return trimmedKey;
}
