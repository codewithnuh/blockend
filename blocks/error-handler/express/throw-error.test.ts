import { describe, expect, it } from "vitest";
import { AppError } from "./app-error";
import { ERRORS } from "./errors";
import { throwError } from "./throw-error";

describe("throwError", () => {
  it("throws an AppError from a catalog entry", () => {
    expect(() => throwError(ERRORS.NOT_FOUND)).toThrow(AppError);

    try {
      throwError(ERRORS.NOT_FOUND);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 404,
        message: "Not found",
        isOperational: true
      });
    }
  });
});
