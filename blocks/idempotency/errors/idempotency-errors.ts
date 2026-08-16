import type { IdempotencyErrorCode } from "./codes";

export class IdempotencyError extends Error {
  constructor(
    public readonly code: IdempotencyErrorCode,
    message: string
  ) {
    super(message);

    this.name = "IdempotencyError";
  }
}
