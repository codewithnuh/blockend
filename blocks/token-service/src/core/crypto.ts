import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { TokenError } from "./errors.js";

export function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
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
