import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { Request, Response } from "express";
import request from "supertest";
import type { RateLimitStore } from "../core/core";
import { expressRateLimit } from "./express";

describe("expressRateLimit", () => {
  it("allows requests inside the limit and exposes standard plus legacy headers", async () => {
    const store: RateLimitStore = {
      increment: vi.fn().mockResolvedValue({
        hits: 1,
        resetTime: Date.now() + 60_000
      })
    };
    const app = express();

    app.get(
      "/resource",
      expressRateLimit({
        store,
        windowMs: 60_000,
        max: 2,
        keyGenerator: (req: Request) => String(req.headers["x-user-id"])
      }),
      (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      }
    );

    const response = await request(app).get("/resource").set("x-user-id", "user-123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers["ratelimit-limit"]).toBe("2, window=60");
    expect(response.headers["ratelimit-remaining"]).toBe("1");
    expect(response.headers["x-ratelimit-limit"]).toBe("2");
    expect(store.increment).toHaveBeenCalledWith("user-123", 60_000);
  });

  it("blocks requests over the limit with configured status and body", async () => {
    const store: RateLimitStore = {
      increment: vi.fn().mockResolvedValue({
        hits: 4,
        resetTime: Date.now() + 30_000
      })
    };
    const app = express();

    app.get(
      "/limited",
      expressRateLimit({
        store,
        windowMs: 30_000,
        max: 3,
        statusCode: 429,
        message: { error: "rate limit exceeded" },
        keyGenerator: () => "limited-user"
      }),
      (_req: Request, res: Response) => {
        res.status(200).json({ shouldNotRun: true });
      }
    );

    const response = await request(app).get("/limited");

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate limit exceeded" });
    expect(response.headers["retry-after"]).toBe("30");
    expect(response.headers["ratelimit-remaining"]).toBe("0");
  });

  it("fails open when the backing store throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store: RateLimitStore = {
      increment: vi.fn().mockRejectedValue(new Error("redis unavailable"))
    };
    const app = express();

    app.get("/fail-open", expressRateLimit({ store }), (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get("/fail-open");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(consoleError).toHaveBeenCalledWith(
      "Rate limiter failure (Fail-Open):",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
