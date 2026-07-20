import { describe, it, expect, vi, afterEach } from "vitest";
import { createHealth } from "../core/create-health";
import { HealthCheck, HealthCheckResult, HealthStatus } from "../types";

describe("createHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validCheck: HealthCheck = {
    name: "test",
    critical: true,
    run: vi.fn().mockResolvedValue(undefined)
  };

  describe("Configuration Validation (Fail Fast)", () => {
    it("throws if checks array is empty", () => {
      expect(() => createHealth({ checks: [] })).toThrow("'checks' array cannot be empty");
    });

    it("throws if checks is not an array", () => {
      // @ts-expect-error Testing invalid input
      expect(() => createHealth({ checks: "not-an-array" })).toThrow(
        "'checks' must be a valid array"
      );
    });

    it("throws if check name is missing or empty", () => {
      expect(() => createHealth({ checks: [{ ...validCheck, name: "" }] })).toThrow(
        "non-empty string 'name'"
      );
    });

    it("throws if check names are duplicated", () => {
      expect(() => createHealth({ checks: [validCheck, { ...validCheck }] })).toThrow(
        "Duplicate check name"
      );
    });

    it("throws if run function is missing", () => {
      // @ts-expect-error Testing invalid input
      expect(() => createHealth({ checks: [{ name: "test", critical: true }] })).toThrow(
        "missing a valid 'run' function"
      );
    });

    it("throws if timeoutMs is invalid", () => {
      expect(() => createHealth({ checks: [{ ...validCheck, timeoutMs: -100 }] })).toThrow(
        "invalid 'timeoutMs'"
      );
    });
  });

  describe("Execution & Extension Points", () => {
    it("runs end-to-end and returns a valid report", async () => {
      vi.stubGlobal("process", { uptime: () => 100 });
      const health = createHealth({ checks: [validCheck] });
      const report = await health.run();

      expect(report.status).toBe("healthy");
      expect(report.checks).toHaveLength(1);
      expect(report.uptime).toBe(100);
    });

    it("allows overriding the status calculation logic (Extension Point)", async () => {
      const customCalculator = (_results: HealthCheckResult[]): HealthStatus => "degraded";
      const health = createHealth({
        checks: [validCheck],
        calculateStatus: customCalculator
      });

      const report = await health.run();
      expect(report.status).toBe("degraded");
    });

    it("allows overriding the report building logic (Extension Point)", async () => {
      const customBuilder = () => ({
        status: "unhealthy" as const,
        timestamp: "custom",
        uptime: 0,
        checks: []
      });

      const health = createHealth({
        checks: [validCheck],
        buildReport: customBuilder
      });

      const report = await health.run();
      expect(report.timestamp).toBe("custom");
    });
  });
});
