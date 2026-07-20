import { describe, it, expect } from "vitest";
import { calculateStatus } from "./calculate-status";
import { HealthCheckResult } from "../types";

const makeResult = (overrides: Partial<HealthCheckResult>): HealthCheckResult => ({
  name: "test",
  critical: true,
  status: "healthy",
  duration: 10,
  ...overrides
});

describe("calculateStatus", () => {
  it("returns healthy when all checks pass", () => {
    const results = [makeResult({}), makeResult({})];
    expect(calculateStatus(results)).toBe("healthy");
  });

  it("returns unhealthy if ANY critical check fails", () => {
    const results = [
      makeResult({ status: "healthy" }),
      makeResult({ status: "unhealthy", critical: true }),
      makeResult({ status: "healthy" })
    ];
    expect(calculateStatus(results)).toBe("unhealthy");
  });

  it("returns degraded if optional checks fail but all critical pass", () => {
    const results = [
      makeResult({ status: "healthy", critical: true }),
      makeResult({ status: "unhealthy", critical: false })
    ];
    expect(calculateStatus(results)).toBe("degraded");
  });

  it("prioritizes unhealthy over degraded (critical failure overrides optional failure)", () => {
    const results = [
      makeResult({ status: "unhealthy", critical: true }),
      makeResult({ status: "unhealthy", critical: false })
    ];
    expect(calculateStatus(results)).toBe("unhealthy");
  });

  it("returns healthy for an empty array (edge case)", () => {
    expect(calculateStatus([])).toBe("healthy");
  });
});
