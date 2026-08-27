/**
 * Core configuration for Argon2id hashing.
 */
export interface Argon2Params {
  /** Memory cost in KiB (e.g., 65536 for 64 MiB) */
  memoryCost: number;
  /** Number of iterations */
  timeCost: number;
  /** Degree of parallelism (use 1 for web apps) */
  parallelism: number;
  /** Length of the hash output in bytes */
  outputLen: number;
}

/**
 * Full configuration including pepper and input limits.
 */
export interface PasswordHashConfig extends Argon2Params {
  /** Base64-encoded pepper (must decode to ≥32 bytes) */
  pepper: string;
  /** Maximum allowed password byte length (prevent DoS) */
  maxInputBytes: number;
}

/**
 * Options that can be overridden when instantiating PasswordHasher.
 */
export type PasswordHashConfigOverrides = Partial<PasswordHashConfig>;
