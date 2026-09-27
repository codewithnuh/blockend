import type { RefreshTokenRecord, RotateResult, TokenStore } from "../core/types.js";

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { NX?: boolean; PX?: number }): Promise<unknown>;
  eval(script: string, input: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

const ROTATE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'missing', ''} end
local current = cjson.decode(raw)
if current.status == 'used' then
  local familyKey = ARGV[3] .. 'family:' .. current.familyId
  local members = redis.call('SMEMBERS', familyKey)
  for _,k in ipairs(members) do local r=redis.call('GET',k); if r then local v=cjson.decode(r); v.status='revoked'; redis.call('SET',k,cjson.encode(v),'KEEPTTL') end end
  return {'reused', raw}
end
if current.status == 'revoked' then return {'revoked', raw} end
if tonumber(current.expiresAtMs) <= tonumber(ARGV[1]) then return {'expired', raw} end
current.status = 'used'; current.usedAtMs = tonumber(ARGV[1])
local replacement = cjson.decode(ARGV[2]); replacement.sub = current.sub; replacement.familyId = current.familyId
local ttl = math.max(1, tonumber(replacement.expiresAtMs) - tonumber(ARGV[1]))
local familyKey = ARGV[3] .. 'family:' .. current.familyId
local subKey = ARGV[3] .. 'sub:' .. current.sub
redis.call('SET', KEYS[1], cjson.encode(current), 'PX', math.max(ttl, tonumber(current.expiresAtMs) - tonumber(ARGV[1])))
redis.call('SET', KEYS[2], cjson.encode(replacement), 'PX', ttl, 'NX')
-- A family can slide forward through later rotations. Keep every consumed
-- token's reuse marker alive through the newest descendant's expiry.
local members = redis.call('SMEMBERS', familyKey)
for _,k in ipairs(members) do
  if k ~= KEYS[1] then
    local raw = redis.call('GET', k)
    if raw then
      local value = cjson.decode(raw)
      if value.status == 'used' and redis.call('PTTL', k) < ttl then redis.call('PEXPIRE', k, ttl) end
    end
  end
end
redis.call('SADD', familyKey, KEYS[2])
local familyTtl = redis.call('PTTL', familyKey)
if familyTtl < ttl then redis.call('PEXPIRE', familyKey, ttl) end
redis.call('SADD', subKey, KEYS[2])
local subTtl = redis.call('PTTL', subKey)
if subTtl < ttl then redis.call('PEXPIRE', subKey, ttl) end
return {'rotated', cjson.encode(replacement)}
`;
const REVOKE_SET_SCRIPT = `local members=redis.call('SMEMBERS',KEYS[1]); for _,k in ipairs(members) do local r=redis.call('GET',k); if r then local v=cjson.decode(r); v.status='revoked'; redis.call('SET',k,cjson.encode(v),'KEEPTTL') end end; return #members`;

/** Shared Redis store. Atomic Lua rotation prevents concurrent refresh success across instances. */
export class RedisTokenStore implements TokenStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = "token:{blockend}:"
  ) {
    if (!/\{[^{}]+\}/.test(prefix))
      throw new Error(
        "Redis prefix must contain a cluster hash tag, for example token:{blockend}:"
      );
  }
  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    const ttl = Math.max(1, record.expiresAt.getTime() - Date.now());
    const saved = await this.redis.eval(
      `if redis.call('EXISTS',KEYS[3])==1 then return 0 end; redis.call('SET',KEYS[3],ARGV[2],'PX',ARGV[1]); redis.call('SADD',KEYS[1],KEYS[3]); local familyTtl=redis.call('PTTL',KEYS[1]); if familyTtl < tonumber(ARGV[1]) then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; redis.call('SADD',KEYS[2],KEYS[3]); local subTtl=redis.call('PTTL',KEYS[2]); if subTtl < tonumber(ARGV[1]) then redis.call('PEXPIRE',KEYS[2],ARGV[1]) end; return 1`,
      {
        keys: [
          this.familyKey(record.familyId),
          this.subKey(record.sub),
          this.refreshKey(record.tokenHash)
        ],
        arguments: [String(ttl), this.serialize(record)]
      }
    );
    if (Number(saved) !== 1) throw new Error("Duplicate refresh token hash");
  }
  async getRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | undefined> {
    const raw = await this.redis.get(this.refreshKey(tokenHash));
    return raw ? this.deserialize(raw) : undefined;
  }
  async rotateRefreshToken(input: {
    currentHash: string;
    replacement: RefreshTokenRecord;
    now: Date;
  }): Promise<RotateResult> {
    const currentKey = this.refreshKey(input.currentHash),
      replacementKey = this.refreshKey(input.replacement.tokenHash);
    const raw = await this.redis.eval(ROTATE_SCRIPT, {
      keys: [currentKey, replacementKey],
      arguments: [String(input.now.getTime()), this.serialize(input.replacement), this.prefix]
    });
    if (!Array.isArray(raw) || typeof raw[0] !== "string")
      throw new Error("Unexpected Redis rotate response");
    const status = raw[0] as RotateResult["status"];
    if (status === "missing") return { status };
    const record = this.deserialize(String(raw[1]));
    return { status, record } as RotateResult;
  }
  async revokeByHash(hash: string): Promise<void> {
    await this.redis.eval(
      `local r=redis.call('GET',KEYS[1]); if r then local v=cjson.decode(r); v.status='revoked'; redis.call('SET',KEYS[1],cjson.encode(v),'KEEPTTL') end; return 1`,
      { keys: [this.refreshKey(hash)], arguments: [] }
    );
  }
  async revokeByFamily(id: string): Promise<void> {
    await this.redis.eval(REVOKE_SET_SCRIPT, { keys: [this.familyKey(id)], arguments: [] });
  }
  async revokeBySub(sub: string): Promise<void> {
    await this.redis.eval(REVOKE_SET_SCRIPT, { keys: [this.subKey(sub)], arguments: [] });
  }
  async revokeByJti(jti: string, expiresAt?: Date): Promise<void> {
    await this.redis.set(this.jtiKey(jti), "1", {
      PX: Math.max(1, (expiresAt?.getTime() ?? Date.now() + 3_600_000) - Date.now())
    });
  }
  async isJtiRevoked(jti: string): Promise<boolean> {
    return (await this.redis.get(this.jtiKey(jti))) !== null;
  }
  private refreshKey(hash: string) {
    return `${this.prefix}refresh:${hash}`;
  }
  private familyKey(id: string) {
    return `${this.prefix}family:${id}`;
  }
  private subKey(sub: string) {
    return `${this.prefix}sub:${sub}`;
  }
  private jtiKey(jti: string) {
    return `${this.prefix}jti:${jti}`;
  }
  private serialize(record: RefreshTokenRecord): string {
    return JSON.stringify({
      ...record,
      createdAtMs: record.createdAt.getTime(),
      expiresAtMs: record.expiresAt.getTime(),
      usedAtMs: record.usedAt?.getTime(),
      createdAt: undefined,
      expiresAt: undefined,
      usedAt: undefined
    });
  }
  private deserialize(raw: string): RefreshTokenRecord {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      tokenHash: String(value.tokenHash),
      familyId: String(value.familyId),
      sub: String(value.sub),
      status: value.status as RefreshTokenRecord["status"],
      createdAt: new Date(Number(value.createdAtMs)),
      expiresAt: new Date(Number(value.expiresAtMs)),
      ...(value.usedAtMs ? { usedAt: new Date(Number(value.usedAtMs)) } : {}),
      ...(value.metadata && typeof value.metadata === "object"
        ? { metadata: value.metadata as Record<string, unknown> }
        : {})
    };
  }
}
