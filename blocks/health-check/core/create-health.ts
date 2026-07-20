import { CreateHealthOptions, Health } from "../types";
import { buildReport as defaultBuildReport } from "./build-report";
import { calculateStatus as defaultCalculateStatus } from "./calculate-status";
import { runChecks } from "./run-checks";
import { validateConfig } from "./validate-config";

export function createHealth(options: CreateHealthOptions): Health {
  // Fail fast: Validate configuration immediately upon creation
  validateConfig(options);

  // Allow teams to override default policies if business rules differ
  const calculateStatus = options.calculateStatus ?? defaultCalculateStatus;
  const buildReport = options.buildReport ?? defaultBuildReport;

  return {
    async run() {
      const results = await runChecks(options.checks, options.defaultTimeoutMs);
      const status = calculateStatus(results);
      return buildReport(results, status);
    }
  };
}
