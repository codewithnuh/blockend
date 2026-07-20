import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { evaluateRateLimit, RateLimitConfig } from "../core/core";
import { MemoryStore } from "./memory-store";

describe("Rate Limiter Core & MemoryStore", () => {
  let store: MemoryStore;
  const defaultConfig: RateLimitConfig = {
    windowMs: 1000, // 1 second window
    max: 3,
    statusCode: 429,
    message: "Too Many Requests",
    standardHeaders: true,
    legacyHeaders: true
  };

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MemoryStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow requests under the limit and compute headers correctly", async () => {
    const key = "user_1";

    const result = await evaluateRateLimit(key, store, defaultConfig);

    expect(result.isBlocked).toBe(false);
    expect(result.statusCode).toBe(200);
    expect(result.headers["RateLimit-Remaining"]).toBe("2");
    expect(result.headers["X-RateLimit-Remaining"]).toBe("2");
  });

  it("should block requests when exceeding maximum threshold", async () => {
    const key = "user_2";

    // Hit the server up to max allowed (3 hits)
    await evaluateRateLimit(key, store, defaultConfig);
    await evaluateRateLimit(key, store, defaultConfig);
    await evaluateRateLimit(key, store, defaultConfig);

    // 4th request must be blocked
    const blockedResult = await evaluateRateLimit(key, store, defaultConfig);

    expect(blockedResult.isBlocked).toBe(true);
    expect(blockedResult.statusCode).toBe(429);
    expect(blockedResult.headers["Retry-After"]).toBe("1");
    expect(blockedResult.headers["RateLimit-Remaining"]).toBe("0");
  });

  it("should reset the bucket limit smoothly after window expiration", async () => {
    const key = "user_3";

    await evaluateRateLimit(key, store, defaultConfig);
    await evaluateRateLimit(key, store, defaultConfig);
    await evaluateRateLimit(key, store, defaultConfig);

    // Check 4th is blocked
    let res = await evaluateRateLimit(key, store, defaultConfig);
    expect(res.isBlocked).toBe(true);

    // Fast forward time past the 1-second window configuration
    vi.advanceTimersByTime(1001);

    // Next request should hit cleanly as hits reset back to 1
    res = await evaluateRateLimit(key, store, defaultConfig);
    expect(res.isBlocked).toBe(false);
    expect(res.headers["RateLimit-Remaining"]).toBe("2");
  });
});
