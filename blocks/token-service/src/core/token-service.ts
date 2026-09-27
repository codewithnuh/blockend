import {
  decodeProtectedHeader,
  errors as JoseErrors,
  jwtVerify,
  SignJWT,
  type JWTPayload
} from "jose";
import { TokenError, isTokenError } from "./errors.js";
import { clamp, hashToken, jsonByteLength, newId, newOpaqueToken } from "./crypto.js";
import {
  assertAllowedAlgorithm,
  parseIssue,
  parseOptions,
  parseRevoke,
  type IssueInput
} from "./validation.js";
import type {
  AccessTokenClaims,
  RefreshTokenRecord,
  RevokeInput,
  SigningAlgorithm,
  TokenEvent,
  TokenPair,
  TokenService,
  TokenServiceOptions,
  VerifyResult
} from "./types.js";

const ACCESS_DEFAULT = 900,
  ACCESS_MIN = 60,
  ACCESS_MAX = 3600;
const REFRESH_DEFAULT = 604_800,
  REFRESH_MIN = 3600,
  REFRESH_MAX = 2_592_000;
const DEFAULT_FORBIDDEN = [
  "password",
  "password_hash",
  "secret",
  "private_key",
  "privatekey",
  "access_token",
  "refresh_token",
  "token",
  "__proto__",
  "prototype",
  "constructor"
];
const RESERVED = new Set(["iss", "sub", "aud", "exp", "nbf", "iat", "jti", "type"]);

class DefaultTokenService implements TokenService {
  private readonly options: TokenServiceOptions;
  private readonly allowedAlgorithms: SigningAlgorithm[];
  private readonly forbidden: Set<string>;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(options: TokenServiceOptions) {
    this.options = parseOptions(options);
    this.allowedAlgorithms = options.algorithms ?? ["RS256", "ES256"];
    this.forbidden = new Set(
      (options.forbiddenClaimKeys ?? DEFAULT_FORBIDDEN).map((key) => key.toLowerCase())
    );
    this.accessTtl = clamp(options.accessTokenTtlSeconds, ACCESS_DEFAULT, ACCESS_MIN, ACCESS_MAX);
    this.refreshTtl = clamp(
      options.refreshTokenTtlSeconds,
      REFRESH_DEFAULT,
      REFRESH_MIN,
      REFRESH_MAX
    );
  }

  async issue(raw: IssueInput): Promise<TokenPair> {
    try {
      const input = parseIssue(raw);
      this.assertClaims(input.claims ?? {});
      this.assertAudience(input.audience);
      const access = input.tokens?.access ?? true;
      const refresh = input.tokens?.refresh ?? true;
      if (!access && !refresh)
        throw new TokenError("INVALID_INPUT", "At least one token must be requested");
      const now = this.nowSeconds();
      const pair: TokenPair = { tokenType: "Bearer", issuedAt: now };
      if (access) {
        const ttl = clamp(input.accessTokenTtlSeconds, this.accessTtl, ACCESS_MIN, ACCESS_MAX);
        pair.accessToken = await this.signAccess(
          input.sub,
          input.claims ?? {},
          input.audience ?? this.options.audience,
          ttl,
          now
        );
        pair.expiresIn = ttl;
      }
      if (refresh) {
        const ttl = clamp(input.refreshTokenTtlSeconds, this.refreshTtl, REFRESH_MIN, REFRESH_MAX);
        const token = newOpaqueToken();
        const record = this.refreshRecord(token, input.sub, newId(), ttl, now);
        await this.store(() => this.options.tokenStore.saveRefreshToken(record));
        pair.refreshToken = token;
        pair.refreshExpiresIn = ttl;
      }
      this.emit({
        name: "token.issued",
        at: this.now().toISOString(),
        sub: input.sub
      });
      return pair;
    } catch (error) {
      throw this.failure(error);
    }
  }

  async verify(accessToken: string): Promise<VerifyResult> {
    try {
      if (typeof accessToken !== "string" || accessToken.length < 20 || accessToken.length > 16_384)
        throw new TokenError("INVALID_TOKEN", "Invalid access token");
      const header = decodeProtectedHeader(accessToken);
      if (!header.alg || header.alg === "none")
        throw new TokenError("INVALID_TOKEN", "Missing or invalid algorithm");
      assertAllowedAlgorithm(header.alg, this.allowedAlgorithms);
      const verification = await this.options.keyProvider.getVerificationKey({
        ...(header.kid ? { kid: header.kid } : {}),
        alg: header.alg
      });
      if (verification.alg !== header.alg)
        throw new TokenError("INVALID_TOKEN", "Key algorithm mismatch");
      const result = await jwtVerify(accessToken, verification.key, {
        algorithms: this.allowedAlgorithms,
        issuer: this.options.issuer,
        ...(this.options.audience ? { audience: this.options.audience } : {}),
        clockTolerance: this.options.clockSkewSeconds ?? 30,
        currentDate: this.now(),
        requiredClaims: ["sub", "exp", "iat", "jti", "type"]
      });
      const claims = this.toAccessClaims(result.payload);
      if (
        this.options.tokenStore.isJtiRevoked &&
        (await this.store(() => this.options.tokenStore.isJtiRevoked!(claims.jti)))
      ) {
        throw new TokenError("TOKEN_REVOKED", "Access token has been revoked");
      }
      this.emit({
        name: "token.verified",
        at: this.now().toISOString(),
        sub: claims.sub,
        jti: claims.jti
      });
      return { valid: true, claims };
    } catch (error) {
      throw this.failure(error);
    }
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      if (typeof refreshToken !== "string" || refreshToken.length < 32 || refreshToken.length > 512)
        throw new TokenError("INVALID_TOKEN", "Invalid refresh token");
      const nowDate = this.now();
      const now = Math.floor(nowDate.getTime() / 1000);
      const currentHash = hashToken(refreshToken);
      const current = await this.store(() => this.options.tokenStore.getRefreshToken(currentHash));
      if (!current) throw new TokenError("INVALID_TOKEN", "Unknown refresh token");
      if (current.status === "revoked")
        throw new TokenError("TOKEN_REVOKED", "Refresh token revoked");
      if (current.status === "active" && current.expiresAt.getTime() <= nowDate.getTime())
        throw new TokenError("TOKEN_EXPIRED", "Refresh token expired");

      // Complete fallible identity lookups and signing before consuming the current token.
      // The store still performs the final status check and rotation atomically.
      let accessToken: string | undefined;
      if (current.status === "active") {
        const context = (await this.options.resolveRefreshContext?.(current.sub)) ?? {};
        this.assertClaims(context.claims ?? {});
        const audience = context.audience ?? this.options.audience;
        this.assertAudience(audience);
        accessToken = await this.signAccess(
          current.sub,
          context.claims ?? {},
          audience,
          this.accessTtl,
          now
        );
      }
      const replacementToken = newOpaqueToken();
      // The subject/family are filled by transactional stores from the current record.
      const placeholder = this.refreshRecord(
        replacementToken,
        "__from_current__",
        "__from_current__",
        this.refreshTtl,
        now
      );
      const result = await this.store(() =>
        this.options.tokenStore.rotateRefreshToken({
          currentHash,
          replacement: placeholder,
          now: nowDate
        })
      );
      if (result.status === "missing")
        throw new TokenError("INVALID_TOKEN", "Unknown refresh token");
      if (result.status === "expired")
        throw new TokenError("TOKEN_EXPIRED", "Refresh token expired");
      if (result.status === "revoked")
        throw new TokenError("TOKEN_REVOKED", "Refresh token revoked");
      if (result.status === "reused") {
        await this.store(() => this.options.tokenStore.revokeByFamily(result.record.familyId));
        this.emit({
          name: "token.reuse_detected",
          at: nowDate.toISOString(),
          sub: result.record.sub,
          familyId: result.record.familyId
        });
        throw new TokenError(
          "REFRESH_REUSED",
          "Refresh token reuse detected; token family revoked"
        );
      }
      if (!accessToken)
        throw new TokenError("KEY_UNAVAILABLE", "Could not prepare the access token");
      const { sub, familyId } = result.record;
      this.emit({
        name: "token.refreshed",
        at: nowDate.toISOString(),
        sub,
        familyId
      });
      return {
        accessToken,
        refreshToken: replacementToken,
        tokenType: "Bearer",
        expiresIn: this.accessTtl,
        refreshExpiresIn: this.refreshTtl,
        issuedAt: now
      };
    } catch (error) {
      throw this.failure(error);
    }
  }

  async revoke(raw: RevokeInput): Promise<void> {
    try {
      const input = parseRevoke(raw);
      const nowDate = this.now();
      if ("refreshToken" in input)
        await this.store(() => this.options.tokenStore.revokeByHash(hashToken(input.refreshToken)));
      else if ("familyId" in input)
        await this.store(() => this.options.tokenStore.revokeByFamily(input.familyId));
      else if ("sub" in input)
        await this.store(() => this.options.tokenStore.revokeBySub(input.sub));
      else {
        if (!this.options.tokenStore.revokeByJti)
          throw new TokenError(
            "UNSUPPORTED_OPERATION",
            "This store does not support access-token revocation"
          );
        const clockTolerance = this.options.clockSkewSeconds ?? 30;
        const expiresAt = new Date(nowDate.getTime() + (ACCESS_MAX + clockTolerance) * 1000);
        await this.store(() => this.options.tokenStore.revokeByJti!(input.jti, expiresAt));
      }
      this.emit({
        name: "token.revoked",
        at: this.now().toISOString(),
        ...("jti" in input ? { jti: input.jti } : {}),
        ...("sub" in input ? { sub: input.sub } : {}),
        ...("familyId" in input ? { familyId: input.familyId } : {})
      });
    } catch (error) {
      throw this.failure(error);
    }
  }

  private async signAccess(
    sub: string,
    claims: Record<string, unknown>,
    audience: string | string[] | undefined,
    ttl: number,
    now: number
  ): Promise<string> {
    const customSigner = this.options.keyProvider.signJwt;
    if (customSigner) {
      const signing = await this.options.keyProvider.getSigningKey?.();
      if (!signing)
        throw new TokenError(
          "KEY_UNAVAILABLE",
          "Custom signer must expose its active kid and algorithm"
        );
      if (!this.allowedAlgorithms.includes(signing.alg))
        throw new TokenError("KEY_UNAVAILABLE", "Signing key algorithm is not allowed");
      return customSigner.call(this.options.keyProvider, {
        protectedHeader: { alg: signing.alg, kid: signing.kid, typ: "JWT" },
        payload: {
          ...claims,
          type: "access",
          iss: this.options.issuer,
          sub,
          ...(audience ? { aud: audience } : {}),
          iat: now,
          exp: now + ttl,
          jti: newId()
        }
      });
    }
    const signing = await this.options.keyProvider.getSigningKey?.();
    if (!signing) throw new TokenError("KEY_UNAVAILABLE", "No signing capability is configured");
    if (!this.allowedAlgorithms.includes(signing.alg))
      throw new TokenError("KEY_UNAVAILABLE", "Signing key algorithm is not allowed");
    let jwt = new SignJWT({ ...claims, type: "access" })
      .setProtectedHeader({ alg: signing.alg, kid: signing.kid, typ: "JWT" })
      .setIssuer(this.options.issuer)
      .setSubject(sub)
      .setIssuedAt(now)
      .setExpirationTime(now + ttl)
      .setJti(newId());
    if (audience) jwt = jwt.setAudience(audience);
    return jwt.sign(signing.key);
  }

  private assertClaims(claims: Record<string, unknown>): void {
    if (jsonByteLength(claims) > (this.options.maxClaimsBytes ?? 4096))
      throw new TokenError("CLAIMS_TOO_LARGE", "Custom claims exceed the configured byte limit");
    const inspect = (value: unknown, root = true): void => {
      if (!value || typeof value !== "object") return;
      for (const [key, nested] of Object.entries(value)) {
        const normalized = key.toLowerCase();
        if (root && RESERVED.has(normalized))
          throw new TokenError("FORBIDDEN_CLAIM", `Reserved claim: ${key}`);
        if (this.forbidden.has(normalized))
          throw new TokenError("FORBIDDEN_CLAIM", `Forbidden claim: ${key}`);
        inspect(nested, false);
      }
    };
    inspect(claims);
  }

  private assertAudience(requested: string | string[] | undefined): void {
    if (!requested || !this.options.audience) return;
    const allowed = new Set(
      Array.isArray(this.options.audience) ? this.options.audience : [this.options.audience]
    );
    const values = Array.isArray(requested) ? requested : [requested];
    if (values.some((audience) => !allowed.has(audience)))
      throw new TokenError("INVALID_INPUT", "Requested audience is not allowed");
  }

  private refreshRecord(
    token: string,
    sub: string,
    familyId: string,
    ttl: number,
    now: number
  ): RefreshTokenRecord {
    return {
      tokenHash: hashToken(token),
      sub,
      familyId,
      status: "active",
      createdAt: new Date(now * 1000),
      expiresAt: new Date((now + ttl) * 1000)
    };
  }
  private toAccessClaims(payload: JWTPayload): AccessTokenClaims {
    if (
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.iss !== "string" ||
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number" ||
      typeof payload.jti !== "string"
    )
      throw new TokenError("INVALID_TOKEN", "Invalid access-token claims");
    return payload as AccessTokenClaims;
  }
  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
  private nowSeconds(): number {
    return Math.floor(this.now().getTime() / 1000);
  }
  private emit(event: TokenEvent): void {
    try {
      this.options.onEvent?.(event);
    } catch {
      /* telemetry must not change auth behavior */
    }
  }
  private async store<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (cause) {
      if (isTokenError(cause)) throw cause;
      throw new TokenError("STORE_UNAVAILABLE", "Token store operation failed", { cause });
    }
  }
  private failure(error: unknown): TokenError {
    const mapped = isTokenError(error)
      ? error
      : error instanceof JoseErrors.JWTExpired
        ? new TokenError("TOKEN_EXPIRED", "Access token expired", {
            cause: error
          })
        : error instanceof JoseErrors.JOSEError
          ? new TokenError("INVALID_TOKEN", "Access token validation failed", {
              cause: error
            })
          : new TokenError("KEY_UNAVAILABLE", "Token operation failed", {
              cause: error
            });
    this.emit({
      name: "token.failed",
      at: this.now().toISOString(),
      code: mapped.code
    });
    return mapped;
  }
}

/** Creates an isolated token service. Configuration is validated immediately. */
export function createTokenService(options: TokenServiceOptions): TokenService {
  return new DefaultTokenService(options);
}
