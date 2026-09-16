/** Wraps a raw thrown value into a canonical Error with the original retained. */
export interface NormalizedInput {
  raw: unknown;
  error: Error;
}

/** Ensure the input is an Error instance, wrapping non-Error values. */
export function normalizeError(error: unknown): NormalizedInput {
  if (error instanceof Error) return { raw: error, error };
  return { raw: error, error: new Error("A non-Error value was thrown", { cause: error }) };
}
