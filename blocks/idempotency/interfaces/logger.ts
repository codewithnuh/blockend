/**
 * Adapter-style logging contracts (pino-like call signatures) used by
 * `utils/create-logger.ts` to bridge arbitrary logger implementations.
 *
 * The canonical observability contracts — `Logger`, `Metrics`, `MetricName`
 * and the noop implementations — live in `./observability` and are re-exported
 * here for backward compatibility with existing imports.
 */

export interface LogFn {
  (msg: string, ...args: unknown[]): void;
  (obj: object, msg?: string, ...args: unknown[]): void;
}

export interface CoreLogger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

export type { Logger, Metrics, MetricName } from "./observability";
