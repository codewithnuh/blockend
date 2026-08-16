/**
 * Observability contracts for the idempotency module.
 *
 * Kept intentionally lightweight so consumers don't need a heavy logging or
 * metrics library to adopt the handler. Both interfaces are duck-typed: any
 * logger (pino, winston, console, ...) that satisfies the shape can be passed
 * via `IdempotencyHandlerOptions`.
 */

/**
 * Canonical metric names emitted by the idempotency module.
 * Every `metrics.increment` / `metrics.histogram` call must use one of these
 * names so dashboards stay stable across versions.
 */
export type MetricName =
  | "idempotency_cache_hits_total"
  | "idempotency_cache_misses_total"
  | "idempotency_duplicates_total"
  | "idempotency_store_errors_total"
  | "idempotency_recovered_records_total"
  | "idempotency_cleaned_records_total"
  | "idempotency_latency_seconds";

/**
 * Structured logger contract. The first argument is always a context object
 * (which may be empty), and the second is the human-readable message.
 */
export interface Logger {
  debug(ctx: Record<string, unknown>, msg?: string): void;
  info(ctx: Record<string, unknown>, msg?: string): void;
  warn(ctx: Record<string, unknown>, msg?: string): void;
  error(ctx: Record<string, unknown>, msg?: string): void;
}

/**
 * Metrics contract. `increment` bumps counters (optionally labelled) and
 * `histogram` records latency observations in seconds.
 */
export interface Metrics {
  increment(metric: MetricName, value?: number, labels?: Record<string, string>): void;
  histogram(metric: MetricName, valueInSeconds: number, labels?: Record<string, string>): void;
}

/**
 * Fallback stubs so the handler runs cleanly even when logger/metrics are not
 * injected. They intentionally swallow all output — observability is optional.
 */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

export const noopMetrics: Metrics = {
  increment: () => {},
  histogram: () => {}
};
