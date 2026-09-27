import { createRemoteJWKSet, type JWTHeaderParameters } from "jose";
import { TokenError } from "../core/errors.js";
import type { KeyProvider, SigningAlgorithm, SigningKey, VerificationKey } from "../core/types.js";

/** Verification-only provider for resource services. Issuing through this provider intentionally fails closed. */
export class RemoteJwksKeyProvider implements KeyProvider {
  private readonly resolver: ReturnType<typeof createRemoteJWKSet>;
  constructor(input: {
    jwksUri: string;
    cooldownDurationMs?: number;
    cacheMaxAgeMs?: number;
    timeoutDurationMs?: number;
  }) {
    const url = new URL(input.jwksUri);
    if (url.protocol !== "https:")
      throw new TokenError("INVALID_INPUT", "Remote JWKS URL must use HTTPS");
    this.resolver = createRemoteJWKSet(url, {
      cooldownDuration: input.cooldownDurationMs ?? 30_000,
      cacheMaxAge: input.cacheMaxAgeMs ?? 600_000,
      timeoutDuration: input.timeoutDurationMs ?? 5_000
    });
  }
  async getSigningKey(): Promise<SigningKey> {
    throw new TokenError(
      "UNSUPPORTED_OPERATION",
      "Remote JWKS is verification-only; inject a signing/KMS provider in the issuer"
    );
  }
  async getVerificationKey(input: {
    kid?: string;
    alg: SigningAlgorithm;
  }): Promise<VerificationKey> {
    const header: JWTHeaderParameters = {
      alg: input.alg,
      ...(input.kid ? { kid: input.kid } : {})
    };
    const resolved = await this.resolver(header);
    return { key: resolved, ...(input.kid ? { kid: input.kid } : {}), alg: input.alg };
  }
}
