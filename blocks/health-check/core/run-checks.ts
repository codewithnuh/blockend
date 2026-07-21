import { HealthCheck, HealthCheckResult } from "../types/index";
import { runCheck } from "./run-check";

export async function runChecks(
  checks: HealthCheck[],
  defaultTimeoutMs?: number
): Promise<HealthCheckResult[]> {
  const tasks = checks.map((check) => runCheck(check, defaultTimeoutMs));
  return await Promise.all(tasks);
}
