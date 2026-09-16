import { describe, expect, it, vi } from "vitest";
import { AppError } from "./app-error";
import { createErrorBoundary } from "./create-error-boundary";

describe("createErrorBoundary", () => {
  it("serializes operational errors with safe details", async () => {
    const boundary = createErrorBoundary();
    const result = await boundary.handle(
      new AppError({
        code: "USER_NOT_FOUND",
        message: "User not found",
        statusCode: 404,
        details: { userId: "user-1" }
      }),
      { requestId: "req-1" }
    );

    expect(result).toEqual({
      statusCode: 404,
      body: {
        success: false,
        data: null,
        error: { message: "User not found", details: { userId: "user-1" } },
        requestId: "req-1"
      }
    });
  });

  it("hides unknown and non-operational errors", async () => {
    const boundary = createErrorBoundary();
    const unknown = await boundary.handle(new Error("postgres://admin:secret@internal/db"));
    const programmer = await boundary.handle(
      new AppError({
        code: "BROKEN_INVARIANT",
        message: "Internal file C:/srv/private.ts",
        statusCode: 400,
        isOperational: false
      })
    );

    for (const result of [unknown, programmer]) {
      expect(result.statusCode).toBe(500);
      expect(result.body).toEqual({
        success: false,
        data: null,
        error: { message: "Internal server error" }
      });
      expect(JSON.stringify(result.body)).not.toMatch(/postgres|private\.ts|secret/);
    }
  });

  it("classifies third-party errors without adding a dependency", async () => {
    class ValidationFailure extends Error {
      issues = [{ path: "email", message: "Invalid email" }];
    }

    const boundary = createErrorBoundary({
      classifier(error) {
        if (!(error instanceof ValidationFailure)) return undefined;
        return {
          code: "VALIDATION_FAILED",
          message: "Validation failed",
          category: "VALIDATION",
          details: error.issues
        };
      }
    });

    const result = await boundary.handle(new ValidationFailure());
    expect(result.statusCode).toBe(400);
    expect(result.body.error).toEqual({
      message: "Validation failed",
      details: [{ path: "email", message: "Invalid email" }]
    });
  });

  it("adds a timestamp when context is missing", async () => {
    const report = vi.fn();
    const boundary = createErrorBoundary({ reporter: { report } });
    await boundary.handle("not-an-error");

    const event = report.mock.calls[0]?.[0];
    expect(event?.context.timestamp).toEqual(expect.any(String));
    expect(event?.context.requestId).toBeUndefined();
    expect(event?.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("redacts sensitive fields in details and observability events", async () => {
    const report = vi.fn();
    const boundary = createErrorBoundary({ reporter: { report }, sensitiveKeys: ["privateKey"] });
    const circular: Record<string, unknown> = { authorization: "Bearer abc" };
    circular.self = circular;

    const result = await boundary.handle(
      new AppError({
        code: "INVALID_INPUT",
        message: "Invalid input",
        statusCode: 400,
        details: {
          password: "secret",
          accessToken: "token",
          privateKey: "key",
          circular
        },
        metadata: { clientSecret: "secret" }
      }),
      { metadata: { headers: { authorization: "Bearer abc" } } }
    );

    expect(result.body.error.details).toEqual({
      password: "[REDACTED]",
      accessToken: "[REDACTED]",
      privateKey: "[REDACTED]",
      circular: { authorization: "[REDACTED]", self: "[Circular]" }
    });
    expect(JSON.stringify(report.mock.calls[0]?.[0])).not.toContain("Bearer abc");
    expect(JSON.stringify(report.mock.calls[0]?.[0])).not.toContain('"secret"');
  });

  it("awaits reporters and ignores observability failures", async () => {
    const calls: string[] = [];
    const boundary = createErrorBoundary({
      logger: {
        error() {
          calls.push("logger");
          throw new Error("logger failed");
        }
      },
      reporter: {
        async report() {
          await Promise.resolve();
          calls.push("reporter");
          throw new Error("reporter failed");
        }
      }
    });

    const result = await boundary.handle(new Error("boom"));
    expect(calls).toEqual(["logger", "reporter"]);
    expect(result.statusCode).toBe(500);
  });

  it("falls back when a custom classifier or serializer throws", async () => {
    const boundary = createErrorBoundary({
      classifier() {
        throw new Error("classifier failed");
      },
      serializer() {
        throw new Error("serializer failed");
      }
    });

    const result = await boundary.handle(new Error("original failure"));
    expect(result.body.error.message).toBe("Internal server error");
  });
});
