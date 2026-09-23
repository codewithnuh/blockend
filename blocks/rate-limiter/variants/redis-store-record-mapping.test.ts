import { describe, it, expect, vi } from "vitest";
import { RedisStore } from "./redis-store";
import type { RedisWithRateLimit } from "./redis-store";
describe("RedisStore maps Redis script result to RateLimitRecord", () => {
  it("converts a [hits, pttl] tuple from the Lua script into { hits, resetTime }", async () => {
    const mockRedisClient = {
      defineCommand: vi.fn(),
      performRateLimitIncrement: vi.fn().mockResolvedValue([2, 4500])
    } as unknown as RedisWithRateLimit;

    const store = new RedisStore(mockRedisClient, "test-rl:");
    const record = await store.increment("test_user", 60000);

    expect(mockRedisClient.performRateLimitIncrement).toHaveBeenCalledWith(
      "test-rl:test_user",
      60000
    );

    expect(record.hits).toBe(2);
    expect(record.resetTime).toBeLessThanOrEqual(Date.now() + 4500);
  });
});
