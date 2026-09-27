import { describe, expect, it, vi } from "vitest";
import { RedisTokenStore, type RedisLike } from "../../src/stores/redis-token-store.js";

describe("RedisTokenStore", () => {
  it("keeps family and subject indexes alive through the latest token expiry", async () => {
    const evalScript = vi.fn<RedisLike["eval"]>(async () => 1);
    const redis: RedisLike = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => "OK"),
      eval: evalScript
    };
    const store = new RedisTokenStore(redis);

    await store.saveRefreshToken({
      tokenHash: "hash",
      familyId: "family",
      sub: "user",
      status: "active",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date(Date.now() + 86_400_000)
    });

    const script = String(evalScript.mock.calls[0]?.[0]);
    expect(script).toContain("PTTL");
    expect(script).toContain("familyTtl < tonumber(ARGV[1])");
    expect(script).toContain("subTtl < tonumber(ARGV[1])");
    expect(evalScript.mock.calls[0]?.[1].keys.every((key) => key.includes("{blockend}"))).toBe(
      true
    );
  });

  it("uses one atomic script for rotation and extends indexes without shortening them", async () => {
    const evalScript = vi.fn<RedisLike["eval"]>(async () => ["missing", ""]);
    const redis: RedisLike = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => "OK"),
      eval: evalScript
    };
    const store = new RedisTokenStore(redis);

    await store.rotateRefreshToken({
      currentHash: "current",
      replacement: {
        tokenHash: "replacement",
        familyId: "placeholder",
        sub: "placeholder",
        status: "active",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000)
      },
      now: new Date()
    });

    const script = String(evalScript.mock.calls[0]?.[0]);
    expect(script).toContain("current.status = 'used'");
    expect(script).toContain("familyTtl < ttl");
    expect(script).toContain("subTtl < ttl");
  });
});
