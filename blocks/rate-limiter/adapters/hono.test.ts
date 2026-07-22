import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { honoRateLimit } from "../adapters/hono";
import { MemoryStore } from "../variants/memory-store"; // adjust path

describe("honoRateLimit", () => {
  it("allows requests under the limit", async () => {
    const app = new Hono();

    app.use(
      "*",
      honoRateLimit({
        store: new MemoryStore(),
        max: 2,
        windowMs: 60_000
      })
    );

    app.get("/", (c) => c.text("OK"));

    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  it("blocks requests over the limit", async () => {
    const app = new Hono();

    app.use(
      "*",
      honoRateLimit({
        store: new MemoryStore(),
        max: 1,
        windowMs: 60_000
      })
    );

    app.get("/", (c) => c.text("OK"));

    const first = await app.request("/");
    expect(first.status).toBe(200);

    const second = await app.request("/");

    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({
      error: "Too many requests, please try again later."
    });
  });

  it("sets rate limit headers", async () => {
    const app = new Hono();

    app.use(
      "*",
      honoRateLimit({
        store: new MemoryStore(),
        max: 2,
        windowMs: 60_000
      })
    );

    app.get("/", (c) => c.text("OK"));

    const res = await app.request("/");

    expect(res.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("1");
  });

  it("uses a custom key generator", async () => {
    const app = new Hono();

    app.use(
      "*",
      honoRateLimit({
        store: new MemoryStore(),
        max: 1,
        windowMs: 60_000,
        keyGenerator: () => "custom-user"
      })
    );

    app.get("/", (c) => c.text("OK"));

    await app.request("/");
    const second = await app.request("/");

    expect(second.status).toBe(429);
  });
});
