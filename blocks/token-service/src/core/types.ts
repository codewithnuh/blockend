import type { JWK } from "jose";
import type { IssueInput } from "./validation.js";

export type SigningAlgorithm =
  | "RS256"
  | "RS384"
  | "RS512"
  | "PS256"
  | "PS384"
  | "PS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "EdDSA"
  | "HS256"
  | "HS384"
  | "HS512";

export interface TokenPair {
  accessToken?: string;
  refreshToken?: string;
  tokenType: "Bearer";
  expiresIn?: number;
  refreshExpiresIn?: number;
  issuedAt: number;
}

export interface AccessTokenClaims {
  sub: string;
  iss: string;
  aud?: string | string[];
  exp: number;
  iat: number;
  jti: string;
  type: "access";
  [key: string]: unknown;
}

export interface VerifyResult {
  valid: true;
  claims: AccessTokenClaims;
}

export type RevokeInput =
  | { refreshToken: string }
  | { jti: string }
  | { sub: string }
  | { familyId: string };

export type TokenErrorCode =
  | "INVALID_INPUT"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "REFRESH_REUSED"
  | "CLAIMS_TOO_LARGE"
  | "FORBIDDEN_CLAIM"
  | "KEY_UNAVAILABLE"
  | "STORE_UNAVAILABLE"
  | "UNSUPPORTED_OPERATION";

export type TokenEvent = {
  name:
    | "token.issued"
    | "token.verified"
    | "token.refreshed"
    | "token.revoked"
    | "token.reuse_detected"
    | "token.failed";
  at: string;
  sub?: string;
  jti?: string;
  familyId?: string;
  code?: TokenErrorCode;
};

export interface SigningKey {
  key: CryptoKey | Uint8Array;
  kid: string;
  alg: SigningAlgorithm;
}
export interface VerificationKey {
  key: CryptoKey | Uint8Array;
  kid?: string;
  alg: SigningAlgorithm;
}

/** Supplies private signing keys and public verification keys. Providers may rotate by changing the returned `kid`. */
export interface ProviderSignInput {
  protectedHeader: { alg: SigningAlgorithm; kid: string; typ: "JWT" };
  payload: Record<string, unknown>;
}

export interface KeyProvider {
  getSigningKey?(): Promise<SigningKey>;
  signJwt?(input: ProviderSignInput): Promise<string>;
  getVerificationKey(input: { kid?: string; alg: SigningAlgorithm }): Promise<VerificationKey>;
  getPublicJwks?(): Promise<{ keys: JWK[] }>;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  familyId: string;
  sub: string;
  expiresAt: Date;
  status: "active" | "used" | "revoked";
  createdAt: Date;
  usedAt?: Date;
  metadata?: Record<string, unknown>;
}

export type RotateResult =
  | { status: "rotated"; record: RefreshTokenRecord }
  | { status: "missing" }
  | { status: "expired"; record: RefreshTokenRecord }
  | { status: "reused"; record: RefreshTokenRecord }
  | { status: "revoked"; record: RefreshTokenRecord };

/** Persistence boundary. Rotation and reuse-triggered family revocation must each be atomic across all instances. */
export interface TokenStore {
  saveRefreshToken(record: RefreshTokenRecord): Promise<void>;
  getRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | undefined>;
  rotateRefreshToken(input: {
    currentHash: string;
    replacement: RefreshTokenRecord;
    now: Date;
  }): Promise<RotateResult>;
  revokeByHash(tokenHash: string): Promise<void>;
  revokeByFamily(familyId: string): Promise<void>;
  revokeBySub(sub: string): Promise<void>;
  revokeByJti?(jti: string, expiresAt?: Date): Promise<void>;
  isJtiRevoked?(jti: string): Promise<boolean>;
}

export interface TokenServiceOptions {
  /** Defaults to production; development permits localhost HTTP and an omitted audience. */
  deploymentMode?: "development" | "production";
  issuer: string;
  audience?: string | string[];
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  clockSkewSeconds?: number;
  algorithms?: SigningAlgorithm[];
  keyProvider: KeyProvider;
  tokenStore: TokenStore;
  maxClaimsBytes?: number;
  forbiddenClaimKeys?: string[];
  onEvent?: (event: TokenEvent) => void;
  /** Reload current authorization claims instead of copying stale data from refresh tokens. */
  resolveRefreshContext?: (sub: string) => Promise<{
    claims?: Record<string, unknown>;
    audience?: string | string[];
  }>;
  now?: () => Date;
}

export interface TokenService {
  issue(input: IssueInput): Promise<TokenPair>;
  verify(accessToken: string): Promise<VerifyResult>;
  refresh(refreshToken: string): Promise<TokenPair>;
  revoke(input: RevokeInput): Promise<void>;
}
