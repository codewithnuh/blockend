import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import type { Request, Response } from "express";
import request from "supertest";
import { rateLimit } from "../base.js";
import type { RateLimitStore, RateLimitRecord } from "../base.js";

// 🚀 Implement a strongly-typed in-memory mock storage class for precise control during testing
class MockRateLimitStore implements RateLimitStore {
  private memoryStore = new Map<string, { hits: number; resetTime: number }>();

  increment(key: string, windowMs: number): RateLimitRecord {
    const now = Date.now();
    const existing = this.memoryStore.get(key);

    if (!existing || now >= existing.resetTime) {
      const freshRecord = { hits: 1, resetTime: now + windowMs };
      this.memoryStore.set(key, freshRecord);
      return freshRecord;
    }

    existing.hits += 1;
    return existing;
  }

  // Helper mechanism to manually flood keys for isolation tests
  forceSet(key: string, record: RateLimitRecord): void {
    this.memoryStore.set(key, record);
  }
}

describe("Rate Limiter Block - Express Suite", () => {
  let mockStore: MockRateLimitStore;

  beforeEach(() => {
    mockStore = new MockRateLimitStore();
  });

  test("should allow requests through and add standardized IETF rate limit headers", async () => {
    const app = express();

    app.use(
      rateLimit({
        store: mockStore,
        max: 5,
        windowMs: 60 * 1000,
        standardHeaders: true
      })
    );

    app.get("/api/resource", (_req: Request, res: Response) => {
      res.status(200).json({ allowed: true });
    });

    const response = await request(app).get("/api/resource");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ allowed: true });

    // Assert standard header integrity mapping values
    expect(response.headers["ratelimit-limit"]).toBe("5");
    expect(response.headers["ratelimit-remaining"]).toBe("4");
    expect(response.headers["ratelimit-reset"]).toBeDefined();
  });

  test("should block users with a 429 status code once they exceed maximum thresholds", async () => {
    const app = express();

    app.use(
      rateLimit({
        store: mockStore,
        max: 2,
        statusCode: 429,
        message: { error: "Custom throttle message" },
        keyGenerator: () => "static-client-key" // Lock key resolution for exact simulation
      })
    );

    app.get("/api/limited", (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    // Hit 1 & 2: Safe requests
    await request(app).get("/api/limited");
    await request(app).get("/api/limited");

    // Hit 3: Breached threshold request
    const breachedResponse = await request(app).get("/api/limited");

    expect(breachedResponse.status).toBe(429);
    expect(breachedResponse.body).toEqual({ error: "Custom throttle message" });
    expect(breachedResponse.headers["ratelimit-remaining"]).toBe("0");
  });

  test("should fail-open gracefully if the core storage layer throws an exception", async () => {
    const app = express();

    // Spy on console.error to keep the CI testing output stream completely clean
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Force storage engine increments to explicitly drop/throw
    const breakingStore: RateLimitStore = {
      increment: () => {
        throw new Error("Redis connection dropped unexpectedly");
      }
    };

    app.use(
      rateLimit({
        store: breakingStore
      })
    );

    app.get("/api/fail-open", (_req: Request, res: Response) => {
      res.status(200).json({ systemHealth: "healthy" });
    });

    const response = await request(app).get("/api/fail-open");

    // The handler must still fulfill requests successfully (fail-open strategy verification)
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ systemHealth: "healthy" });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("should enforce key isolation based on keyGenerator outputs", async () => {
    const app = express();

    app.use(
      rateLimit({
        store: mockStore,
        max: 1,
        // Differentiate keys cleanly by custom structural headers
        keyGenerator: (req) => req.headers["x-client-id"]?.toString() || "anonymous"
      })
    );

    app.get("/api/isolated", (_req: Request, res: Response) => {
      res.status(200).json({ passed: true });
    });

    // Flood Client A
    await request(app).get("/api/isolated").set("x-client-id", "CLIENT-A");
    const blockedA = await request(app).get("/api/isolated").set("x-client-id", "CLIENT-A");
    expect(blockedA.status).toBe(429);

    // Client B should still pass flawlessly because of identifier separation bounds
    const passB = await request(app).get("/api/isolated").set("x-client-id", "CLIENT-B");
    expect(passB.status).toBe(200);
  });
});
