import { HealthCheckResult, HealthReport, HealthStatus } from "../types/index";

export function buildReport(results: HealthCheckResult[], status: HealthStatus): HealthReport {
  // Safely get uptime for Node.js, fallback to 0 for other environments
  const uptime =
    typeof process !== "undefined" && typeof process.uptime === "function" ? process.uptime() : 0;

  return {
    status,
    checks: results,
    timestamp: new Date().toISOString(),
    uptime
  };
}
