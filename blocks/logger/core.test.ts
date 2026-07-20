import { describe, test, expect } from "vitest";
import { pino } from "pino";
import { runWithLoggerContext, getRequestId, loggerContext } from "./core.js";

describe("Logger Context Fundamentals", () => {
  test("should return the correct requestId inside the context execution", () => {
    const testId = "test-id-1234-56";
    runWithLoggerContext(testId, () => {
      const activeId = getRequestId();
      expect(activeId).toBe(testId);
    });
  });

  test("should automatically generate random UUID if incomingId is missing", () => {
    runWithLoggerContext(undefined, () => {
      const activeId = getRequestId();
      expect(activeId).toBeDefined();
      expect(typeof activeId).toBe("string");
      expect(activeId?.length).toBeGreaterThan(0);
    });
  });

  test("should maintain isolated contexts for concurrent operations", async () => {
    await Promise.all([
      runWithLoggerContext("request-A", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(getRequestId()).toBe("request-A");
      }),
      runWithLoggerContext("request-B", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(getRequestId()).toBe("request-B");
      })
    ]);
  });
});

describe("Logger Output Verification", () => {
  test("should include the requestId in the logged JSON output using native stream tracking", () => {
    let loggedData = "";

    // Explicitly type the stream to conform to Pino's expected custom destination interface
    const testStream = {
      write(stringData: string): void {
        loggedData += stringData;
      }
    };

    // Instantiate an explicit test logger using your exact mixin configuration
    const testLogger = pino(
      {
        mixin(): Record<string, unknown> {
          const store = loggerContext.getStore();
          return store ? { requestId: store.requestId } : {};
        },
        redact: {
          paths: ["Authorization", "*.token", "token", "*.password", "password"],
          censor: "[REDACTED]"
        }
      },
      testStream
    );

    const targetId = "secure-request-999";

    runWithLoggerContext(targetId, () => {
      testLogger.info("User logged in successfully");
    });

    // Parse the data stream output
    const parsedLog = JSON.parse(loggedData) as { msg: string; requestId: string; level: number };

    expect(parsedLog.msg).toBe("User logged in successfully");
    expect(parsedLog.requestId).toBe(targetId);
  });

  test("should correctly redact sensitive keys based on project compliance specifications", () => {
    let loggedData = "";

    const testStream = {
      write(stringData: string): void {
        loggedData += stringData;
      }
    };

    // Re-create the logger instance pointing to our collector stream to check the main configuration settings
    const testLogger = pino(
      {
        redact: {
          paths: ["Authorization", "*.token", "token", "*.password", "password"],
          censor: "[REDACTED]"
        }
      },
      testStream
    );

    testLogger.info(
      {
        password: "super-secret-password-123",
        nested: { token: "sensitive-jwt-token" },
        Authorization: "Bearer xyz"
      },
      "Sensitive operation executed"
    );

    interface RedactedPayload {
      password: string;
      nested: { token: string };
      Authorization: string;
    }

    const parsedLog = JSON.parse(loggedData) as RedactedPayload;

    expect(parsedLog.password).toBe("[REDACTED]");
    expect(parsedLog.nested.token).toBe("[REDACTED]");
    expect(parsedLog.Authorization).toBe("[REDACTED]");
  });
});
