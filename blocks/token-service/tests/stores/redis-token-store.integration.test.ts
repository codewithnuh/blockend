import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { createTokenService, LocalKeyProvider } from "../../src/index.js";
import { hashToken } from "../../src/core/crypto.js";
import { RedisTokenStore, type RedisLike } from "../../src/stores/redis-token-store.js";

const redisUrl = process.env.REDIS_URL;
const redisIntegration = describe.skipIf(!redisUrl);
let client: Redis;
let keyProvider: LocalKeyProvider;
let activePrefix: string | undefined;

function redisAdapter(): RedisLike {
  return {
    get: (key) => client.get(key),
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

function createService(prefix: string, now?: () => Date) {
  const store = new RedisTokenStore(redisAdapter(), prefix);
  const service = createTokenService({
    issuer: "https://auth.example.com",
    audience: "api.example.com",
    algorithms: ["RS256"],
    keyProvider,
    tokenStore: store,
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
    activePrefix = `token:{token-service-it-${randomUUID()}}:`;
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

  it("keeps consumed-token reuse detection through a sliding refresh-family expiry", async () => {
    const clock = { value: new Date() };
    const { service } = createService(prefixForTest(), () => clock.value);
    const issued = await service.issue({ sub: "redis-sliding-user" });

    clock.value = new Date(clock.value.getTime() + 6 * 24 * 60 * 60 * 1000);
    const second = await service.refresh(issued.refreshToken!);
    const consumedKey = `${activePrefix}refresh:${hashToken(issued.refreshToken!)}`;
    await client.pexpire(consumedKey, 50);
    clock.value = new Date(clock.value.getTime() + 2 * 24 * 60 * 60 * 1000);
    const third = await service.refresh(second.refreshToken!);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await expect(service.refresh(issued.refreshToken!)).rejects.toMatchObject({
      code: "REFRESH_REUSED"
    });
    await expect(service.refresh(third.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
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

    await store.saveRefreshToken({
      tokenHash: "short-lived-hash",
      familyId: "short-lived-family",
      sub: "redis-expiry-user",
      status: "active",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 150)
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(await store.getRefreshToken("short-lived-hash")).toBeUndefined();
    const rotation = await store.rotateRefreshToken({
      currentHash: "short-lived-hash",
      replacement: {
        tokenHash: "unused-replacement",
        familyId: "short-lived-family",
        sub: "redis-expiry-user",
        status: "active",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000)
      },
      now: new Date()
    });
    expect(rotation.status).toBe("missing");
  });
});
