// utils/create-logger.ts
import type { CoreLogger, LogFn } from "../interfaces/logger";

export type MinimalLogHandler = (
  level: "debug" | "info" | "warn" | "error",
  msg: string,
  meta?: object
) => void;

/**
 * Utility to convert any custom log function into a CoreLogger in seconds.
 */
export function createLoggerAdapter(handler: MinimalLogHandler): CoreLogger {
  const wrap = (level: "debug" | "info" | "warn" | "error"): LogFn => {
    return (first: unknown, second?: unknown) => {
      if (typeof first === "string") {
        handler(level, first);
      } else if (typeof first === "object" && first !== null) {
        handler(level, typeof second === "string" ? second : "", first);
      }
    };
  };

  return {
    debug: wrap("debug"),
    info: wrap("info"),
    warn: wrap("warn"),
    error: wrap("error")
  };
}
