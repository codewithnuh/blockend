import type { TokenErrorCode } from "./types.js";

export class TokenError extends Error {
  override readonly name = "TokenError";
  constructor(
    public readonly code: TokenErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

export function isTokenError(value: unknown): value is TokenError {
  return value instanceof TokenError;
}
