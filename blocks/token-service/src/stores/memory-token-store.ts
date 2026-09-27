import type { RefreshTokenRecord, RotateResult, TokenStore } from "../core/types.js";

/** Development/test store. It is process-local and must not be used across multiple instances. */
export class MemoryTokenStore implements TokenStore {
  private readonly refresh = new Map<string, RefreshTokenRecord>();
  private readonly revokedJtis = new Map<string, number>();
  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    if (this.refresh.has(record.tokenHash)) throw new Error("Duplicate refresh hash");
    this.refresh.set(record.tokenHash, { ...record });
  }
  async getRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | undefined> {
    const record = this.refresh.get(tokenHash);
    return record ? { ...record } : undefined;
  }
  async rotateRefreshToken(input: {
    currentHash: string;
    replacement: RefreshTokenRecord;
    now: Date;
    maxRotations: number;
  }): Promise<RotateResult> {
    const current = this.refresh.get(input.currentHash);
    if (!current) return { status: "missing" };
    if (current.status === "used") {
      for (const item of this.refresh.values())
        if (item.familyId === current.familyId) item.status = "revoked";
      return { status: "reused", record: { ...current } };
    }
    if (current.status === "revoked") return { status: "revoked", record: { ...current } };
    if (current.expiresAt.getTime() <= input.now.getTime())
      return { status: "expired", record: { ...current } };
    if (current.familyExpiresAt.getTime() <= input.now.getTime())
      return { status: "expired", record: { ...current } };
    if (current.rotationCount >= Math.min(current.rotationLimit, input.maxRotations))
      return { status: "limit", record: { ...current } };
    current.status = "used";
    current.usedAt = input.now;
    const replacement = {
      ...input.replacement,
      sub: current.sub,
      familyId: current.familyId,
      familyExpiresAt: current.familyExpiresAt,
      rotationCount: current.rotationCount + 1,
      rotationLimit: Math.min(current.rotationLimit, input.maxRotations),
      expiresAt: new Date(
        Math.min(input.replacement.expiresAt.getTime(), current.familyExpiresAt.getTime())
      )
    };
    this.refresh.set(replacement.tokenHash, replacement);
    return { status: "rotated", record: { ...replacement } };
  }
  async revokeByHash(hash: string, _familyId?: string): Promise<void> {
    const item = this.refresh.get(hash);
    if (item) await this.revokeByFamily(item.familyId);
  }
  async revokeByFamily(familyId: string): Promise<void> {
    for (const item of this.refresh.values())
      if (item.familyId === familyId) item.status = "revoked";
  }
  async revokeBySub(sub: string): Promise<void> {
    for (const item of this.refresh.values()) if (item.sub === sub) item.status = "revoked";
  }
  async revokeByJti(jti: string, expiresAt?: Date): Promise<void> {
    this.revokedJtis.set(jti, expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
  }
  async isJtiRevoked(jti: string): Promise<boolean> {
    const expiry = this.revokedJtis.get(jti);
    if (expiry === undefined) return false;
    if (expiry <= Date.now()) {
      this.revokedJtis.delete(jti);
      return false;
    }
    return true;
  }
}
