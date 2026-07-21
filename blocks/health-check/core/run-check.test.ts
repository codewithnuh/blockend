import { describe, it, expect, vi } from "vitest";
import { runCheck } from "./run-check";
import { HealthCheck } from "../types/index";

describe("runCheck", () => {
  const baseCheck: HealthCheck = {
    name: "test-check",
    critical: true,
    run: vi.fn()
  };

  it("returns healthy status and measures duration on success", async () => {
    const check = { ...baseCheck, run: vi.fn().mockResolvedValue(undefined) };
    const result = await runCheck(check, 5000);

    expect(result.status).toBe("healthy");
    expect(result.name).toBe("test-check");
    expect(result.critical).toBe(true);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("preserves the critical flag from the check definition (bug fix verification)", async () => {
    const nonCriticalCheck = {
      ...baseCheck,
      critical: false,
      run: vi.fn().mockResolvedValue(undefined)
    };
    const result = await runCheck(nonCriticalCheck, 5000);
    expect(result.critical).toBe(false); // Proves it's not hardcoded to true anymore
  });

  it("catches Error objects and sanitizes them to strings", async () => {
    const check = {
      ...baseCheck,
      run: vi.fn().mockRejectedValue(new Error("DB connection failed"))
    };
    const result = await runCheck(check, 5000);

    expect(result.status).toBe("unhealthy");
    expect(result.error).toBe("DB connection failed");
    expect(typeof result.error).toBe("string"); // Must not leak the raw Error object/stack trace
  });

  it("catches non-Error throws (strings, objects, null) and sanitizes them", async () => {
    const check1 = { ...baseCheck, run: vi.fn().mockRejectedValue("string error") };
    expect((await runCheck(check1)).error).toBe("string error");

    const check2 = { ...baseCheck, run: vi.fn().mockRejectedValue({ code: 500 }) };
    expect((await runCheck(check2)).error).toBe("[object Object]");

    const check3 = { ...baseCheck, run: vi.fn().mockRejectedValue(null) };
    expect((await runCheck(check3)).error).toBe("null");
  });

  it("enforces timeout and fails gracefully if check hangs", async () => {
    const hangingCheck = {
      ...baseCheck,
      timeoutMs: 50,
      run: () => new Promise<void>((resolve) => setTimeout(resolve, 200))
    };

    const start = performance.now();
    const result = await runCheck(hangingCheck, 5000);
    const duration = performance.now() - start;

    expect(result.status).toBe("unhealthy");
    expect(result.error).toContain("timed out");
    expect(duration).toBeLessThan(150); // Should fail around 50ms, not wait for the full 200ms
  });

  it("uses global defaultTimeoutMs if check does not specify timeoutMs", async () => {
    const hangingCheck = {
      ...baseCheck,
      run: () => new Promise<void>((resolve) => setTimeout(resolve, 200))
    };

    const start = performance.now();
    const result = await runCheck(hangingCheck, 50); // global timeout 50ms
    const duration = performance.now() - start;

    expect(result.status).toBe("unhealthy");
    expect(duration).toBeLessThan(150);
  });
});
