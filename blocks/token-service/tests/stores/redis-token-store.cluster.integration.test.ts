import { randomUUID } from "node:crypto";
import { Cluster } from "ioredis";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { createTokenService, LocalKeyProvider } from "../../src/index.js";
import { RedisTokenStore, type RedisLike } from "../../src/stores/redis-token-store.js";

const clusterNodes = process.env.REDIS_CLUSTER_NODES;
const clusterIntegration = describe.skipIf(!clusterNodes);
let cluster: Cluster;
let keyProvider: LocalKeyProvider;
let activePrefix: string | undefined;

function clusterAdapter(): RedisLike {
  return {
    get: (key) => cluster.get(key),
    hget: (key, field) => cluster.hget(key, field),
    set: (key, value, options) => {
      if (options?.PX !== undefined && options.NX)
        return cluster.set(key, value, "PX", options.PX, "NX");
      if (options?.PX !== undefined) return cluster.set(key, value, "PX", options.PX);
      if (options?.NX) return cluster.set(key, value, "NX");
      return cluster.set(key, value);
    },
    eval: (script, input) =>
      cluster.eval(script, input.keys.length, ...input.keys, ...input.arguments)
  };
}

function createService(prefix: string) {
  const tokenStore = new RedisTokenStore(clusterAdapter(), {
    prefix,
    subjectRoutingKey: Buffer.alloc(32, 13)
  });
  return createTokenService({
    issuer: "https://auth.example.com",
    audience: "api.example.com",
    algorithms: ["RS256"],
    keyProvider,
    tokenStore
  });
}

async function clearPrefix(prefix: string): Promise<void> {
  for (const master of cluster.nodes("master")) {
    let cursor = "0";
    do {
      const [next, keys] = await master.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = next;
      if (keys.length) await master.del(...keys);
    } while (cursor !== "0");
  }
}

clusterIntegration("RedisTokenStore Redis Cluster integration", () => {
  beforeAll(async () => {
    const nodes = clusterNodes!.split(",").map((address) => {
      const [host, port] = address.trim().split(":");
      if (!host || !port || !/^\d+$/.test(port)) throw new Error("Invalid REDIS_CLUSTER_NODES");
      return { host, port: Number(port) };
    });
    cluster = new Cluster(nodes, {
      scaleReads: "master",
      redisOptions: { maxRetriesPerRequest: null }
    });
    await cluster.ping();
    const pair = await generateKeyPair("RS256", { extractable: true });
    keyProvider = new LocalKeyProvider({
      signingKid: "redis-cluster-it",
      keys: [
        {
          kid: "redis-cluster-it",
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
    if (cluster) await cluster.quit();
  });

  it("rotates, detects replay, and revokes the family in one cluster slot", async () => {
    activePrefix = `token-service-cluster-it-${randomUUID()}:`;
    const service = createService(activePrefix);
    const first = await service.issue({ sub: "cluster-user" });
    const rotated = await service.refresh(first.refreshToken!);

    await expect(service.refresh(first.refreshToken!)).rejects.toMatchObject({
      code: "REFRESH_REUSED"
    });
    await expect(service.refresh(rotated.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });

  it("revokes subject families without cross-slot key access", async () => {
    activePrefix = `token-service-cluster-it-${randomUUID()}:`;
    const service = createService(activePrefix);
    const first = await service.issue({ sub: "cluster-subject-revoke" });
    const second = await service.issue({ sub: "cluster-subject-revoke" });

    await service.revoke({ sub: "cluster-subject-revoke" });

    await expect(service.refresh(first.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
    await expect(service.refresh(second.refreshToken!)).rejects.toMatchObject({
      code: "TOKEN_REVOKED"
    });
  });
});
