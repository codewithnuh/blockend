import { describe, it, expect, vi } from "vitest";
import { registerHonoHealthRoute } from "./hono";
import { Hono } from "hono";
import { Health } from "../types/index";

describe("registerHonoHealthRoute", () => {
  it("registers a GET route", () => {
    const mockApp = { get: vi.fn() };
    const mockHealth = { run: vi.fn() };

    registerHonoHealthRoute(mockApp as unknown as Hono, mockHealth as unknown as Health, "/ping");

    expect(mockApp.get).toHaveBeenCalledWith("/ping", expect.any(Function));
  });

  it("maps healthy and degraded to 200 OK", async () => {
    const mockApp = { get: vi.fn() };
    const mockHealth = { run: vi.fn() };

    registerHonoHealthRoute(mockApp as unknown as Hono, mockHealth as unknown as Health);
    const handler = mockApp.get.mock.calls[0][1];

    const mockCtx = { json: vi.fn() };

    mockHealth.run.mockResolvedValueOnce({ status: "healthy" });
    await handler(mockCtx as unknown);
    expect(mockCtx.json).toHaveBeenCalledWith({ status: "healthy" }, 200);

    mockHealth.run.mockResolvedValueOnce({ status: "degraded" });
    await handler(mockCtx as unknown);
    expect(mockCtx.json).toHaveBeenCalledWith({ status: "degraded" }, 200);
  });

  it("maps unhealthy to 503 Service Unavailable", async () => {
    const mockApp = { get: vi.fn() };
    const mockReport = { status: "unhealthy" };
    const mockHealth = { run: vi.fn().mockResolvedValue(mockReport) };

    registerHonoHealthRoute(mockApp as unknown as Hono, mockHealth as unknown as Health);
    const handler = mockApp.get.mock.calls[0][1];

    const mockCtx = { json: vi.fn() };
    await handler(mockCtx as unknown);

    expect(mockCtx.json).toHaveBeenCalledWith(mockReport, 503);
  });
});
