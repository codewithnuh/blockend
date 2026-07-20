import { describe, it, expect, vi } from "vitest";
import { RedisStore, RedisWithRateLimit } from "./redis-store";
describe("Redis Store Atomic Operations", () => {
  it("should parse dynamic Redis Lua matrix return types properly", async () => {
    // Construct a mock interface mirroring the dynamic defineCommand evaluation execution
    const mockRedisClient = {
      defineCommand: vi.fn(),
      // Mocking our dynamically registered performRateLimitIncrement command execution
      performRateLimitIncrement: vi.fn().mockResolvedValue([2, 4500]) // Returns [hits, pttl]
    } as unknown as RedisWithRateLimit;

    const store = new RedisStore(mockRedisClient, "test-rl:");
    const record = await store.increment("test_user", 60000);

    // Verify it called the dynamic Lua pipeline script cleanly inside 1 network hop
    expect(mockRedisClient.performRateLimitIncrement).toHaveBeenCalledWith(
      "test-rl:test_user",
      60000
    );

    expect(record.hits).toBe(2);
    // Ensure the runtime reset time maps directly onto the precise remaining millisecond window
    expect(record.resetTime).toBeLessThanOrEqual(Date.now() + 4500);
  });
});
