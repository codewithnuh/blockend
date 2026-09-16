import { describe, expect, it } from "vitest";
import { AppError } from "./app-error";

describe("AppError", () => {
  it("stores production error metadata and infers defaults", () => {
    const cause = new Error("query failed");
    const error = new AppError({
      code: "USER_NOT_FOUND",
      message: "User not found",
      category: "NOT_FOUND",
      cause,
      metadata: { userId: "user-1" },
      details: { field: "userId" }
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "AppError",
      code: "USER_NOT_FOUND",
      statusCode: 404,
      category: "NOT_FOUND",
      severity: "warning",
      isOperational: true,
      cause,
      metadata: { userId: "user-1" },
      details: { field: "userId" }
    });
  });

  it("defaults server errors to non-operational", () => {
    const error = new AppError({ code: "DATABASE_FAILED", message: "Database failed" });
    expect(error.statusCode).toBe(500);
    expect(error.category).toBe("INTERNAL");
    expect(error.severity).toBe("error");
    expect(error.isOperational).toBe(false);
  });

  it("normalizes invalid status codes to a safe mapped status", () => {
    const error = new AppError({
      code: "INVALID_STATUS",
      message: "Invalid status",
      statusCode: 200,
      category: "CONFLICT"
    });
    expect(error.statusCode).toBe(409);
  });

  it("keeps the deprecated positional constructor working", () => {
    const error = new AppError(409, "Already exists", false);
    expect(error).toMatchObject({
      code: "APP_ERROR",
      statusCode: 409,
      message: "Already exists",
      isOperational: false
    });
  });
});
