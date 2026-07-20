import { HealthCheck, HealthCheckResult } from "../types";

export async function runCheck(
  check: HealthCheck,
  defaultTimeoutMs = 5000
): Promise<HealthCheckResult> {
  const start = performance.now();
  const timeout = check.timeoutMs ?? defaultTimeoutMs;

  try {
    // Enforce timeout to prevent a single slow dependency from hanging the entire health request
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Check timed out after ${timeout}ms`)), timeout);
    });

    await Promise.race([check.run(), timeoutPromise]);

    return {
      name: check.name,
      critical: check.critical,
      status: "healthy",
      duration: performance.now() - start,
      message: check.message
    };
  } catch (error) {
    const duration = performance.now() - start;

    // Sanitize error: never expose raw Error objects (stack traces) in production APIs
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      name: check.name,
      critical: check.critical,
      status: "unhealthy",
      duration,
      message: check.message,
      error: errorMessage
    };
  }
}
