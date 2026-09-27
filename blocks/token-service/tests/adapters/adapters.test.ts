import express from "express";
import Fastify from "fastify";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { TokenError } from "../../src/core/errors.js";
import type { TokenService } from "../../src/core/types.js";
import { createExpressTokenRouter } from "../../src/adapters/express.js";
import { createFastifyTokenPlugin } from "../../src/adapters/fastify.js";
import { createHonoTokenRoutes } from "../../src/adapters/hono.js";

function service(): TokenService {
  return {
    issue: vi.fn(async () => ({
      tokenType: "Bearer" as const,
      issuedAt: 1,
      accessToken: "access"
    })),
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
}

describe("HTTP adapters", () => {
  it("Express maps success/errors and protects privileged routes", async () => {
    const tokens = service();
    const app = express();
    app.use(express.json());
    app.use(createExpressTokenRouter(tokens, { exposeIssue: true }));
    await request(app)
      .post("/refresh")
      .send({ refreshToken: "ok" })
      .expect(200)
      .expect(({ body }) => expect(body.accessToken).toBe("access"));
    await request(app)
      .post("/refresh")
      .send({ refreshToken: "bad" })
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("INVALID_TOKEN"));
    await request(app).post("/issue").send({ sub: "u" }).expect(403);
  });

  it("Fastify maps requests and permits explicitly authorized issue", async () => {
    const tokens = service();
    const app = Fastify();
    await app.register(
      createFastifyTokenPlugin(tokens, { exposeIssue: true, authorize: async () => true })
    );
    expect(
      (await app.inject({ method: "POST", url: "/refresh", payload: { refreshToken: "ok" } }))
        .statusCode
    ).toBe(200);
    expect(
      (await app.inject({ method: "POST", url: "/refresh", payload: { refreshToken: "bad" } }))
        .statusCode
    ).toBe(401);
    expect(
      (await app.inject({ method: "POST", url: "/issue", payload: { sub: "u" } })).statusCode
    ).toBe(200);
    await app.close();
  });

  it("Hono maps requests and protects revoke", async () => {
    const tokens = service();
    const app = createHonoTokenRoutes(tokens, { exposeRevoke: true });
    const success = await app.request("/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "ok" })
    });
    expect(success.status).toBe(200);
    const failure = await app.request("/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "bad" })
    });
    expect(failure.status).toBe(401);
    expect(
      (
        await app.request("/revoke", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}"
        })
      ).status
    ).toBe(403);
  });
});
