import { exportJWK, importPKCS8, importSPKI, type JWK } from "jose";
import { TokenError } from "../core/errors.js";
import type { KeyProvider, SigningAlgorithm, SigningKey, VerificationKey } from "../core/types.js";

export interface LocalKey {
  kid: string;
  alg: SigningAlgorithm;
  privateKeyPem: string;
  publicKeyPem: string;
}

/** PEM-backed provider supporting a current signing key and old verification keys during rotation. */
export class LocalKeyProvider implements KeyProvider {
  private readonly keys: LocalKey[];
  private readonly signingKid: string;
  private readonly privateCache = new Map<string, CryptoKey>();
  private readonly publicCache = new Map<string, CryptoKey>();
  constructor(input: { keys: LocalKey[]; signingKid: string }) {
    if (!input.keys.length || new Set(input.keys.map((key) => key.kid)).size !== input.keys.length)
      throw new TokenError("INVALID_INPUT", "Local keys require unique kid values");
    if (!input.keys.some((key) => key.kid === input.signingKid))
      throw new TokenError("INVALID_INPUT", "signingKid was not found");
    this.keys = input.keys;
    this.signingKid = input.signingKid;
  }
  async getSigningKey(): Promise<SigningKey> {
    const entry = this.keys.find((key) => key.kid === this.signingKid)!;
    let key = this.privateCache.get(entry.kid);
    if (!key) {
      key = await importPKCS8(entry.privateKeyPem, entry.alg);
      this.privateCache.set(entry.kid, key);
    }
    return { key, kid: entry.kid, alg: entry.alg };
  }
  async getVerificationKey(input: {
    kid?: string;
    alg: SigningAlgorithm;
  }): Promise<VerificationKey> {
    if (!input.kid) throw new TokenError("INVALID_TOKEN", "Token is missing kid");
    const entry = this.keys.find((key) => key.kid === input.kid && key.alg === input.alg);
    if (!entry) throw new TokenError("KEY_UNAVAILABLE", "No matching verification key");
    let key = this.publicCache.get(entry.kid);
    if (!key) {
      key = await importSPKI(entry.publicKeyPem, entry.alg);
      this.publicCache.set(entry.kid, key);
    }
    return { key, kid: entry.kid, alg: entry.alg };
  }
  async getPublicJwks(): Promise<{ keys: JWK[] }> {
    const keys = await Promise.all(
      this.keys.map(async (entry) => ({
        ...(await exportJWK(
          (await this.getVerificationKey({ kid: entry.kid, alg: entry.alg })).key as CryptoKey
        )),
        kid: entry.kid,
        alg: entry.alg,
        use: "sig"
      }))
    );
    return { keys };
  }
}
