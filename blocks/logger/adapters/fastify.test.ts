import { describe, test, expect } from "vitest";
import Fastify from "fastify";
import { DestinationStream } from "pino";
import { logger } from "../core.js";
import { fastifyLogger } from "./fastify.js";

interface ParsedHttpLog {
  msg: string;
  requestId: string;
  http: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  };
}

describe("Logger Block - Fastify Adapter Production Suite", () => {
  test("should track request execution durations and append structural tracking fields safely", async () => {
    let loggedOutput = "";

    const testStream: DestinationStream = {
      write(stringData: string): void {
        loggedOutput += stringData;
      }
    };

    // Swap the global logger's stream out for our string collector interceptor
    const streamSymbol = Object.getOwnPropertySymbols(logger).find(
      (sym) => sym.description === "pino.stream"
    );
    if (streamSymbol) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (logger as any)[streamSymbol] = testStream;
    }

    const app = Fastify({ logger: false });

    // Register the fully typed plugin middleware layer
    await app.register(fastifyLogger);

    app.get("/test-endpoint", async (_request, _reply) => {
      return { ok: true };
    });

    // Use Fastify's light internal in-memory network mock inject layer
    const response = await app.inject({
      method: "GET",
      url: "/test-endpoint",
      headers: {
        "x-request-id": "FASTIFY-TEST-ID-1234"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    // Verify stream output captures performance logs
    expect(loggedOutput).not.toBe("");

    const parsedLog = JSON.parse(loggedOutput) as ParsedHttpLog;

    expect(parsedLog.msg).toBe("HTTP GET /test-endpoint completed");
    expect(parsedLog.requestId).toBe("FASTIFY-TEST-ID-1234");
    expect(parsedLog.http).toMatchObject({
      method: "GET",
      path: "/test-endpoint",
      statusCode: 200
    });
    expect(typeof parsedLog.http.durationMs).toBe("number");
  });
});
