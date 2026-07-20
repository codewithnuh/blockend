import type { Redis } from "ioredis";
import type { RateLimitStore, RateLimitRecord } from "../core/core";

export interface RedisWithRateLimit extends Redis {
  performRateLimitIncrement(key: string, windowMs: number): Promise<[number, number]>;
}
export class RedisStore implements RateLimitStore {
  constructor(
    private redisClient: RedisWithRateLimit,
    private keyPrefix = "rl:"
  ) {
    // Define the atomic rate limit script inside ioredis once on startup
    this.redisClient.defineCommand("performRateLimitIncrement", {
      numberOfKeys: 1,
      lua: `
        local key = KEYS[1]
        local windowMs = tonumber(ARGV[1])

        -- 1. Increment the hit counter
        local hits = redis.call('INCR', key)

        -- 2. If it's a brand new key, immediately anchor its exact millisecond TTL
        if hits == 1 then
            redis.call('PEXPIRE', key, windowMs)
        end

        -- 3. Fetch the exact remaining millisecond TTL
        local pttl = redis.call('PTTL', key)

        return {hits, pttl}
      `
    });
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const fullKey = `${this.keyPrefix}${key}`;
    const now = Date.now();

    // Execute the atomic script in exactly 1 network round-trip
    // We cast to 'any' because we added a custom dynamic command name above
    const [hits, pttl] = (await this.redisClient.performRateLimitIncrement(fullKey, windowMs)) as [
      number,
      number
    ];

    // Handle defensive fallback if PTTL returns a negative error code
    const actualRemainingMs = pttl > 0 ? pttl : windowMs;

    return {
      hits,
      resetTime: now + actualRemainingMs
    };
  }
}
