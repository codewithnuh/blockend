import type { Redis } from "ioredis";
import type { RateLimitStore, RateLimitRecord } from "../core/core.js";

type RateLimitIncrementResult = [hits: number, pttl: number];

export interface RedisWithRateLimit extends Redis {
  performRateLimitIncrement(key: string, windowMs: number): Promise<RateLimitIncrementResult>;
}

export class RedisStore implements RateLimitStore {
  private readonly redisClient: RedisWithRateLimit;
  private readonly keyPrefix: string;

  constructor(redisClient: Redis, keyPrefix = "rl:") {
    redisClient.defineCommand("performRateLimitIncrement", {
      numberOfKeys: 1,
      lua: `
        local key = KEYS[1]
        local windowMs = tonumber(ARGV[1])

        local hits = redis.call('INCR', key)

        if hits == 1 then
          redis.call('PEXPIRE', key, windowMs)
        end

        local pttl = redis.call('PTTL', key)

        return { hits, pttl }
      `
    });

    // The command exists from this point onward.
    this.redisClient = redisClient as RedisWithRateLimit;
    this.keyPrefix = keyPrefix;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const fullKey = `${this.keyPrefix}${key}`;
    const now = Date.now();

    const [hits, pttl] = await this.redisClient.performRateLimitIncrement(fullKey, windowMs);

    const actualRemainingMs = pttl > 0 ? pttl : windowMs;

    return {
      hits,
      resetTime: now + actualRemainingMs
    };
  }
}
