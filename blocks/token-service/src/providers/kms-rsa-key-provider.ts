import type { KeyProvider, ProviderSignInput, SigningKey, VerificationKey } from "../core/types.js";
import { TokenError } from "../core/errors.js";

export interface KmsRsaSigner {
  /** Return an RSASSA-PKCS1-v1_5 SHA-256 signature over `data`. */
  sign(data: Uint8Array): Promise<Uint8Array>;
}

/** RS256 provider for AWS/GCP/Azure/HSM clients without coupling the block to a cloud SDK. */
export class KmsRsaKeyProvider implements KeyProvider {
  constructor(
    private readonly input: { kid: string; publicKey: CryptoKey; signer: KmsRsaSigner }
  ) {}
  async getSigningKey(): Promise<SigningKey> {
    // Public key is returned only as signing metadata; signJwt performs the private operation.
    return { key: this.input.publicKey, kid: this.input.kid, alg: "RS256" };
  }
  async signJwt(input: ProviderSignInput): Promise<string> {
    const encoder = new TextEncoder();
    const header = Buffer.from(JSON.stringify(input.protectedHeader)).toString("base64url");
    const payload = Buffer.from(JSON.stringify(input.payload)).toString("base64url");
    const signingInput = `${header}.${payload}`;
    const signature = await this.input.signer.sign(encoder.encode(signingInput));
    return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
  }
  async getVerificationKey(input: {
    kid?: string;
    alg: import("../core/types.js").SigningAlgorithm;
  }): Promise<VerificationKey> {
    if (input.kid !== this.input.kid || input.alg !== "RS256")
      throw new TokenError("KEY_UNAVAILABLE", "No matching KMS verification key");
    return { key: this.input.publicKey, kid: this.input.kid, alg: "RS256" };
  }
}
