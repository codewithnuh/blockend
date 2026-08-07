import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { createHttpShutdownTask } from "../../utils/http";
import { PRIORITY } from "../../constants";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("createHttpShutdownTask", () => {
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

  it("has the http-server name and top priority", () => {
    const task = createHttpShutdownTask(createServer());
    expect(task.name).toBe("http-server");
    expect(task.priority).toBe(PRIORITY.HTTP_SERVER);
  });

  it("closes a listening server", async () => {
    const server = createServer((_req, res) => res.end("ok"));
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;

    const task = createHttpShutdownTask(server);
    await task.handler();

    expect(server.listening).toBe(false);
    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
  });

  it("waits for an in-flight request to finish before resolving", async () => {
    const server = createServer((_req, res) => setTimeout(() => res.end("ok"), 150));
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;

    const inflight = fetch(`http://127.0.0.1:${port}/`);
    await sleep(20);

    const task = createHttpShutdownTask(server, { timeout: 5_000 });
    await task.handler();

    expect((await inflight).status).toBe(200);
  });

  it("resolves gracefully when the server is already closed", async () => {
    const server = createServer();
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, r));
    await new Promise<void>((r) => server.close(() => r()));

    const task = createHttpShutdownTask(server);
    await expect(task.handler()).resolves.toBeUndefined();
  });

  it("rejects when the server has active connections beyond the task timeout", async () => {
    const server = createServer(() => {
      // Never respond.
    });
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;

    const inflight = fetch(`http://127.0.0.1:${port}/`).catch(() => {});
    await sleep(20);

    const task = createHttpShutdownTask(server, { timeout: 100 });
    await expect(task.handler()).rejects.toThrow();

    server.closeAllConnections?.();
    await inflight;
  });
});
