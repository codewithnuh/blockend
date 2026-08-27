import type { PasswordHashConfig, PasswordHashConfigOverrides } from "./types";
import { InvalidPepperError, InvalidConfigError } from "./errors";

/**
 * Load configuration from environment variables, with optional overrides.
 * Environment variables:
 *   APP_PASSWORD_PEPPER       (required)
 *   ARGON2_MEMORY_COST        (default: 65536)
 *   ARGON2_TIME_COST          (default: 3)
 *   ARGON2_PARALLELISM        (default: 1)
 *   ARGON2_OUTPUT_LEN         (default: 32)
 *   PASSWORD_MAX_INPUT_BYTES  (default: 128)
 */

// RFC 4648 base64 (standard alphabet, optional padding). Node's decoder is
// lenient and silently skips invalid characters, so the format must be
// validated before decoding.
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

const MAX_UINT32 = 4294967295;
const MAX_PARALLELISM = 255; // native binding limit

function resolveNumber(
  override: number | undefined,
  envValue: string | undefined,
  fallback: number,
  label: string,
  max: number = MAX_UINT32
): number {
  // Empty string is treated as unset so defaults still apply.
  const resolved =
    override ?? (envValue === undefined || envValue.trim() === "" ? fallback : Number(envValue));
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > max) {
    const received = override !== undefined ? String(override) : (envValue ?? String(fallback));
    throw new InvalidConfigError(
      `${label} must be a positive integer between 1 and ${max}, but received "${received}"`
    );
  }
  return resolved;
}

export function loadConfig(overrides: PasswordHashConfigOverrides = {}): PasswordHashConfig {
  const pepper = overrides.pepper ?? process.env.APP_PASSWORD_PEPPER;
  if (!pepper) {
    throw new InvalidPepperError("APP_PASSWORD_PEPPER environment variable is required");
  }
  if (!BASE64_PATTERN.test(pepper)) {
    throw new InvalidPepperError();
  }

  const pepperBuffer = Buffer.from(pepper, "base64");
  if (pepperBuffer.length < 32) {
    throw new InvalidPepperError();
  }

  return {
    pepper,
    memoryCost: resolveNumber(
      overrides.memoryCost,
      process.env.ARGON2_MEMORY_COST,
      65536,
      "ARGON2_MEMORY_COST"
    ),
    timeCost: resolveNumber(
      overrides.timeCost,
      process.env.ARGON2_TIME_COST,
      3,
      "ARGON2_TIME_COST"
    ),
    parallelism: resolveNumber(
      overrides.parallelism,
      process.env.ARGON2_PARALLELISM,
      1,
      "ARGON2_PARALLELISM",
      MAX_PARALLELISM
    ),
    outputLen: resolveNumber(
      overrides.outputLen,
      process.env.ARGON2_OUTPUT_LEN,
      32,
      "ARGON2_OUTPUT_LEN"
    ),
    maxInputBytes: resolveNumber(
      overrides.maxInputBytes,
      process.env.PASSWORD_MAX_INPUT_BYTES,
      128,
      "PASSWORD_MAX_INPUT_BYTES"
    )
  };
}
