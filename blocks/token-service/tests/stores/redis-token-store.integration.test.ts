import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { createTokenService, LocalKeyProvider } from "../../src/index.js";
import { familyIdFromOpaqueToken, hashToken, newOpaqueToken } from "../../src/core/crypto.js";
import { RedisTokenStore, type RedisLike } from "../../src/stores/redis-token-store.js";

const redisUrl = process.env.REDIS_URL;
const redisIntegration = describe.skipIf(!redisUrl);
let client: Redis;
let keyProvider: LocalKeyProvider;
let activePrefix: string | undefined;

function redisAdapter(): RedisLike {
  return {
    get: (key) => client.get(key),
    hget: (key, field) => client.hget(key, field),
    set: (key, value, options) => {
      if (options?.PX !== undefined && options.NX)
        return client.set(key, value, "PX", options.PX, "NX");
      if (options?.PX !== undefined) return client.set(key, value, "PX", options.PX);
      if (options?.NX) return client.set(key, value, "NX");
      return client.set(key, value);
    },
    eval: (script, input) =>
      client.eval(script, input.keys.length, ...input.keys, ...input.arguments)
  };
}

function createService(prefix: string, now?: () => Date, overrides: Record<string, unknown> = {}) {
  const store = new RedisTokenStore(redisAdapter(), {
    prefix,
    subjectRoutingKey: Buffer.alloc(32, 7)
  });
  const service = createTokenService({
    issuer: "https://auth.example.com",
    audience: "api.example.com",
    algorithms: ["RS256"],
    keyProvider,
    tokenStore: store,
    ...overrides,
    ...(now ? { now } : {})
  });
  return { service, store };
}

async function clearPrefix(prefix: string): Promise<void> {
  let cursor = "0";
  do {
    const [next, keys] = await client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
    cursor = next;
    if (keys.length > 0) await client.del(...keys);
  } while (cursor !== "0");
}

redisIntegration("RedisTokenStore integration", () => {
  beforeAll(async () => {
    if (!redisUrl) throw new Error("REDIS_URL is required to run Redis integration tests");
    client = new Redis(redisUrl, { maxRetriesPerRequest: null });
    await client.ping();
    const pair = await generateKeyPair("RS256", { extractable: true });
    keyProvider = new LocalKeyProvider({
      signingKid: "redis-it-2026",
      keys: [
        {
          kid: "redis-it-2026",
          alg: "RS256",
          privateKeyPem: await exportPKCS8(pair.privateKey),
          publicKeyPem: await exportSPKI(pair.publicKey)
        }
      ]
    });
  });

  afterEach(async () => {
    if (activePrefix) await clearPrefix(activePrefix);
    activePrefix = undefined;
  });

  afterAll(async () => {
    if (client) await client.quit();
  });

  function prefixForTest(): string {
    activePrefix = `token-service-it-${randomUUID()}:`;
    return activePrefix;
  }

  it("allows one concurrent refresh and revokes the descendant after reuse", async () => {
    const { service } = createService(prefixForTest());
    const issued = await service.issue({ sub: "redis-concurrent-user" });
    const results = await Promise.allSettled([
      service.refresh(issued.refreshToken!),
      service.refresh(issued.refreshToken!)
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.refresh>>> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    await expect(service.refresh(fulfilled[0]!.value.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("keeps bounded family state for reuse detection and revokes the family atomically", async () => {
    const clock = { value: new Date() };
    const { service } = createService(prefixForTest(), () => clock.value);
    const issued = await service.issue({ sub: "redis-sliding-user" });
    const second = await service.refresh(issued.refreshToken!);
    const familyId = familyIdFromOpaqueToken(issued.refreshToken!)!;
    const [route, id] = familyId.split(".");
    const familyKey = `${activePrefix}family:{${route}}:${id}`;
    const consumed = await client.hget(familyKey, hashToken(issued.refreshToken!));
    expect(JSON.parse(consumed!).status).toBe("used");
    expect(await client.pttl(familyKey)).toBeGreaterThan(80 * 24 * 60 * 60 * 1000);

    await expect(service.refresh(issued.refreshToken!)).rejects.toMatchObject({
      code: "REFRESH_REUSED"
    });
    await expect(service.refresh(second.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("invalidates all refresh families for a subject without scanning token keys", async () => {
    const { service } = createService(prefixForTest());
    const first = await service.issue({ sub: "redis-subject-revocation" });
    const second = await service.issue({ sub: "redis-subject-revocation" });
    await service.revoke({ sub: "redis-subject-revocation" });

    await expect(service.refresh(first.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
    await expect(service.refresh(second.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("revokes a refresh family when any one of its refresh tokens is revoked", async () => {
    const { service } = createService(prefixForTest());
    const first = await service.issue({ sub: "redis-family-revocation" });
    const second = await service.refresh(first.refreshToken!);
    await service.revoke({ refreshToken: first.refreshToken! });

    await expect(service.refresh(second.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("does not let a forged token with a copied routing hint revoke a family", async () => {
    const { service } = createService(prefixForTest());
    const issued = await service.issue({ sub: "redis-forged-revoke" });
    const familyId = familyIdFromOpaqueToken(issued.refreshToken!)!;

    await service.revoke({ refreshToken: newOpaqueToken(familyId) });

    await expect(service.refresh(issued.refreshToken!)).resolves.toMatchObject({
      tokenType: "Bearer"
    });
  });

  it("enforces the configured family rotation limit atomically", async () => {
    const { service } = createService(prefixForTest(), undefined, { maxRefreshRotations: 1 });
    const issued = await service.issue({ sub: "redis-rotation-limit" });
    const rotated = await service.refresh(issued.refreshToken!);

    await expect(service.refresh(rotated.refreshToken!)).rejects.toMatchObject({
      code: "REFRESH_LIMIT"
    });
  });

  it("expires refresh records in Redis and rejects service refresh after token expiry", async () => {
    const prefix = prefixForTest();
    const clock = { value: new Date() };
    const { service: clocked, store } = createService(prefix, () => clock.value);
    const issued = await clocked.issue({
      sub: "redis-expiry-user",
      tokens: { access: false },
      refreshTokenTtlSeconds: 3600
    });
    clock.value = new Date(clock.value.getTime() + 3601 * 1000);
    await expect(clocked.refresh(issued.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_EXPIRED"
    });

    const familyId = store.createFamilyId("redis-expiry-user");
    const shortToken = newOpaqueToken(familyId);
    const shortRecord = {
      tokenHash: hashToken(shortToken),
      familyId,
      sub: "redis-expiry-user",
      status: "active",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 150),
      familyExpiresAt: new Date(Date.now() + 150),
      rotationCount: 0,
      rotationLimit: 10
    } as const;
    await store.saveRefreshToken(shortRecord);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(await store.getRefreshToken(shortRecord.tokenHash, familyId)).toBeUndefined();
    const rotation = await store.rotateRefreshToken({
      currentHash: shortRecord.tokenHash,
      replacement: {
        tokenHash: hashToken(newOpaqueToken(familyId)),
        familyId,
        sub: "redis-expiry-user",
        status: "active",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
        familyExpiresAt: shortRecord.familyExpiresAt,
        rotationCount: 1,
        rotationLimit: 10
      },
      now: new Date(),
      maxRotations: 10
    });
    expect(rotation.status).toBe("missing");
  });
});
