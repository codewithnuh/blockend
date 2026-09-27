import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { TokenError } from "../../src/core/errors.js";
import type { TokenService } from "../../src/core/types.js";
import { createFastifyTokenPlugin } from "../../src/adapters/fastify.js";

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

describe("Fastify token adapter", () => {
  it("maps refresh results and token errors to HTTP responses", async () => {
    const app = Fastify();
    await app.register(createFastifyTokenPlugin(service));

    expect(
      (await app.inject({ method: "POST", url: "/refresh", payload: { refreshToken: "ok" } }))
        .statusCode
    ).toBe(200);
    expect(
      (await app.inject({ method: "POST", url: "/refresh", payload: { refreshToken: "bad" } }))
        .statusCode
    ).toBe(401);
    await app.close();
  });

  it("allows privileged routes only through the supplied authorization callback", async () => {
    const app = Fastify();
    await app.register(createFastifyTokenPlugin(service, { exposeIssue: true }));

    expect(
      (await app.inject({ method: "POST", url: "/issue", payload: { sub: "u" } })).statusCode
    ).toBe(403);
    await app.close();
  });
});
