import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../core/app-error";
import { createErrorBoundary } from "../core/create-error-boundary";
import { registerFastifyErrorHandler } from "./fastify";

describe("registerFastifyErrorHandler", () => {
  it("uses Fastify's error lifecycle and request context", async () => {
    const report = vi.fn();
    const app = Fastify({ genReqId: () => "req-fastify" });
    registerFastifyErrorHandler(app, createErrorBoundary({ reporter: { report } }), {
      getContext: () => ({ userId: "actor-2" })
    });
    app.get("/private", async () => {
      throw new AppError({ code: "FORBIDDEN", message: "Forbidden", category: "AUTHORIZATION" });
    });

    const response = await app.inject({ method: "GET", url: "/private" });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      success: false,
      data: null,
      error: { message: "Forbidden" },
      requestId: "req-fastify"
    });
    expect(report.mock.calls[0]?.[0].context).toMatchObject({
      requestId: "req-fastify",
      userId: "actor-2",
      method: "GET",
      path: "/private"
    });
    await app.close();
  });

  it("hides unknown errors", async () => {
    const app = Fastify();
    registerFastifyErrorHandler(app, createErrorBoundary());
    app.get("/crash", async () => {
      throw new Error("internal database host");
    });

    const response = await app.inject({ method: "GET", url: "/crash" });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.message).toBe("Internal server error");
    await app.close();
  });
});
