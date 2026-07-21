import { HealthCheckResult, HealthStatus } from "../types/index";

export function calculateStatus(results: HealthCheckResult[]): HealthStatus {
  const hasCriticalFailure = results.some(
    (result) => result.critical && result.status === "unhealthy"
  );

  if (hasCriticalFailure) {
    return "unhealthy";
  }

  const hasOptionalFailure = results.some(
    (result) => !result.critical && result.status === "unhealthy"
  );

  if (hasOptionalFailure) {
    return "degraded";
  }

  return "healthy";
}
