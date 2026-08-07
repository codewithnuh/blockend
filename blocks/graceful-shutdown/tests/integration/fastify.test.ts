import type { AddressInfo } from "node:net";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { GracefulShutdown } from "../../core/shutdown";
import {
  createFastifyTracker,
  registerFastifyShutdownHooks,
  createFastifyShutdownTask
} from "../../adapters/fastify";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("fastify integration", () => {
  const instances: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    for (const f of instances) {
      if (f.server.listening) {
        await new Promise<void>((resolve) => f.close(() => resolve()));
      }
    }
    instances.length = 0;
  });

  it("drains in-flight requests, 503s new ones, and closes the server", async () => {
    const fastify = Fastify();
    instances.push(fastify);

    const tracker = createFastifyTracker(fastify);
    const shutdown = new GracefulShutdown({
      installSignalHandlers: false,
      drainTimeoutMs: 5_000,
      connectionTracker: tracker
    });

    registerFastifyShutdownHooks(fastify, shutdown);
    shutdown.addTask(createFastifyShutdownTask(fastify));

    fastify.get("/slow", async () => {
      await sleep(800);
      return { ok: true };
    });
    fastify.get("/fast", async () => ({ ok: true }));

    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const port = (fastify.server.address() as AddressInfo).port;
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
    expect(result.completed).toContain("fastify-server");
    expect(fastify.server.listening).toBe(false);

    await expect(fetch(`${base}/fast`)).rejects.toThrow();
  });

  it("503 response carries the retry and connection headers", async () => {
    const fastify = Fastify();
    instances.push(fastify);

    const tracker = createFastifyTracker(fastify);
    const shutdown = new GracefulShutdown({
      installSignalHandlers: false,
      drainTimeoutMs: 5_000,
      connectionTracker: tracker
    });

    registerFastifyShutdownHooks(fastify, shutdown);
    shutdown.addTask(createFastifyShutdownTask(fastify));

    fastify.get("/slow", async () => {
      await sleep(600);
      return { ok: true };
    });

    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const port = (fastify.server.address() as AddressInfo).port;
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
