import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { TokenError } from "../../src/core/errors.js";
import type { TokenService } from "../../src/core/types.js";
import { createExpressTokenRouter } from "../../src/adapters/express.js";

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

describe("Express token adapter", () => {
  it("maps refresh results and token errors to HTTP responses", async () => {
    const app = express();
    app.use(express.json());
    app.use(createExpressTokenRouter(service));

    await request(app).post("/refresh").send({ refreshToken: "ok" }).expect(200);
    await request(app).post("/refresh").send({ refreshToken: "bad" }).expect(401);
  });

  it("does not expose issue without an authorization callback", async () => {
    const app = express();
    app.use(express.json());
    app.use(createExpressTokenRouter(service, { exposeIssue: true }));

    await request(app).post("/issue").send({ sub: "u" }).expect(403);
  });

  it("returns client errors for null bodies and sanitizes authorization failures", async () => {
    const app = express();
    app.use(express.json({ strict: false }));
    app.use(
      createExpressTokenRouter(service, {
        exposeIssue: true,
        exposeVerify: true,
        authorize: async () => {
          throw new Error("private authorization detail");
        }
      })
    );

    const refresh = await request(app)
      .post("/refresh")
      .set("content-type", "application/json")
      .send("null");
    expect(refresh.status).toBe(400);
    expect(refresh.body.error.code).toBe("INVALID_INPUT");
    const verify = await request(app)
      .post("/verify")
      .set("content-type", "application/json")
      .send("null");
    expect(verify.status).toBe(400);
    expect(verify.body.error.code).toBe("INVALID_INPUT");

    const issue = await request(app).post("/issue").send({ sub: "u" });
    expect(issue.status).toBe(500);
    expect(issue.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Token operation failed" }
    });
  });
});
