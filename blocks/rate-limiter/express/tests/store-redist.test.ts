import { beforeEach, describe, expect, test, vi } from "vitest";
import { Redis } from "ioredis";
import type { ChainableCommander } from "ioredis";
import { RedisStore } from "../store-redis";

describe("Rate Limiter Block - RedisStore Engine", () => {
  let mockRedis: Redis;

  beforeEach(() => {
    mockRedis = {
      multi: vi.fn(),
      pexpire: vi.fn()
    } as unknown as Redis;
  });

  const createPipeline = (
    execResult: Awaited<ReturnType<ChainableCommander["exec"]>>
  ): ChainableCommander =>
    ({
      incr: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(execResult)
    }) as unknown as ChainableCommander;

  test("should successfully run atomic increments and extract the execution pipeline indexes", async () => {
    const pipeline = createPipeline([
      [null, 5],
      [null, 30]
    ]);

    vi.spyOn(mockRedis, "multi").mockReturnValue(pipeline);

    const store = new RedisStore(mockRedis, "test-rl:");
    const startTime = Date.now();

    const result = await store.increment("user_id_99", 60_000);

    expect(mockRedis.multi).toHaveBeenCalled();
    expect(pipeline.incr).toHaveBeenCalledWith("test-rl:user_id_99");
    expect(pipeline.ttl).toHaveBeenCalledWith("test-rl:user_id_99");

    expect(result.hits).toBe(5);
    expect(result.resetTime).toBeGreaterThanOrEqual(startTime + 30_000);

    expect(mockRedis.pexpire).not.toHaveBeenCalled();
  });

  test("should enforce an explicitly defined key expiration if the key is newly initialized", async () => {
    const pipeline = createPipeline([
      [null, 1],
      [null, -1]
    ]);

    vi.spyOn(mockRedis, "multi").mockReturnValue(pipeline);
    vi.spyOn(mockRedis, "pexpire").mockResolvedValue(1);

    const store = new RedisStore(mockRedis, "test-rl:");
    const windowMs = 45_000;

    const result = await store.increment("new_client_session", windowMs);

    expect(result.hits).toBe(1);

    expect(mockRedis.pexpire).toHaveBeenCalledWith("test-rl:new_client_session", windowMs);
  });

  test("should throw an execution error if the Redis transaction fails", async () => {
    const pipeline = createPipeline(null);

    vi.spyOn(mockRedis, "multi").mockReturnValue(pipeline);

    const store = new RedisStore(mockRedis, "test-rl:");

    await expect(store.increment("error_key", 10_000)).rejects.toThrowError(
      "Redis multi command failed"
    );
  });
});
