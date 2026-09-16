export interface NormalizedInput {
  raw: unknown;
  error: Error;
}

/** Converts any thrown value into an Error while retaining the original input. */
export function normalizeError(error: unknown): NormalizedInput {
  if (error instanceof Error) return { raw: error, error };
  return { raw: error, error: new Error("A non-Error value was thrown", { cause: error }) };
}
