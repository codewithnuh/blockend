import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { RefreshTokenRecord, RotateResult, TokenStore } from "../core/types.js";

export interface RedisLike {
  get(key: string): Promise<string | null>;
  hget(key: string, field: string): Promise<string | null>;
  set(key: string, value: string, options?: { NX?: boolean; PX?: number }): Promise<unknown>;
  eval(script: string, input: { keys: string[]; arguments: string[] }): Promise<unknown>;
}
export interface RedisTokenStoreOptions {
  /** Stable base64url-encoded secret shared by every service instance; at least 32 decoded bytes. */
  subjectRoutingKey: Uint8Array | string;
  /** Shared namespace without Redis hash-tag braces. Defaults to `blockend:v2:`. */
  prefix?: string;
}

const SAVE_SCRIPT = `
if redis.call('HEXISTS', KEYS[2], ARGV[1]) == 1 then return 0 end
local time = redis.call('TIME')
local nowMs = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local record = cjson.decode(ARGV[2])
local familyLifetime = tonumber(record.familyExpiresAtMs) - tonumber(record.createdAtMs)
local refreshLifetime = tonumber(record.expiresAtMs) - tonumber(record.createdAtMs)
if familyLifetime <= 0 or refreshLifetime <= 0 then return -1 end
record.createdAtMs = nowMs
record.familyExpiresAtMs = nowMs + familyLifetime
record.expiresAtMs = math.min(nowMs + refreshLifetime, record.familyExpiresAtMs)
redis.call('SETNX', KEYS[1], ARGV[3])
record.subjectGeneration = redis.call('GET', KEYS[1])
redis.call('HSET', KEYS[2], ARGV[1], cjson.encode(record))
local ttl = record.familyExpiresAtMs - nowMs
redis.call('PEXPIRE', KEYS[2], ttl)
if redis.call('PTTL', KEYS[1]) < ttl then redis.call('PEXPIRE', KEYS[1], ttl) end
return 1
`;
const ROTATE_SCRIPT = `
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw then return {'missing', ''} end
local current = cjson.decode(raw)
local generation = redis.call('GET', KEYS[1])
if redis.call('HGET', KEYS[2], '_revoked') == '1' or not generation or
   current.subjectGeneration ~= generation or current.status == 'revoked' then
  return {'revoked', raw}
end
if current.status == 'used' then
  redis.call('HSET', KEYS[2], '_revoked', '1')
  return {'reused', raw}
end
local time = redis.call('TIME')
local nowMs = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if tonumber(current.expiresAtMs) <= nowMs or
   tonumber(current.familyExpiresAtMs) <= nowMs then return {'expired', raw} end
local rotationLimit = math.min(tonumber(current.rotationLimit), tonumber(ARGV[3]))
if tonumber(current.rotationCount) >= rotationLimit then return {'limit', raw} end
if redis.call('HEXISTS', KEYS[2], ARGV[2]) == 1 then return {'collision', ''} end
local replacement = cjson.decode(ARGV[4])
local refreshLifetime = tonumber(replacement.expiresAtMs) - tonumber(replacement.createdAtMs)
if refreshLifetime <= 0 or replacement.familyId ~= current.familyId or replacement.sub ~= current.sub then
  return {'expired', raw}
end
current.status = 'used'; current.usedAtMs = nowMs
redis.call('HSET', KEYS[2], ARGV[1], cjson.encode(current))
replacement.sub = current.sub
replacement.familyId = current.familyId
replacement.subjectGeneration = generation
replacement.familyExpiresAtMs = tonumber(current.familyExpiresAtMs)
replacement.createdAtMs = nowMs
replacement.expiresAtMs = math.min(nowMs + refreshLifetime, tonumber(current.familyExpiresAtMs))
replacement.rotationCount = tonumber(current.rotationCount) + 1
replacement.rotationLimit = rotationLimit
redis.call('HSET', KEYS[2], ARGV[2], cjson.encode(replacement))
local ttl = math.max(1, tonumber(current.familyExpiresAtMs) - nowMs)
redis.call('PEXPIRE', KEYS[2], ttl)
if redis.call('PTTL', KEYS[1]) < ttl then redis.call('PEXPIRE', KEYS[1], ttl) end
return {'rotated', cjson.encode(replacement)}
`;
const REVOKE_FAMILY_SCRIPT = `
if ARGV[1] and redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 then return 0 end
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('HSET', KEYS[1], '_revoked', '1')
  return 1
end
return 0
`;
const REVOKE_SUBJECT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
local ttl = redis.call('PTTL', KEYS[1])
if ttl > 0 then redis.call('SET', KEYS[1], ARGV[1], 'PX', ttl)
elseif ttl == -1 then redis.call('SET', KEYS[1], ARGV[1], 'KEEPTTL')
else return 0 end
return 1
`;

/** Redis-backed store. Each subject's state is co-located in one cluster slot. */
export class RedisTokenStore implements TokenStore {
  private readonly prefix: string;
  private readonly subjectRoutingKey: Uint8Array;

  constructor(
    private readonly redis: RedisLike,
    options: RedisTokenStoreOptions
  ) {
    this.prefix = options.prefix ?? "blockend:v2:";
    this.subjectRoutingKey =
      typeof options.subjectRoutingKey === "string"
        ? Buffer.from(options.subjectRoutingKey, "base64url")
        : Uint8Array.from(options.subjectRoutingKey);
    if (this.subjectRoutingKey.byteLength < 32)
      throw new Error("Redis subjectRoutingKey must contain at least 32 bytes");
    if (!/^[A-Za-z0-9:_-]{1,128}$/.test(this.prefix))
      throw new Error("Redis prefix must be 1-128 safe characters and must not contain braces");
  }

  createFamilyId(sub: string): string {
    return `${this.subjectRoute(sub)}.${randomUUID()}`;
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    const route = this.routeFromFamilyId(record.familyId);
    if (route !== this.subjectRoute(record.sub))
      throw new Error("Refresh family routing does not match its subject");
    const saved = await this.redis.eval(SAVE_SCRIPT, {
      keys: [this.subjectKey(route), this.familyKey(record.familyId, route)],
      arguments: [record.tokenHash, this.serialize(record), randomBytes(32).toString("base64url")]
    });
    if (Number(saved) !== 1) throw new Error("Duplicate refresh token hash");
  }

  async getRefreshToken(
    tokenHash: string,
    familyId?: string
  ): Promise<RefreshTokenRecord | undefined> {
    if (!familyId) return undefined;
    const route = this.routeFromFamilyId(familyId);
    const raw = await this.redis.hget(this.familyKey(familyId, route), tokenHash);
    if (!raw) return undefined;
    const record = this.deserialize(raw);
    if (record.tokenHash !== tokenHash || record.familyId !== familyId) return undefined;
    const familyKey = this.familyKey(familyId, route);
    const [familyRevoked, generation] = await Promise.all([
      this.redis.hget(familyKey, "_revoked"),
      this.redis.get(this.subjectKey(route))
    ]);
    if (familyRevoked === "1" || generation !== record.subjectGeneration)
      return { ...record, status: "revoked" };
    return record;
  }

  async rotateRefreshToken(input: {
    currentHash: string;
    replacement: RefreshTokenRecord;
    now: Date;
    maxRotations: number;
  }): Promise<RotateResult> {
    const route = this.routeFromFamilyId(input.replacement.familyId);
    if (route !== this.subjectRoute(input.replacement.sub))
      throw new Error("Refresh family routing does not match its subject");
    const raw = await this.redis.eval(ROTATE_SCRIPT, {
      keys: [this.subjectKey(route), this.familyKey(input.replacement.familyId, route)],
      arguments: [
        input.currentHash,
        input.replacement.tokenHash,
        String(input.maxRotations),
        this.serialize(input.replacement)
      ]
    });
    if (!Array.isArray(raw) || typeof raw[0] !== "string")
      throw new Error("Unexpected Redis rotate response");
    const status = raw[0] as RotateResult["status"] | "collision";
    if (status === "missing") return { status };
    if (status === "collision") throw new Error("Duplicate replacement refresh token hash");
    const record = this.deserialize(String(raw[1]));
    return { status, record } as RotateResult;
  }

  async revokeByHash(hash: string, familyId?: string): Promise<void> {
    if (!familyId) return;
    const route = this.routeFromFamilyId(familyId);
    await this.redis.eval(REVOKE_FAMILY_SCRIPT, {
      keys: [this.familyKey(familyId, route)],
      arguments: [hash]
    });
  }

  async revokeByFamily(id: string): Promise<void> {
    const route = this.routeFromFamilyId(id);
    await this.redis.eval(REVOKE_FAMILY_SCRIPT, {
      keys: [this.familyKey(id, route)],
      arguments: []
    });
  }

  async revokeBySub(sub: string): Promise<void> {
    const route = this.subjectRoute(sub);
    await this.redis.eval(REVOKE_SUBJECT_SCRIPT, {
      keys: [this.subjectKey(route)],
      arguments: [randomBytes(32).toString("base64url")]
    });
  }

  async revokeByJti(jti: string, expiresAt?: Date): Promise<void> {
    await this.redis.set(this.jtiKey(jti), "1", {
      PX: Math.max(1, (expiresAt?.getTime() ?? Date.now() + 3_600_000) - Date.now())
    });
  }

  async isJtiRevoked(jti: string): Promise<boolean> {
    return (await this.redis.get(this.jtiKey(jti))) !== null;
  }

  private subjectRoute(sub: string): string {
    return createHmac("sha256", this.subjectRoutingKey).update(sub, "utf8").digest("base64url");
  }

  private routeFromFamilyId(id: string): string {
    const match =
      /^([A-Za-z0-9_-]{43})\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
        id
      );
    if (!match) throw new Error("Invalid refresh family identifier");
    return match[1]!;
  }

  private subjectKey(route: string): string {
    return `${this.prefix}subject:{${route}}:state`;
  }

  private familyKey(id: string, route: string): string {
    return `${this.prefix}family:{${route}}:${id.slice(route.length + 1)}`;
  }

  private jtiKey(jti: string): string {
    const digest = createHash("sha256").update(jti, "utf8").digest("base64url");
    return `${this.prefix}jti:${digest}`;
  }

  private serialize(record: RefreshTokenRecord): string {
    return JSON.stringify({
      ...record,
      createdAtMs: record.createdAt.getTime(),
      expiresAtMs: record.expiresAt.getTime(),
      familyExpiresAtMs: record.familyExpiresAt.getTime(),
      usedAtMs: record.usedAt?.getTime(),
      createdAt: undefined,
      expiresAt: undefined,
      familyExpiresAt: undefined,
      usedAt: undefined
    });
  }

  private deserialize(raw: string): RefreshTokenRecord {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const record: RefreshTokenRecord = {
      tokenHash: String(value.tokenHash),
      familyId: String(value.familyId),
      sub: String(value.sub),
      status: value.status as RefreshTokenRecord["status"],
      createdAt: new Date(Number(value.createdAtMs)),
      expiresAt: new Date(Number(value.expiresAtMs)),
      familyExpiresAt: new Date(Number(value.familyExpiresAtMs)),
      rotationCount: Number(value.rotationCount),
      rotationLimit: Number(value.rotationLimit),
      ...(typeof value.subjectGeneration === "string"
        ? { subjectGeneration: value.subjectGeneration }
        : {}),
      ...(value.usedAtMs ? { usedAt: new Date(Number(value.usedAtMs)) } : {}),
      ...(value.metadata && typeof value.metadata === "object"
        ? { metadata: value.metadata as Record<string, unknown> }
        : {})
    };
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(record.tokenHash) ||
      !Number.isFinite(record.createdAt.getTime()) ||
      !Number.isFinite(record.expiresAt.getTime()) ||
      !Number.isFinite(record.familyExpiresAt.getTime()) ||
      !Number.isSafeInteger(record.rotationCount) ||
      !Number.isSafeInteger(record.rotationLimit) ||
      typeof record.subjectGeneration !== "string" ||
      !["active", "used", "revoked"].includes(record.status)
    )
      throw new Error("Invalid refresh record in Redis");
    return record;
  }
}
