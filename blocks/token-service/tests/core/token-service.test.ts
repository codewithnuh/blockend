import { beforeAll, describe, expect, it, vi } from "vitest";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import {
  createTokenService,
  LocalKeyProvider,
  MemoryTokenStore,
  TokenError
} from "../../src/index.js";
import { hashToken } from "../../src/core/crypto.js";

let provider: LocalKeyProvider;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  provider = new LocalKeyProvider({
    signingKid: "2026-01",
    keys: [
      {
        kid: "2026-01",
        alg: "RS256",
        privateKeyPem: await exportPKCS8(pair.privateKey),
        publicKeyPem: await exportSPKI(pair.publicKey)
      }
    ]
  });
});

function setup(overrides: Record<string, unknown> = {}) {
  const store = new MemoryTokenStore();
  const service = createTokenService({
    issuer: "https://auth.example.com",
    audience: "api.example.com",
    algorithms: ["RS256"],
    keyProvider: provider,
    tokenStore: store,
    ...overrides
  });
  return { service, store };
}

describe("TokenService", () => {
  it("issues and verifies a pinned access token", async () => {
    const { service } = setup();
    const pair = await service.issue({ sub: "user-1", claims: { role: "admin" } });
    expect(pair.accessToken).toBeTypeOf("string");
    expect(pair.refreshToken).toBeTypeOf("string");
    const result = await service.verify(pair.accessToken!);
    expect(result.claims).toMatchObject({
      sub: "user-1",
      iss: "https://auth.example.com",
      aud: "api.example.com",
      role: "admin",
      type: "access"
    });
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const { service } = setup({
      resolveRefreshContext: async () => ({ claims: { role: "member" } })
    });
    const first = await service.issue({ sub: "user-1" });
    const second = await service.refresh(first.refreshToken!);
    expect((await service.verify(second.accessToken!)).claims.role).toBe("member");
    await expect(service.refresh(first.refreshToken!)).rejects.toMatchObject({
      code: "REFRESH_REUSED"
    });
    await expect(service.refresh(second.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("leaves the current refresh token active when signing fails before rotation", async () => {
    const store = new MemoryTokenStore();
    const issuer = createTokenService({
      issuer: "https://auth.example.com",
      audience: "api.example.com",
      algorithms: ["RS256"],
      keyProvider: provider,
      tokenStore: store
    });
    const issued = await issuer.issue({ sub: "user-1", tokens: { access: false } });
    const unavailableSigner = {
      getSigningKey: async () => {
        throw new Error("KMS unavailable");
      },
      getVerificationKey: provider.getVerificationKey.bind(provider)
    };
    const service = createTokenService({
      issuer: "https://auth.example.com",
      audience: "api.example.com",
      algorithms: ["RS256"],
      keyProvider: unavailableSigner,
      tokenStore: store
    });

    await expect(service.refresh(issued.refreshToken!)).rejects.toMatchObject({
      code: "KEY_UNAVAILABLE"
    });
    const record = await store.getRefreshToken(hashToken(issued.refreshToken!));
    expect(record?.status).toBe("active");
  });

  it("allows only one concurrent refresh", async () => {
    const { service } = setup();
    const issued = await service.issue({ sub: "user-1" });
    const settled = await Promise.allSettled([
      service.refresh(issued.refreshToken!),
      service.refresh(issued.refreshToken!)
    ]);
    expect(settled.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((item) => item.status === "rejected")).toHaveLength(1);
  });

  it("rejects reserved, forbidden, and oversized claims", async () => {
    const { service } = setup({ maxClaimsBytes: 256 });
    await expect(service.issue({ sub: "x", claims: { exp: 123 } })).rejects.toMatchObject({
      code: "FORBIDDEN_CLAIM"
    });
    await expect(service.issue({ sub: "x", claims: { password: "no" } })).rejects.toMatchObject({
      code: "FORBIDDEN_CLAIM"
    });
    await expect(
      service.issue({ sub: "x", claims: { profile: { secret: "no" } } })
    ).rejects.toMatchObject({ code: "FORBIDDEN_CLAIM" });
    await expect(
      service.issue({ sub: "x", claims: { data: "x".repeat(300) } })
    ).rejects.toMatchObject({ code: "CLAIMS_TOO_LARGE" });
  });

  it("allows only configured audiences", async () => {
    const { service } = setup({ audience: ["api", "admin"] });
    await expect(service.issue({ sub: "x", audience: "unknown" })).rejects.toMatchObject({
      code: "INVALID_INPUT"
    });
    const pair = await service.issue({ sub: "x", audience: "admin" });
    expect((await service.verify(pair.accessToken!)).claims.aud).toBe("admin");
  });

  it("rejects refresh contexts with an audience outside the configured allowlist", async () => {
    const { service, store } = setup({
      audience: ["api", "admin"],
      resolveRefreshContext: async () => ({ audience: "untrusted-service" })
    });
    const issued = await service.issue({ sub: "x", tokens: { access: false } });

    await expect(service.refresh(issued.refreshToken!)).rejects.toMatchObject({
      code: "INVALID_INPUT"
    });
    const record = await store.getRefreshToken(hashToken(issued.refreshToken!));
    expect(record?.status).toBe("active");
  });

  it("clamps TTLs and supports access-only issue", async () => {
    const { service } = setup();
    const pair = await service.issue({
      sub: "x",
      tokens: { refresh: false },
      accessTokenTtlSeconds: 999_999
    });
    expect(pair.expiresIn).toBe(3600);
    expect(pair.refreshToken).toBeUndefined();
  });

  it("revokes an access-token jti", async () => {
    const { service } = setup();
    const pair = await service.issue({ sub: "x" });
    const verified = await service.verify(pair.accessToken!);
    await service.revoke({ jti: verified.claims.jti });
    await expect(service.verify(pair.accessToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("retains a revoked JTI through the maximum token lifetime and clock tolerance", async () => {
    const now = new Date();
    const { service, store } = setup({ now: () => now, clockSkewSeconds: 75 });
    const revokeSpy = vi.spyOn(store, "revokeByJti");
    const pair = await service.issue({ sub: "x", accessTokenTtlSeconds: 3600 });
    const verified = await service.verify(pair.accessToken!);

    await service.revoke({ jti: verified.claims.jti });

    const expectedExpiry = new Date(now.getTime() + (3600 + 75) * 1000);
    expect(revokeSpy).toHaveBeenCalledWith(verified.claims.jti, expectedExpiry);
    expect(await store.isJtiRevoked(verified.claims.jti)).toBe(true);
  });

  it("requires production issuer and audience", () => {
    expect(() =>
      createTokenService({
        issuer: "http://localhost:3000",
        keyProvider: provider,
        tokenStore: new MemoryTokenStore()
      })
    ).toThrow(TokenError);
    expect(() =>
      createTokenService({
        deploymentMode: "development",
        issuer: "http://localhost:3000",
        keyProvider: provider,
        tokenStore: new MemoryTokenStore()
      })
    ).not.toThrow();
  });

  it("supports individual token selection and minimum TTL clamping", async () => {
    const { service } = setup();
    const refreshOnly = await service.issue({
      sub: "x",
      tokens: { access: false },
      refreshTokenTtlSeconds: 1
    });
    expect(refreshOnly.accessToken).toBeUndefined();
    expect(refreshOnly.refreshExpiresIn).toBe(3600);
    await expect(
      service.issue({ sub: "x", tokens: { access: false, refresh: false } })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects malformed input and non-serializable claims", async () => {
    const { service } = setup();
    await expect(service.issue({ sub: "" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.issue({ sub: "x", claims: { amount: 1n } })).rejects.toMatchObject({
      code: "INVALID_INPUT"
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(service.issue({ sub: "x", claims: circular })).rejects.toMatchObject({
      code: "INVALID_INPUT"
    });
    await expect(service.revoke({} as never)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects malformed, expired, and wrong-audience access tokens", async () => {
    const clock = { value: new Date("2026-01-01T00:00:00Z") };
    const { service } = setup({ now: () => clock.value, clockSkewSeconds: 0 });
    const pair = await service.issue({ sub: "x", accessTokenTtlSeconds: 60 });
    await expect(service.verify("bad")).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    clock.value = new Date("2026-01-01T00:02:00Z");
    await expect(service.verify(pair.accessToken!)).rejects.toMatchObject({
      code: "TOKEN_EXPIRED"
    });
    const other = setup({
      audience: "other.example.com",
      now: () => new Date("2026-01-01T00:00:10Z")
    }).service;
    await expect(other.verify(pair.accessToken!)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("handles unknown, expired, explicitly revoked, and subject-revoked refresh tokens", async () => {
    const clock = { value: new Date("2026-01-01T00:00:00Z") };
    const { service } = setup({ now: () => clock.value });
    await expect(service.refresh("x".repeat(43))).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    const expired = await service.issue({
      sub: "old",
      tokens: { access: false },
      refreshTokenTtlSeconds: 3600
    });
    clock.value = new Date("2026-01-01T02:00:00Z");
    await expect(service.refresh(expired.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_EXPIRED"
    });
    clock.value = new Date("2026-01-01T00:00:00Z");
    const direct = await service.issue({ sub: "direct", tokens: { access: false } });
    await service.revoke({ refreshToken: direct.refreshToken! });
    await expect(service.refresh(direct.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
    const bySub = await service.issue({ sub: "subject", tokens: { access: false } });
    await service.revoke({ sub: "subject" });
    await expect(service.refresh(bySub.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("revokes a token family and ignores telemetry failures", async () => {
    const events: string[] = [];
    const { service, store } = setup({
      onEvent: (event: { name: string }) => {
        events.push(event.name);
        throw new Error("collector down");
      }
    });
    const pair = await service.issue({ sub: "x" });
    const hash = (await import("../../src/core/crypto.js")).hashToken(pair.refreshToken!);
    const found = (store as unknown as { refresh: Map<string, { familyId: string }> }).refresh.get(
      hash
    )!;
    await service.revoke({ familyId: found.familyId });
    await expect(service.refresh(pair.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
    expect(events).toContain("token.issued");
  });

  it("maps store failures and unsupported jti revocation to stable errors", async () => {
    const brokenStore = {
      saveRefreshToken: async () => {
        throw new Error("db down");
      },
      getRefreshToken: async () => {
        throw new Error("db down");
      },
      rotateRefreshToken: async () => {
        throw new Error("db down");
      },
      revokeByHash: async () => {},
      revokeByFamily: async () => {},
      revokeBySub: async () => {}
    };
    const service = createTokenService({
      issuer: "https://auth.example.com",
      audience: "api",
      algorithms: ["RS256"],
      keyProvider: provider,
      tokenStore: brokenStore
    });
    await expect(service.issue({ sub: "x", tokens: { access: false } })).rejects.toMatchObject({
      code: "STORE_UNAVAILABLE"
    });
    await expect(service.revoke({ jti: "id" })).rejects.toMatchObject({
      code: "UNSUPPORTED_OPERATION"
    });
  });

  it("rejects insecure production configuration", () => {
    const base = {
      issuer: "https://auth.example.com",
      audience: "api",
      keyProvider: provider,
      tokenStore: new MemoryTokenStore()
    };
    expect(() => createTokenService({ ...base, algorithms: ["HS256"] })).toThrow(TokenError);
    expect(() => createTokenService({ ...base, issuer: "http://auth.example.com" })).toThrow(
      TokenError
    );
    const { audience: _audience, ...withoutAudience } = base;
    expect(() => createTokenService(withoutAudience)).toThrow(TokenError);
  });
});
