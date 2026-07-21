import { describe, it, expect, vi } from "vitest";
import { registerFastifyHealthRoute } from "./fastify";
import { FastifyInstance } from "fastify";
import type { Health } from "../types/index";

describe("registerFastifyHealthRoute", () => {
  it("registers a GET route at the default path", () => {
    const mockApp = { get: vi.fn() };
    const mockHealth = { run: vi.fn() };

    registerFastifyHealthRoute(
      mockApp as unknown as FastifyInstance,
      mockHealth as unknown as Health
    );

    expect(mockApp.get).toHaveBeenCalledWith("/health", expect.any(Function));
  });

  it("returns 200 for healthy and degraded statuses", async () => {
    const mockApp = { get: vi.fn() };
    const mockHealth = { run: vi.fn() };

    registerFastifyHealthRoute(mockApp as unknown as FastifyInstance, mockHealth as Health);
    const handler = mockApp.get.mock.calls[0][1];

    const mockReply = { code: vi.fn().mockReturnThis(), send: vi.fn() };

    // Test Healthy
    mockHealth.run.mockResolvedValueOnce({ status: "healthy" });
    await handler({}, mockReply as unknown);
    expect(mockReply.code).toHaveBeenCalledWith(200);

    // Test Degraded
    mockHealth.run.mockResolvedValueOnce({ status: "degraded" });
    await handler({}, mockReply as unknown);
    expect(mockReply.code).toHaveBeenCalledWith(200);
  });

  it("returns 503 for unhealthy status", async () => {
    const mockApp = { get: vi.fn() };
    const mockReport = { status: "unhealthy" };
    const mockHealth = { run: vi.fn().mockResolvedValue(mockReport) };

    registerFastifyHealthRoute(
      mockApp as unknown as FastifyInstance,
      mockHealth as unknown as Health
    );
    const handler = mockApp.get.mock.calls[0][1];

    const mockReply = { code: vi.fn().mockReturnThis(), send: vi.fn() };
    await handler({}, mockReply as unknown);

    expect(mockReply.code).toHaveBeenCalledWith(503);
    expect(mockReply.send).toHaveBeenCalledWith(mockReport);
  });
});
