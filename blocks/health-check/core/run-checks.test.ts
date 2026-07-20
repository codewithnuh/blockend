import { describe, it, expect } from "vitest";
import { runChecks } from "../core/run-checks";
import { HealthCheck } from "../types";

describe("runChecks", () => {
  it("executes all checks concurrently, not sequentially", async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const checks: HealthCheck[] = [
      {
        name: "c1",
        critical: true,
        run: async () => {
          await delay(50);
        }
      },
      {
        name: "c2",
        critical: true,
        run: async () => {
          await delay(50);
        }
      },
      {
        name: "c3",
        critical: true,
        run: async () => {
          await delay(50);
        }
      }
    ];

    const start = performance.now();
    const results = await runChecks(checks, 5000);
    const duration = performance.now() - start;

    expect(results).toHaveLength(3);
    // If sequential, it would take ~150ms. If concurrent, ~50ms.
    expect(duration).toBeLessThan(100);
  });

  it("collects all results even if some checks throw errors", async () => {
    const checks: HealthCheck[] = [
      { name: "success", critical: true, run: async () => {} },
      {
        name: "fail",
        critical: true,
        run: async () => {
          throw new Error("boom");
        }
      }
    ];

    const results = await runChecks(checks, 5000);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("healthy");
    expect(results[1].status).toBe("unhealthy");
    expect(results[1].error).toBe("boom");
  });
});
