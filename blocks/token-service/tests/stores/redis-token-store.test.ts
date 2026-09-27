import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RedisTokenStore, type RedisLike } from "../../src/stores/redis-token-store.js";
import { hashToken, newOpaqueToken } from "../../src/core/crypto.js";

function setup(response: unknown = 1) {
  const evalScript = vi.fn<RedisLike["eval"]>(async () => response);
  const redis: RedisLike = {
    get: vi.fn(async () => null),
    hget: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    eval: evalScript
  };
  const store = new RedisTokenStore(redis, { subjectRoutingKey: Buffer.alloc(32, 9) });
  return { evalScript, redis, store };
}

describe("RedisTokenStore", () => {
  it("routes one subject to one cluster slot without exposing the subject", async () => {
    const { evalScript, store } = setup();
    const sub = `private-${randomUUID()}@example.com`;
    const familyId = store.createFamilyId(sub);
    const token = newOpaqueToken(familyId);
    const familyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await store.saveRefreshToken({
      tokenHash: hashToken(token),
      familyId,
      sub,
      status: "active",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      familyExpiresAt,
      rotationCount: 0,
      rotationLimit: 1000
    });

    const call = evalScript.mock.calls[0]!;
    expect(call[1].keys).toHaveLength(2);
    expect(call[1].keys[0]).toContain(`{${familyId.split(".")[0]}}`);
    expect(call[1].keys[1]).toContain(`{${familyId.split(".")[0]}}`);
    expect(call[1].keys.join(" ")).not.toContain(sub);
    expect(call[0]).not.toContain("SMEMBERS");
    expect(call[0]).toContain("HSET");
  });

  it("keeps rotation O(1) and declares every key touched by Lua", async () => {
    const { evalScript, store } = setup(["missing", ""]);
    const sub = "rotation-user";
    const familyId = store.createFamilyId(sub);
    await store.rotateRefreshToken({
      currentHash: hashToken(newOpaqueToken(familyId)),
      replacement: {
        tokenHash: hashToken(newOpaqueToken(familyId)),
        familyId,
        sub,
        status: "active",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        familyExpiresAt: new Date(Date.now() + 86_400_000),
        rotationCount: 1,
        rotationLimit: 1000
      },
      now: new Date(),
      maxRotations: 1000
    });

    const [script, input] = evalScript.mock.calls[0]!;
    expect(input.keys).toHaveLength(2);
    expect(script).toContain("HGET");
    expect(script).toContain("_revoked");
    expect(script).not.toContain("SMEMBERS");
    expect(script).not.toContain("family:' ..");
    expect(script).toContain("current.rotationCount");
  });

  it("rejects weak routing secrets and unsafe prefixes", () => {
    const redis: RedisLike = {
      get: vi.fn(async () => null),
      hget: vi.fn(async () => null),
      set: vi.fn(async () => "OK"),
      eval: vi.fn(async () => 1)
    };
    expect(() => new RedisTokenStore(redis, { subjectRoutingKey: Buffer.alloc(16) })).toThrow(
      "at least 32 bytes"
    );
    expect(
      () =>
        new RedisTokenStore(redis, {
          subjectRoutingKey: Buffer.alloc(32),
          prefix: "token:{global}:"
        })
    ).toThrow("must not contain braces");
  });
});
