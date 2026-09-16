export interface NormalizedInput {
  raw: unknown;
  error: Error;
}

export function normalizeError(error: unknown): NormalizedInput {
  if (error instanceof Error) return { raw: error, error };
  return { raw: error, error: new Error("A non-Error value was thrown", { cause: error }) };
}
