import type { ErrorContext, ErrorContextInput } from "../types/index";

/** Adds a timestamp and preserves supplied request metadata in an error context. */
export function enrichErrorContext(input: ErrorContextInput = {}): ErrorContext {
  return {
    timestamp: input.timestamp ?? new Date().toISOString(),
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    ...(input.path === undefined ? {} : { path: input.path }),
    ...(input.method === undefined ? {} : { method: input.method }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata })
  };
}
