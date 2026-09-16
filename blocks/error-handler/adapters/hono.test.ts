import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../core/app-error";
import { createErrorBoundary } from "../core/create-error-boundary";
import { registerHonoErrorHandler } from "./hono";

describe("createHonoErrorHandler", () => {
  it("handles errors and extracts Hono context", async () => {
    const report = vi.fn();
    const app = new Hono<{ Variables: { requestId: string } }>();
    registerHonoErrorHandler(app, createErrorBoundary({ reporter: { report } }), {
      getContext: () => ({ userId: "actor-3" })
    });
    app.get("/users/missing", () => {
      throw new AppError({ code: "USER_NOT_FOUND", message: "User not found", statusCode: 404 });
    });

    const response = await app.request("/users/missing", {
      headers: { "x-request-id": "req-hono" }
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      data: null,
      error: { message: "User not found" },
      requestId: "req-hono"
    });
    expect(report.mock.calls[0]?.[0].context).toMatchObject({
      requestId: "req-hono",
      userId: "actor-3",
      method: "GET",
      path: "/users/missing"
    });
  });

  it("hides unknown errors", async () => {
    const app = new Hono();
    registerHonoErrorHandler(app, createErrorBoundary());
    app.get("/crash", () => {
      throw new Error("internal path C:/srv/api.ts");
    });

    const response = await app.request("/crash");
    const body = (await response.json()) as { error: { message: string } };
    expect(response.status).toBe(500);
    expect(body.error.message).toBe("Internal server error");
  });
});
