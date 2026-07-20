import { describe, test, expect } from "vitest";
import { Hono } from "hono";
import { logger } from "../core.js";
import { honoLoggerAdapter } from "./hono.js";

// 🚀 Explicit interface for parsing the structured logger stream output
interface ParsedHonoHttpLog {
  msg: string;
  requestId: string;
  http: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  };
}

describe("Logger Block - Hono Adapter Production Suite", () => {
  test("should catch context requests and write correct performance schemas into streams", async () => {
    let loggedOutput = "";

    const testStream = {
      write(stringData: string): void {
        loggedOutput += stringData;
      }
    };

    // Safely swap out global pino streams without violating system method overloads
    const streamSymbol = Object.getOwnPropertySymbols(logger).find(
      (sym) => sym.description === "pino.stream"
    );
    if (streamSymbol) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (logger as any)[streamSymbol] = testStream;
    }

    // Explicitly define your custom context variables signature inside Hono
    const app = new Hono<{ Variables: { requestId: string } }>();

    // Register your adapter middleware
    app.use("*", honoLoggerAdapter());

    app.get("/api/v1/resource", (c) => {
      const currentRequestId = c.get("requestId");
      return c.json({ traceId: currentRequestId });
    });

    // Execute via Hono's standard Web Request interface
    const response = await app.request("/api/v1/resource", {
      method: "GET",
      headers: {
        "x-request-id": "HONO-PROD-TEST-TOKEN"
      }
    });

    expect(response.status).toBe(200);

    const responseBody = (await response.json()) as { traceId: string };
    expect(responseBody.traceId).toBe("HONO-PROD-TEST-TOKEN");

    // Extract, parse, and validate production output metrics
    expect(loggedOutput).not.toBe("");
    const parsedLog = JSON.parse(loggedOutput) as ParsedHonoHttpLog;

    expect(parsedLog.msg).toBe("HTTP GET /api/v1/resource completed");
    expect(parsedLog.requestId).toBe("HONO-PROD-TEST-TOKEN");
    expect(parsedLog.http).toMatchObject({
      method: "GET",
      path: "/api/v1/resource",
      statusCode: 200
    });
    expect(typeof parsedLog.http.durationMs).toBe("number");
  });
});
