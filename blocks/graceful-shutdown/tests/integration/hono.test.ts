import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";

import { GracefulShutdown } from "../../core/shutdown";
import {
  createHonoShutdownMiddleware,
  createHonoTracker,
  createHonoShutdownTask
} from "../../adapters/hono";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("hono (node) integration", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (s) =>
          new Promise<void>((resolve) => {
            if (s.listening) s.close(() => resolve());
            else resolve();
          })
      )
    );
    servers.length = 0;
  });

  it("drains in-flight requests, 503s new ones, and closes the server", async () => {
    const app = new Hono();
    const server = createServer(getRequestListener(app.fetch));
    servers.push(server);
    const tracker = createHonoTracker(server);
    const shutdown = new GracefulShutdown({
      installSignalHandlers: false,
      drainTimeoutMs: 5_000,
      connectionTracker: tracker
    });

    app.use("*", createHonoShutdownMiddleware(shutdown));

    app.get("/slow", async (c) => {
      await sleep(800);
      return c.json({ ok: true });
    });
    app.get("/fast", (c) => c.json({ ok: true }));

    shutdown.addTask(createHonoShutdownTask(server));

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    const inflight = fetch(`${base}/slow`).then((r) => r.status);
    await sleep(50);

    const resultPromise = shutdown.shutdown("test");
    const during = await fetch(`${base}/fast`).then((r) => r.status);

    const inflightStatus = await inflight;
    const result = await resultPromise;

    expect(inflightStatus).toBe(200);
    expect(during).toBe(503);
    expect(result.success).toBe(true);
    expect(result.failed).toEqual([]);
    expect(result.completed).toContain("http-server");
    expect(server.listening).toBe(false);

    await expect(fetch(`${base}/fast`)).rejects.toThrow();
  });

  it("503 response carries the retry and connection headers", async () => {
    const app = new Hono();
    const server = createServer(getRequestListener(app.fetch));
    servers.push(server);
    const tracker = createHonoTracker(server);
    const shutdown = new GracefulShutdown({
      installSignalHandlers: false,
      drainTimeoutMs: 5_000,
      connectionTracker: tracker
    });

    app.use("*", createHonoShutdownMiddleware(shutdown));
    app.get("/slow", async (c) => {
      await sleep(600);
      return c.json({ ok: true });
    });

    shutdown.addTask(createHonoShutdownTask(server));

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    const inflight = fetch(`${base}/slow`).catch(() => {});
    await sleep(50);
    void shutdown.shutdown("test");

    const res = await fetch(`${base}/fast`);
    expect(res.status).toBe(503);
    expect(res.headers.get("connection")).toBe("close");
    expect(res.headers.get("retry-after")).toBe("30");

    await inflight;
    await shutdown.shutdown("test");
  });
});
