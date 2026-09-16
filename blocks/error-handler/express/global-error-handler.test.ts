import { describe, expect, it } from "vitest";
import express from "express";
import type { Request, Response } from "express";
import request from "supertest";
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
      error: { message: "Email already registered" }
    });
  });

  it("returns a generic 500 response for unknown errors", async () => {
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
      error: { message: "Internal server error" }
    });
    expect(JSON.stringify(response.body)).not.toContain("secret connection string");
  });
});
