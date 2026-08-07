import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GracefulShutdown } from "../../core/shutdown";

const base = () => ({ installSignalHandlers: false });

describe("GracefulShutdown", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs tasks and reports a successful result", async () => {
    const shutdown = new GracefulShutdown(base());
    const order: string[] = [];

    shutdown.addTask({
      name: "a",
      priority: 10,
      handler: () => {
        order.push("a");
      }
    });
    shutdown.addTask({
      name: "b",
      priority: 20,
      handler: () => {
        order.push("b");
      }
    });

    const result = await shutdown.shutdown("manual");

    expect(order).toEqual(["b", "a"]);
    expect(result.success).toBe(true);
    expect(result.completed).toEqual(["b", "a"]);
    expect(result.failed).toEqual([]);
  });

  it("orders tasks by priority, highest first", async () => {
    const shutdown = new GracefulShutdown(base());
    const order: string[] = [];
    const mk = (name: string, priority: number) =>
      shutdown.addTask({
        name,
        priority,
        handler: () => {
          order.push(name);
        }
      });

    mk("db", 40);
    mk("http", 100);
    mk("redis", 20);
    mk("logs", 10);

    await shutdown.shutdown("manual");

    expect(order).toEqual(["http", "db", "redis", "logs"]);
  });

  it("is idempotent — the second call shares the same promise", async () => {
    const shutdown = new GracefulShutdown(base());
    let runs = 0;
    shutdown.addTask({
      name: "t",
      handler: async () => {
        runs++;
      }
    });

    const first = shutdown.shutdown("manual");
    const second = shutdown.shutdown("SIGTERM");

    expect(second).toBe(first);
    await first;

    expect(runs).toBe(1);
  });

  it("is re-entrant safe when a beforeShutdown listener calls shutdown()", async () => {
    const shutdown = new GracefulShutdown(base());
    let runs = 0;
    let nested: Promise<unknown> | undefined;

    shutdown.on("beforeShutdown", () => {
      // A listener triggering a second shutdown must not recurse infinitely.
      nested = shutdown.shutdown("nested");
    });
    shutdown.addTask({
      name: "t",
      handler: () => {
        runs++;
      }
    });

    await shutdown.shutdown("first");
    await nested;

    expect(runs).toBe(1);
    expect(nested).toBe(shutdown.shutdown("nested"));
  });

  it("collects failures but keeps running the remaining tasks", async () => {
    const shutdown = new GracefulShutdown(base());
    const order: string[] = [];

    shutdown.addTask({
      name: "fail",
      priority: 30,
      handler: () => {
        throw new Error("boom");
      }
    });
    shutdown.addTask({
      name: "ok",
      priority: 20,
      handler: () => {
        order.push("ok");
      }
    });

    const result = await shutdown.shutdown("manual");

    expect(result.success).toBe(false);
    expect(result.completed).toEqual(["ok"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.name).toBe("fail");
    expect(result.failed[0]?.error.message).toBe("boom");
    expect(order).toEqual(["ok"]);
  });

  it("honours stopOnError — stops running remaining tasks", async () => {
    const shutdown = new GracefulShutdown({ ...base(), stopOnError: true });
    const order: string[] = [];

    shutdown.addTask({
      name: "fail",
      priority: 30,
      handler: () => {
        throw new Error("boom");
      }
    });
    shutdown.addTask({
      name: "never",
      priority: 20,
      handler: () => {
        order.push("never");
      }
    });

    const result = await shutdown.shutdown("manual");

    expect(result.success).toBe(false);
    expect(result.completed).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(order).toEqual([]);
  });

  it("times out a task that exceeds its deadline", async () => {
    const shutdown = new GracefulShutdown(base());
    const slow = () => new Promise<void>((resolve) => setTimeout(resolve, 10_000));

    shutdown.addTask({ name: "slow", timeout: 20, handler: slow });

    const result = await shutdown.shutdown("manual");

    expect(result.success).toBe(false);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error.message).toContain("timed out");
  });

  it("runs a task added after shutdown starts immediately", async () => {
    const shutdown = new GracefulShutdown(base());
    const ran: string[] = [];

    shutdown.addTask({
      name: "before",
      handler: () => {
        ran.push("before");
      }
    });
    const run = shutdown.shutdown("manual");

    // _isShuttingDown is set synchronously, so this addTask takes the
    // "already started" branch and runs the handler immediately.
    shutdown.addTask({
      name: "after",
      handler: () => {
        ran.push("after");
      }
    });
    await run;

    expect(ran).toContain("after");
  });

  it("removeTask prevents a task from running", async () => {
    const shutdown = new GracefulShutdown(base());
    const ran: string[] = [];

    shutdown.addTask({
      name: "gone",
      handler: () => {
        ran.push("gone");
      }
    });
    shutdown.addTask({
      name: "stay",
      handler: () => {
        ran.push("stay");
      }
    });
    shutdown.removeTask("gone");

    await shutdown.shutdown("manual");

    expect(ran).toEqual(["stay"]);
  });

  it("emits beforeShutdown and afterShutdown lifecycle events", async () => {
    const shutdown = new GracefulShutdown(base());
    const events: string[] = [];

    shutdown.on("beforeShutdown", (reason) => events.push(`before:${reason}`));
    shutdown.on("afterShutdown", (result) => events.push(`after:${result.success}`));
    shutdown.addTask({
      name: "t",
      handler: () => {
        events.push("task");
      }
    });

    await shutdown.shutdown("manual");

    expect(events).toEqual(["before:manual", "task", "after:true"]);
  });

  it("survives when beforeShutdown is emitted before draining", async () => {
    const shutdown = new GracefulShutdown(base());
    const events: string[] = [];

    shutdown.on("beforeShutdown", () => events.push("before"));
    shutdown.on("draining", () => events.push("draining"));
    shutdown.addTask({
      name: "t",
      handler: () => {
        events.push("task");
      }
    });

    await shutdown.shutdown("manual");

    // No tracker configured → draining should never fire.
    expect(events).toEqual(["before", "task"]);
  });

  describe("hard timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls process.exit(1) when the run exceeds hardTimeoutMs", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
      let release!: () => void;
      const hang = new Promise<void>((resolve) => {
        release = resolve;
      });

      const shutdown = new GracefulShutdown({
        installSignalHandlers: false,
        hardTimeoutMs: 100,
        defaultTaskTimeoutMs: 60_000
      });
      shutdown.addTask({ name: "hang", handler: () => hang });

      const run = shutdown.shutdown("manual");
      run.catch(() => {});

      await vi.advanceTimersByTimeAsync(200);

      expect(exitSpy).toHaveBeenCalledWith(1);

      // Release the hanging task so nothing is left pending after the test.
      release();
      await vi.advanceTimersByTimeAsync(0);
      expect(exitSpy).toHaveBeenCalledTimes(1);
      exitSpy.mockRestore();
    });
  });
});
