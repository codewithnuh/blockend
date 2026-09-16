import type { ErrorContext, ErrorContextInput } from "../types/index";

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
