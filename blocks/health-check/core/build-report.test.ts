import { describe, it, expect, vi, afterEach } from "vitest";
import { buildReport } from "../core/build-report";
import { HealthCheckResult } from "../types/index";

describe("buildReport", () => {
  const mockResults: HealthCheckResult[] = [
    { name: "db", critical: true, status: "healthy", duration: 10 }
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates a valid report with correct structure and ISO timestamp", () => {
    vi.stubGlobal("process", { uptime: () => 123.45 });

    const report = buildReport(mockResults, "healthy");

    expect(report.status).toBe("healthy");
    expect(report.checks).toEqual(mockResults);
    expect(report.uptime).toBe(123.45);
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });

  it("safely handles environments where process.uptime is missing", () => {
    vi.stubGlobal("process", {}); // process exists but no uptime function

    const report = buildReport(mockResults, "degraded");
    expect(report.uptime).toBe(0);
  });

  it("safely handles environments where process is completely undefined (e.g., Cloudflare Workers)", () => {
    vi.stubGlobal("process", undefined);

    const report = buildReport(mockResults, "unhealthy");
    expect(report.uptime).toBe(0);
  });
});
