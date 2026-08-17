import { describe, expect, it, vi } from "vitest";
import type { Logger, Metrics } from "../interfaces/observability";
import type { IdempotencyStore } from "../interfaces/store";
import type { IdempotencyRecord } from "../types/index";
import { recoverStuckRecords } from "./record-recovery";

function createLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createMetrics(): Metrics {
  return { increment: vi.fn(), histogram: vi.fn() };
}
function createStore() {
  const findAll = vi.fn<
    (...args: Parameters<IdempotencyStore["findAll"]>) => ReturnType<IdempotencyStore["findAll"]>
  >(async () => []);
  const markFailed = vi.fn<
    (
      ...args: Parameters<IdempotencyStore["markFailed"]>
    ) => ReturnType<IdempotencyStore["markFailed"]>
  >(async () => {});

  return { store: { findAll, markFailed }, findAll, markFailed };
}

function makeRecord(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  return {
    key: "k",
    userId: "u",
    operation: "op",
    requestHash: "hash",
    status: "PROCESSING",
    expiresAt: new Date("2099-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides
  };
}

describe("recoverStuckRecords", () => {
  it("queries only PROCESSING records updated before the cutoff and marks them FAILED", async () => {
    const { store, findAll, markFailed } = createStore();
    findAll.mockResolvedValue([
      makeRecord({ key: "k1", userId: "u1", operation: "op1" }),
      makeRecord({ key: "k2", userId: "u2", operation: "op2" })
    ]);

    const result = await recoverStuckRecords(
      store as unknown as IdempotencyStore,
      createLogger(),
      createMetrics()
    );

    expect(findAll).toHaveBeenCalledWith({
      status: "PROCESSING",
      updatedBefore: expect.any(Date),
      limit: 100
    });
    expect(markFailed).toHaveBeenCalledWith("k1", "op1", "u1");
    expect(markFailed).toHaveBeenCalledWith("k2", "op2", "u2");
    expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
  });

  it("computes the cutoff from the custom timeout", async () => {
    const { store, findAll } = createStore();

    await recoverStuckRecords(
      store as unknown as IdempotencyStore,
      createLogger(),
      createMetrics(),
      { timeoutInMs: 60_000, limit: 5 }
    );

    const filters = findAll.mock.calls[0]?.[0];
    expect(filters?.limit).toBe(5);
    const cutoff = filters?.updatedBefore;
    expect(cutoff).toBeDefined();
    expect(cutoff!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(cutoff!.getTime()).toBeGreaterThan(Date.now() - 120_000);
  });

  it("keeps recovering remaining records when one markFailed fails", async () => {
    const { store, findAll, markFailed } = createStore();
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({ key: `k${i}`, userId: `u${i}`, operation: `op${i}` })
    );
    findAll.mockResolvedValue(records);
    markFailed.mockRejectedValueOnce(new Error("db hiccup"));

    const result = await recoverStuckRecords(
      store as unknown as IdempotencyStore,
      createLogger(),
      createMetrics(),
      { limit: 5 }
    );

    expect(result).toEqual({ processed: 5, succeeded: 4, failed: 1 });
    expect(markFailed).toHaveBeenCalledTimes(5);
  });

  it("returns a zeroed result when nothing is stuck", async () => {
    const { store, markFailed } = createStore();

    const result = await recoverStuckRecords(
      store as unknown as IdempotencyStore,
      createLogger(),
      createMetrics()
    );

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("emits recovery metrics", async () => {
    const { store, findAll } = createStore();
    findAll.mockResolvedValue([makeRecord()]);
    const metrics = createMetrics();

    await recoverStuckRecords(store as unknown as IdempotencyStore, createLogger(), metrics);

    expect(metrics.increment).toHaveBeenCalledWith("idempotency_recovered_records_total", 1, {
      status: "success"
    });
  });
});
