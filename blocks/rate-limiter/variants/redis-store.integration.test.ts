import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Redis } from "ioredis";
import { config } from "dotenv";
import { RedisStore } from "./redis-store";

config();

const REDIS_URL = process.env.REDIS_URL;

const describeRedis = REDIS_URL === undefined ? describe.skip : describe;

function createClient(): Redis {
  if (REDIS_URL === undefined) {
    throw new Error("REDIS_URL is required to create a Redis integration-test client");
  }

  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null
  });
}

describeRedis("RedisStore integration", () => {
  let client: Redis;
  let store: RedisStore;

  beforeAll(() => {
    client = createClient();
    store = new RedisStore(client, "integ-test:");
  });

  afterAll(async () => {
    const keys = await client.keys("integ-test:*");

    if (keys.length > 0) {
      await client.del(...keys);
    }

    await client.quit();
  });

  afterEach(async () => {
    const keys = await client.keys("integ-test:*");

    if (keys.length > 0) {
      await client.del(...keys);
    }
  });

  it("returns hits = 1 for a brand-new key", async () => {
    const record = await store.increment("new-key", 60_000);

    expect(record.hits).toBe(1);
  });

  it("increments hits on repeated calls for the same key", async () => {
    const r1 = await store.increment("counter-key", 60_000);
    const r2 = await store.increment("counter-key", 60_000);
    const r3 = await store.increment("counter-key", 60_000);

    expect(r1.hits).toBe(1);
    expect(r2.hits).toBe(2);
    expect(r3.hits).toBe(3);
  });

  it("maintains independent counters for different keys", async () => {
    const a1 = await store.increment("alpha", 60_000);
    const b1 = await store.increment("beta", 60_000);
    const a2 = await store.increment("alpha", 60_000);

    expect(a1.hits).toBe(1);
    expect(b1.hits).toBe(1);
    expect(a2.hits).toBe(2);
  });

  it("does not restart the TTL on subsequent increments", async () => {
    const windowMs = 5_000;

    const first = await store.increment("ttl-key", windowMs);
    expect(first.hits).toBe(1);

    const second = await store.increment("ttl-key", windowMs);
    expect(second.hits).toBe(2);

    const secondRemaining = second.resetTime - Date.now();

    expect(secondRemaining).toBeLessThan(windowMs);
    expect(secondRemaining).toBeGreaterThan(0);
    expect(second.resetTime).toBeLessThanOrEqual(first.resetTime + 500);
  });

  it("resets to hits = 1 after the key expires", async () => {
    const windowMs = 200;

    const first = await store.increment("expire-key", windowMs);
    expect(first.hits).toBe(1);

    await new Promise<void>((resolve) => {
      setTimeout(resolve, windowMs + 100);
    });

    const second = await store.increment("expire-key", windowMs);

    expect(second.hits).toBe(1);
  });

  it("returns a resetTime within a sensible range", async () => {
    const windowMs = 10_000;
    const before = Date.now();

    const record = await store.increment("reset-range", windowMs);

    const after = Date.now();

    expect(record.resetTime).toBeGreaterThan(before);
    expect(record.resetTime).toBeLessThanOrEqual(after + windowMs + 100);
  });

  it("rejects when Redis is unavailable", async () => {
    const deadClient = createClient();

    deadClient.disconnect();

    const deadStore = new RedisStore(deadClient, "dead:");

    await expect(deadStore.increment("any", 60_000)).rejects.toThrow();
  });

  it("handles 30 concurrent increments atomically across separate store instances", async () => {
    const concurrent = 30;
    const windowMs = 60_000;
    const key = "concurrent-key";

    const clientA = createClient();
    const clientB = createClient();

    const storeA = new RedisStore(clientA, "integ-test:");
    const storeB = new RedisStore(clientB, "integ-test:");

    // Tuple instead of RedisStore[] means indexed values are known
    // to exist even with noUncheckedIndexedAccess enabled.
    const stores: readonly [RedisStore, RedisStore] = [storeA, storeB];

    try {
      const promises = Array.from({ length: concurrent }, (_, index) => {
        // Avoid `stores[index % 2]` becoming RedisStore | undefined.
        const currentStore = index % 2 === 0 ? stores[0] : stores[1];

        return currentStore.increment(key, windowMs);
      });

      const results = await Promise.all(promises);

      const hits = results.map(({ hits }) => hits).sort((a, b) => a - b);

      expect(hits).toEqual(Array.from({ length: concurrent }, (_, index) => index + 1));

      const finalCount = await clientA.get("integ-test:concurrent-key");

      // get() legitimately returns null, so narrow it before parsing.
      expect(finalCount).not.toBeNull();

      if (finalCount === null) {
        throw new Error("Expected concurrent Redis key to exist");
      }

      expect(Number(finalCount)).toBe(concurrent);
    } finally {
      await Promise.all([clientA.quit(), clientB.quit()]);
    }
  });

  it("applies the configured key prefix to Redis keys", async () => {
    const prefixedStore = new RedisStore(client, "myprefix:");

    await prefixedStore.increment("prefixed", 60_000);

    const rawValue = await client.get("myprefix:prefixed");

    expect(rawValue).not.toBeNull();

    if (rawValue === null) {
      throw new Error("Expected prefixed Redis key to exist");
    }

    expect(Number(rawValue)).toBe(1);

    const unprefixed = await client.get("prefixed");

    expect(unprefixed).toBeNull();
  });
});
