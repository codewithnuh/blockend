import { describe, it, expect } from "vitest";
import { runChecks } from "../core/run-checks";
import type { HealthCheck } from "../types/index";

describe("runChecks", () => {
  it("executes all checks concurrently, not sequentially", async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Records the order in which checks start and finish. Concurrency is
    // proven structurally (all three start before any of them finish), so the
    // test is immune to machine load — no timing thresholds involved.
    const order: string[] = [];

    const checks: HealthCheck[] = [
      {
        name: "c1",
        critical: true,
        run: async () => {
          order.push("start-c1");
          await delay(50);
          order.push("end-c1");
        }
      },
      {
        name: "c2",
        critical: true,
        run: async () => {
          order.push("start-c2");
          await delay(50);
          order.push("end-c2");
        }
      },
      {
        name: "c3",
        critical: true,
        run: async () => {
          order.push("start-c3");
          await delay(50);
          order.push("end-c3");
        }
      }
    ];

    const results = await runChecks(checks, 5000);

    expect(results).toHaveLength(3);
    // Concurrent execution: the first three recorded events are all starts.
    // Sequential execution would interleave: start-c1, end-c1, start-c2, ...
    expect(order.slice(0, 3)).toEqual(["start-c1", "start-c2", "start-c3"]);
    // And every check must have started before the first one finished.
    expect(order.indexOf("start-c3")).toBeLessThan(order.indexOf("end-c1"));
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
    expect(results[0]!.status).toBe("healthy");
    expect(results[1]!.status).toBe("unhealthy");
    expect(results[1]!.error).toBe("boom");
  });
});
