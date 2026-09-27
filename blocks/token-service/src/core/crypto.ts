import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { TokenError } from "./errors.js";

export function newOpaqueToken(familyId: string): string {
  return `rt1.${Buffer.from(familyId, "utf8").toString("base64url")}.${randomBytes(32).toString("base64url")}`;
}
export function familyIdFromOpaqueToken(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "rt1" || !/^[A-Za-z0-9_-]{43}$/.test(parts[2]!))
    return undefined;
  try {
    const secret = Buffer.from(parts[2]!, "base64url");
    if (secret.byteLength !== 32 || secret.toString("base64url") !== parts[2]) return undefined;
    const encoded = parts[1]!;
    const familyId = Buffer.from(encoded, "base64url").toString("utf8");
    if (Buffer.from(familyId, "utf8").toString("base64url") !== encoded) return undefined;
    if (
      !/^(?:[A-Za-z0-9_-]{43}\.)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        familyId
      )
    )
      return undefined;
    return familyId;
  } catch {
    return undefined;
  }
}
export function newId(): string {
  return crypto.randomUUID();
}
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}
export function equalHash(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function jsonByteLength(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch (cause) {
    throw new TokenError("INVALID_INPUT", "Claims must be JSON serializable", {
      cause
    });
  }
}

export function clamp(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  return Math.min(max, Math.max(min, value ?? fallback));
}
