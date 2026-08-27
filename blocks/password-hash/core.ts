import crypto from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { PasswordHashConfig, PasswordHashConfigOverrides } from "./types";
import { loadConfig } from "./config";
import { PasswordTooLongError } from "./errors";

/**
 * Framework-agnostic password hashing service using Argon2id.
 * Can be used in Express, Fastify, Hono, or any Node.js environment.
 */
export class PasswordHasher {
  private readonly config: PasswordHashConfig;
  private readonly pepperBuffer: Buffer;

  constructor(overrides: PasswordHashConfigOverrides = {}) {
    this.config = loadConfig(overrides);
    this.pepperBuffer = Buffer.from(this.config.pepper, "base64");
  }

  /**
   * Apply pepper using HMAC-SHA256.
   * The result is always 32 bytes.
   * Enforces maximum input byte length.
   */
  private applyPepper(password: string): Buffer {
    if (typeof password !== "string") {
      throw new TypeError("password must be a string");
    }

    const byteLength = Buffer.byteLength(password, "utf8");
    if (byteLength > this.config.maxInputBytes) {
      throw new PasswordTooLongError(this.config.maxInputBytes);
    }

    return crypto.createHmac("sha256", this.pepperBuffer).update(password, "utf8").digest();
  }

  /**
   * Hash a plaintext password and return a PHC string.
   * The peppered digest is passed as base64 because @node-rs/argon2's
   * verify() rejects raw binary buffers ("invalid utf-8 sequence"), while
   * a fixed-width ASCII encoding stays byte-stable across hash and verify.
   */
  async hashPassword(password: string): Promise<string> {
    const peppered = this.applyPepper(password).toString("base64");
    const salt = crypto.randomBytes(16); // 128-bit salt

    return hash(peppered, {
      algorithm: 2, // Argon2id
      memoryCost: this.config.memoryCost,
      timeCost: this.config.timeCost,
      parallelism: this.config.parallelism,
      outputLen: this.config.outputLen,
      salt
    });
  }

  /**
   * Verify a plaintext password against a stored Argon2id PHC string.
   * Returns false if the hash is not Argon2id or verification fails.
   * Throws PasswordTooLongError / TypeError for caller mistakes
   * (same policy as hashing).
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    if (typeof storedHash !== "string" || !storedHash.startsWith("$argon2id$")) {
      return false;
    }

    // Deliberately outside try/catch: caller mistakes such as oversized
    // passwords or non-string input must propagate instead of being
    // masked as a failed login.
    const peppered = this.applyPepper(password).toString("base64");

    try {
      return await verify(storedHash, peppered);
    } catch {
      // Malformed hash, unsupported parameters, or native binding error.
      // Treat as verification failure — never throw for corrupt stored data.
      return false;
    }
  }

  /**
   * Check if a stored hash was created with weaker or different parameters
   * and should be rehashed.
   */
  needsRehash(storedHash: string): boolean {
    if (typeof storedHash !== "string" || !storedHash.startsWith("$argon2id$")) {
      return true;
    }

    const params = this.extractPhcParams(storedHash);
    if (!params) return true;

    // Force rehash on version mismatch or any parameter that is weaker
    // or different from the current configuration.
    return (
      params.version !== 19 ||
      params.memoryCost < this.config.memoryCost ||
      params.timeCost < this.config.timeCost ||
      params.parallelism !== this.config.parallelism ||
      params.outputLen !== this.config.outputLen
    );
  }

  /**
   * Expose current configuration (read-only).
   */
  get currentConfig(): Readonly<PasswordHashConfig> {
    return { ...this.config };
  }

  /**
   * Parse the parameter section of a PHC string.
   * Returns null on any parse failure.
   *
   * Expected form: $argon2id$v=19$m=65536,t=3,p=1$salt$hash
   * (outputLen is not always present in the PHC string produced by
   * @node-rs/argon2; we treat a missing value as the library default of 32)
   */
  private extractPhcParams(storedHash: string): {
    version: number;
    memoryCost: number;
    timeCost: number;
    parallelism: number;
    outputLen: number;
  } | null {
    // Split: ["", "argon2id", "v=19", "m=65536,t=3,p=1", "salt", "hash"]
    const parts = storedHash.split("$");
    if (parts.length < 5 || parts[1] !== "argon2id") {
      return null;
    }

    const versionPart = parts[2];
    const paramPart = parts[3];

    // Explicit guards — TypeScript cannot always narrow array access
    if (!versionPart || !paramPart || !versionPart.startsWith("v=")) {
      return null;
    }

    const version = parseInt(versionPart.slice(2), 10);
    if (Number.isNaN(version)) return null;

    const paramMap = new Map<string, number>();
    for (const pair of paramPart.split(",")) {
      const [key, value] = pair.split("=");
      if (!key || value === undefined) continue;
      const num = parseInt(value, 10);
      if (!Number.isNaN(num)) {
        paramMap.set(key, num);
      }
    }

    const memoryCost = paramMap.get("m");
    const timeCost = paramMap.get("t");
    const parallelism = paramMap.get("p");

    if (memoryCost === undefined || timeCost === undefined || parallelism === undefined) {
      return null;
    }

    // @node-rs/argon2 does not always emit "l=" (output length).
    // Fall back to the common default of 32 when absent.
    const outputLen = paramMap.get("l") ?? 32;

    return {
      version,
      memoryCost,
      timeCost,
      parallelism,
      outputLen
    };
  }
}
