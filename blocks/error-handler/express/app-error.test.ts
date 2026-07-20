import { describe, expect, it } from "vitest";
import { AppError } from "./app-error";

describe("AppError", () => {
  it("preserves Error inheritance and operational metadata", () => {
    const error = new AppError(409, "User already exists");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AppError");
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("User already exists");
    expect(error.isOperational).toBe(true);
  });

  it("allows callers to mark an error as non-operational", () => {
    const error = new AppError(500, "Unsafe implementation detail", false);

    expect(error.isOperational).toBe(false);
  });
});
