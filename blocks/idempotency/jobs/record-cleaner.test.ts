import { describe, expect, it, vi } from "vitest";
import type { Logger, Metrics } from "../interfaces/observability";
import type { IdempotencyStore } from "../interfaces/store";
import { cleanupExpiredRecords } from "./record-cleaner";

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
  const deleteExpired = vi.fn<
    Parameters<IdempotencyStore["deleteExpired"]>,
    ReturnType<IdempotencyStore["deleteExpired"]>
  >(async () => 0);

  return { store: { deleteExpired }, deleteExpired };
}

describe("cleanupExpiredRecords", () => {
  it("deletes only SUCCESS/FAILED records older than now, with the default limit", async () => {
    const { store, deleteExpired } = createStore();
    deleteExpired.mockResolvedValue(7);

    const result = await cleanupExpiredRecords(
      store as unknown as IdempotencyStore,
      createLogger(),
      createMetrics()
    );

    expect(result).toEqual({ deleted: 7 });
    expect(deleteExpired).toHaveBeenCalledWith({
      expiredBefore: expect.any(Date),
      statuses: ["SUCCESS", "FAILED"],
      limit: 500
    });
  });

  it("passes through the custom limit", async () => {
    const { store, deleteExpired } = createStore();

    await cleanupExpiredRecords(
      store as unknown as IdempotencyStore,
      createLogger(),
      createMetrics(),
      { limit: 25 }
    );

    expect(deleteExpired).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }));
  });

  it("propagates store failures (with metrics + logging) so callers can alert", async () => {
    const { store, deleteExpired } = createStore();
    deleteExpired.mockRejectedValue(new Error("database connection lost"));
    const metrics = createMetrics();
    const logger = createLogger();

    await expect(
      cleanupExpiredRecords(store as unknown as IdempotencyStore, logger, metrics)
    ).rejects.toThrow("database connection lost");

    expect(metrics.increment).toHaveBeenCalledWith("idempotency_store_errors_total", 1, {
      operation: "cleanup"
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it("emits a cleaned-records metric on success", async () => {
    const { store, deleteExpired } = createStore();
    deleteExpired.mockResolvedValue(3);
    const metrics = createMetrics();

    await cleanupExpiredRecords(store as unknown as IdempotencyStore, createLogger(), metrics);

    expect(metrics.increment).toHaveBeenCalledWith("idempotency_cleaned_records_total", 3);
  });
});
