import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyRequest } from "fastify";
import type { RateLimitStore } from "../core/core";
import { fastifyRateLimit } from "./fastify";

describe("fastifyRateLimit", () => {
  it("allows requests inside the limit and sets rate limit headers", async () => {
    const store: RateLimitStore = {
      increment: vi.fn().mockResolvedValue({
        hits: 1,
        resetTime: Date.now() + 60_000
      })
    };
    const app = Fastify({ logger: false });

    app.addHook(
      "onRequest",
      fastifyRateLimit({
        store,
        windowMs: 60_000,
        max: 2,
        keyGenerator: (req: FastifyRequest) => String(req.headers["x-user-id"])
      })
    );
    app.get("/resource", async () => ({ ok: true }));

    const response = await app.inject({
      method: "GET",
      url: "/resource",
      headers: {
        "x-user-id": "user-123"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(response.headers["ratelimit-limit"]).toBe("2, window=60");
    expect(response.headers["ratelimit-remaining"]).toBe("1");
    expect(response.headers["x-ratelimit-limit"]).toBe("2");
    expect(store.increment).toHaveBeenCalledWith("user-123", 60_000);

    await app.close();
  });

  it("blocks requests over the limit with configured status and payload", async () => {
    const store: RateLimitStore = {
      increment: vi.fn().mockResolvedValue({
        hits: 3,
        resetTime: Date.now() + 15_000
      })
    };
    const app = Fastify({ logger: false });

    app.addHook(
      "onRequest",
      fastifyRateLimit({
        store,
        windowMs: 15_000,
        max: 2,
        message: { error: "slow down" },
        keyGenerator: () => "blocked-user"
      })
    );
    app.get("/limited", async () => ({ shouldNotRun: true }));

    const response = await app.inject({
      method: "GET",
      url: "/limited"
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({ error: "slow down" });
    expect(response.headers["retry-after"]).toBe("15");
    expect(response.headers["ratelimit-remaining"]).toBe("0");

    await app.close();
  });

  it("fails open when the backing store throws", async () => {
    const store: RateLimitStore = {
      increment: vi.fn().mockRejectedValue(new Error("redis unavailable"))
    };
    const app = Fastify({ logger: false });
    const logError = vi.spyOn(app.log, "error").mockImplementation(() => undefined);

    app.addHook("onRequest", fastifyRateLimit({ store }));
    app.get("/fail-open", async () => ({ ok: true }));

    const response = await app.inject({
      method: "GET",
      url: "/fail-open"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(logError).toHaveBeenCalledWith(expect.any(Error), "Rate limiter failure (Fail-Open)");

    await app.close();
  });
});
