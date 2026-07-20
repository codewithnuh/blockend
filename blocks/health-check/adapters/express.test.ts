import { describe, it, expect, vi } from "vitest";
import { registerExpressHealthRoute } from "./express";
import { Health, HealthReport } from "../types";
import type { Express } from "express";
describe("registerExpressHealthRoute", () => {
  it("registers a GET route at the specified path", () => {
    const mockApp = { get: vi.fn() };
    const mockHealth = { run: vi.fn() };

    registerExpressHealthRoute(
      mockApp as unknown as Express,
      mockHealth as unknown as Health,
      "/custom-health"
    );

    expect(mockApp.get).toHaveBeenCalledWith("/custom-health", expect.any(Function));
  });

  it("returns 200 and the report when status is healthy", async () => {
    const mockApp = { get: vi.fn() };
    const mockReport: HealthReport = { status: "healthy", timestamp: "", uptime: 0, checks: [] };
    const mockHealth = { run: vi.fn().mockResolvedValue(mockReport) };

    registerExpressHealthRoute(mockApp as unknown as Express, mockHealth as unknown as Health);
    const handler = mockApp.get.mock.calls[0][1];

    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({}, mockRes as unknown);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(mockReport);
  });

  it("returns 200 when status is degraded (keeps node in load balancer)", async () => {
    const mockApp = { get: vi.fn() };
    const mockReport = { status: "degraded", timestamp: "", uptime: 0, checks: [] };
    const mockHealth = { run: vi.fn().mockResolvedValue(mockReport) };

    registerExpressHealthRoute(mockApp as unknown as Express, mockHealth as unknown as Health);
    const handler = mockApp.get.mock.calls[0][1];

    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({}, mockRes as unknown);

    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it("returns 503 and the report when status is unhealthy", async () => {
    const mockApp = { get: vi.fn() };
    const mockReport = { status: "unhealthy", timestamp: "", uptime: 0, checks: [] };
    const mockHealth = { run: vi.fn().mockResolvedValue(mockReport) };

    registerExpressHealthRoute(mockApp as unknown as Express, mockHealth as unknown as Health);
    const handler = mockApp.get.mock.calls[0][1];

    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({}, mockRes as unknown);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(mockReport);
  });
});
