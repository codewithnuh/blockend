import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { NodeConnectionTracker } from "../../core/connection-tracker";

const listen = (server: Server) =>
  new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = (server: Server) => (server.address() as AddressInfo).port;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Polls until `predicate` is true or the timeout elapses. Used instead of fixed
// sleeps so assertions don't race the event loop under heavy parallel test load.
const waitFor = async (predicate: () => boolean, timeoutMs = 5_000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await sleep(10);
  }
};

describe("NodeConnectionTracker", () => {
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

  it("tracks active requests and drains to zero", async () => {
    const server = createServer((_req, res) => setTimeout(() => res.end("ok"), 50));
    servers.push(server);
    await listen(server);

    const tracker = new NodeConnectionTracker().attach(server);
    const port = address(server);

    const inflight = Promise.all([
      fetch(`http://127.0.0.1:${port}/`),
      fetch(`http://127.0.0.1:${port}/`)
    ]);

    await waitFor(() => tracker.activeCount > 0);
    expect(tracker.activeCount).toBeGreaterThan(0);

    await inflight;
    await waitFor(() => tracker.activeCount === 0);

    expect(tracker.activeCount).toBe(0);
  });

  it("never double-decrements when both finish and close fire", async () => {
    const server = createServer((_req, res) => res.end("ok"));
    servers.push(server);
    await listen(server);

    const tracker = new NodeConnectionTracker().attach(server);
    const port = address(server);

    for (let i = 0; i < 5; i++) {
      await fetch(`http://127.0.0.1:${port}/`);
      await sleep(10);
      expect(tracker.activeCount).toBe(0);
    }
  });

  it("decrements when the client disconnects mid-request", async () => {
    const server = createServer((_req, res) => {
      // Never respond — the client abort is what releases the count.
      setTimeout(() => res.end("too late"), 5_000);
    });
    servers.push(server);
    await listen(server);

    const tracker = new NodeConnectionTracker().attach(server);
    const port = address(server);

    const controller = new AbortController();
    void fetch(`http://127.0.0.1:${port}/`, { signal: controller.signal }).catch(() => {});

    await waitFor(() => tracker.activeCount === 1);
    expect(tracker.activeCount).toBe(1);

    controller.abort();
    await waitFor(() => tracker.activeCount === 0);

    expect(tracker.activeCount).toBe(0);
  });

  it("waitForDrain resolves immediately when there is nothing active", async () => {
    const tracker = new NodeConnectionTracker();
    await expect(tracker.waitForDrain(1_000)).resolves.toBeUndefined();
  });

  it("waitForDrain resolves once the active request finishes", async () => {
    const server = createServer((_req, res) => setTimeout(() => res.end("ok"), 80));
    servers.push(server);
    await listen(server);

    const tracker = new NodeConnectionTracker().attach(server);
    const port = address(server);

    const inflight = fetch(`http://127.0.0.1:${port}/`);
    await sleep(10);

    await expect(tracker.waitForDrain(5_000)).resolves.toBeUndefined();
    await inflight;
  });

  it("waitForDrain rejects when a request stays active past the timeout", async () => {
    const server = createServer(() => {
      // Request never completes.
    });
    servers.push(server);
    await listen(server);

    const tracker = new NodeConnectionTracker().attach(server);
    const port = address(server);

    const inflight = fetch(`http://127.0.0.1:${port}/`).catch(() => {});
    await waitFor(() => tracker.activeCount > 0);

    await expect(tracker.waitForDrain(100)).rejects.toThrow("Drain timed out");

    // Cleanup: the hanging server response socket is aborted by closing.
    server.closeAllConnections?.();
    await inflight;
  });

  it("isAttachable returns true for a tracker with attach()", async () => {
    const { isAttachable } = await import("../../core/connection-tracker.js");
    expect(isAttachable(new NodeConnectionTracker())).toBe(true);
  });
});
