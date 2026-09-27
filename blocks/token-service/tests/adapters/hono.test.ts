import { describe, expect, it, vi } from "vitest";
import { TokenError } from "../../src/core/errors.js";
import type { TokenService } from "../../src/core/types.js";
import { createHonoTokenRoutes } from "../../src/adapters/hono.js";

const service: TokenService = {
  issue: vi.fn(async () => ({ tokenType: "Bearer" as const, issuedAt: 1 })),
  verify: vi.fn(async () => ({
    valid: true as const,
    claims: { sub: "u", iss: "i", exp: 2, iat: 1, jti: "j", type: "access" as const }
  })),
  refresh: vi.fn(async (token: string) => {
    if (token === "bad") throw new TokenError("INVALID_TOKEN", "Invalid refresh token");
    return {
      tokenType: "Bearer" as const,
      issuedAt: 1,
      accessToken: "access",
      refreshToken: "refresh"
    };
  }),
  revoke: vi.fn(async () => undefined)
};

describe("Hono token adapter", () => {
  it("maps refresh results and token errors to HTTP responses", async () => {
    const app = createHonoTokenRoutes(service);
    const success = await app.request("/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "ok" })
    });
    const failure = await app.request("/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "bad" })
    });

    expect(success.status).toBe(200);
    expect(failure.status).toBe(401);
  });

  it("does not expose revoke without an authorization callback", async () => {
    const app = createHonoTokenRoutes(service, { exposeRevoke: true });
    const response = await app.request("/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sub: "u" })
    });

    expect(response.status).toBe(403);
  });

  it("returns client errors for malformed JSON and sanitizes authorization failures", async () => {
    const app = createHonoTokenRoutes(service, {
      exposeRevoke: true,
      authorize: async () => {
        throw new Error("private authorization detail");
      }
    });
    const malformed = await app.request("/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("INVALID_INPUT");

    const revoke = await app.request("/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sub: "u" })
    });
    expect(revoke.status).toBe(500);
    const body = await revoke.json();
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Token operation failed" } });
    expect(JSON.stringify(body)).not.toContain("private authorization detail");
  });
});
