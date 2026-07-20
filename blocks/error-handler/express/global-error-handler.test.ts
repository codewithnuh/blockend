import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { Request, Response } from "express";
import request from "supertest";
import { z } from "zod";
import { AppError } from "./app-error";
import { globalErrorHandler } from "./global-error-handler";

describe("globalErrorHandler", () => {
  it("serializes operational AppError instances without leaking extra fields", async () => {
    const app = express();

    app.get("/conflict", () => {
      throw new AppError(409, "Email already registered");
    });
    app.use(globalErrorHandler);

    const response = await request(app).get("/conflict");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Email already registered"
    });
  });

  it("maps ZodError failures to a structured 400 response", async () => {
    const app = express();

    app.get("/validate", () => {
      z.object({ id: z.string().uuid() }).parse({ id: "invalid" });
    });
    app.use(globalErrorHandler);

    const response = await request(app).get("/validate");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      message: "Validation failed"
    });
    expect(response.body.errors).toHaveProperty("properties.id");
  });

  it("logs unknown errors and returns a generic 500 response", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();

    app.get("/crash", (_req: Request, _res: Response) => {
      throw new Error("secret connection string leaked here");
    });
    app.use(globalErrorHandler);

    const response = await request(app).get("/crash");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      data: null,
      message: "Internal server error"
    });
    expect(JSON.stringify(response.body)).not.toContain("secret connection string");
    expect(consoleError).toHaveBeenCalledWith(
      "[UNHANDLED ERROR]",
      expect.objectContaining({
        method: "GET",
        path: "/crash",
        error: expect.any(Error)
      })
    );

    consoleError.mockRestore();
  });
});
