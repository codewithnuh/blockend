// health status of the entire system
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

// status of an individual check
export type CheckStatus = "healthy" | "unhealthy";

export interface HealthCheck {
  /** Unique name of the check. Example: "database", "redis" */
  name: string;

  /** Whether failure should make the application unhealthy. */
  critical: boolean;

  /** Optional human-friendly message shown when the check fails. */
  message?: string;

  /** Timeout for this specific check in milliseconds. Prevents hanging. */
  timeoutMs?: number;

  /** Actual health check implementation. Throw an error if it fails. */
  run(): Promise<void>;
}

export interface HealthCheckResult {
  name: string;
  critical: boolean;
  status: CheckStatus;
  duration: number; // in milliseconds
  message?: string;
  error?: string; // Sanitized to string to prevent leaking stack traces
}

export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  uptime: number; // in seconds
  checks: HealthCheckResult[];
}

// Extension points: Allow teams to override default policies
export type StatusCalculator = (results: HealthCheckResult[]) => HealthStatus;
export type ReportBuilder = (results: HealthCheckResult[], status: HealthStatus) => HealthReport;

export interface CreateHealthOptions {
  checks: HealthCheck[];
  /** Global fallback timeout in milliseconds (default: 5000) */
  defaultTimeoutMs?: number;
  /** Optional custom status calculation logic */
  calculateStatus?: StatusCalculator;
  /** Optional custom report generation logic */
  buildReport?: ReportBuilder;
}

export interface Health {
  run(): Promise<HealthReport>;
}
