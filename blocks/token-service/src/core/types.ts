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
  | "REFRESH_LIMIT"
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
  /** Fixed absolute deadline shared by every descendant in the family. */
  familyExpiresAt: Date;
  /** Number of successful rotations already performed in this family. */
  rotationCount: number;
  /** Rotation ceiling fixed when the family was issued. */
  rotationLimit: number;
  /** Redis-internal generation used to invalidate every family for a subject. */
  subjectGeneration?: string;
  status: "active" | "used" | "revoked";
  createdAt: Date;
  usedAt?: Date;
  metadata?: Record<string, unknown>;
}

export type RotateResult =
  | { status: "rotated"; record: RefreshTokenRecord }
  | { status: "missing" }
  | { status: "expired"; record: RefreshTokenRecord }
  | { status: "limit"; record: RefreshTokenRecord }
  | { status: "reused"; record: RefreshTokenRecord }
  | { status: "revoked"; record: RefreshTokenRecord };

/** Persistence boundary. Rotation and reuse-triggered family revocation must each be atomic across all instances. */
export interface TokenStore {
  /**
   * Optional store-specific family ID. Return a UUID or `<43-char-base64url-route>.<UUID>`;
   * Redis uses the latter to route a subject's state to one cluster slot.
   */
  createFamilyId?(sub: string): string;
  saveRefreshToken(record: RefreshTokenRecord): Promise<void>;
  getRefreshToken(tokenHash: string, familyId?: string): Promise<RefreshTokenRecord | undefined>;
  rotateRefreshToken(input: {
    currentHash: string;
    replacement: RefreshTokenRecord;
    now: Date;
    maxRotations: number;
  }): Promise<RotateResult>;
  revokeByHash(tokenHash: string, familyId?: string): Promise<void>;
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
  /** Absolute lifetime of one refresh family; defaults to 90 days. */
  maxRefreshFamilyLifetimeSeconds?: number;
  /** Maximum successful rotations per family; defaults to 10,000. */
  maxRefreshRotations?: number;
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
