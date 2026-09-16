import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../core/app-error";
import { createErrorBoundary } from "../core/create-error-boundary";
import { createExpressErrorHandler } from "./express";

describe("createExpressErrorHandler", () => {
  it("handles operational errors and extracts request context", async () => {
    const report = vi.fn();
    const boundary = createErrorBoundary({ reporter: { report } });
    const app = express();
    app.get("/users/:id", () => {
      throw new AppError({ code: "USER_NOT_FOUND", message: "User not found", statusCode: 404 });
    });
    app.use(
      createExpressErrorHandler(boundary, {
        getContext: () => ({ userId: "actor-1" })
      })
    );

    const response = await request(app).get("/users/42").set("x-request-id", "req-express");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: { message: "User not found" },
      requestId: "req-express"
    });
    expect(report.mock.calls[0]?.[0].context).toMatchObject({
      requestId: "req-express",
      userId: "actor-1",
      method: "GET",
      path: "/users/42"
    });
  });

  it("returns a safe response for unknown errors", async () => {
    const app = express();
    app.get("/crash", () => {
      throw new Error("SQL SELECT password FROM users");
    });
    app.use(createExpressErrorHandler(createErrorBoundary()));

    const response = await request(app).get("/crash");
    expect(response.status).toBe(500);
    expect(response.body.error.message).toBe("Internal server error");
    expect(JSON.stringify(response.body)).not.toContain("SELECT");
  });
});
