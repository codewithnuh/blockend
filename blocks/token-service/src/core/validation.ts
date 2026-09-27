import { z } from "zod";
import { TokenError } from "./errors.js";
import type { RevokeInput, SigningAlgorithm, TokenServiceOptions } from "./types.js";

const algorithms = [
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
  "HS256",
  "HS384",
  "HS512"
] as const;
const issueSchema = z
  .object({
    sub: z.string().trim().min(1).max(512),
    claims: z.record(z.string(), z.unknown()).optional(),
    tokens: z
      .object({
        access: z.boolean().optional(),
        refresh: z.boolean().optional()
      })
      .optional(),
    accessTokenTtlSeconds: z.number().int().positive().optional(),
    refreshTokenTtlSeconds: z.number().int().positive().optional(),
    audience: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional()
  })
  .strict();
export type IssueInput = z.infer<typeof issueSchema>;
const optionsSchema = z
  .object({
    deploymentMode: z.enum(["development", "production"]).optional(),
    issuer: z.string().trim().min(1).max(2048),
    audience: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    accessTokenTtlSeconds: z.number().int().positive().optional(),
    refreshTokenTtlSeconds: z.number().int().positive().optional(),
    clockSkewSeconds: z.number().int().min(0).max(300).optional(),
    algorithms: z.array(z.enum(algorithms)).min(1).optional(),
    keyProvider: z.custom<object>((v) => typeof v === "object" && v !== null),
    tokenStore: z.custom<object>((v) => typeof v === "object" && v !== null),
    maxClaimsBytes: z.number().int().min(256).max(16_384).optional(),
    forbiddenClaimKeys: z.array(z.string().min(1)).optional(),
    onEvent: z.function().optional(),
    resolveRefreshContext: z.function().optional(),
    now: z.function().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    const validateMethods = (
      candidate: object,
      path: string,
      required: string[],
      optional: string[]
    ) => {
      const methods = candidate as Record<string, unknown>;
      for (const method of required) {
        if (typeof methods[method] !== "function")
          ctx.addIssue({
            code: "custom",
            path: [path, method],
            message: `${path}.${method} must be a function`
          });
      }
      for (const method of optional) {
        if (methods[method] !== undefined && typeof methods[method] !== "function")
          ctx.addIssue({
            code: "custom",
            path: [path, method],
            message: `${path}.${method} must be a function when provided`
          });
      }
    };
    validateMethods(
      value.keyProvider,
      "keyProvider",
      ["getSigningKey", "getVerificationKey"],
      ["signJwt", "getPublicJwks"]
    );
    validateMethods(
      value.tokenStore,
      "tokenStore",
      [
        "saveRefreshToken",
        "getRefreshToken",
        "rotateRefreshToken",
        "revokeByHash",
        "revokeByFamily",
        "revokeBySub"
      ],
      ["revokeByJti", "isJtiRevoked"]
    );
    if ((value.deploymentMode ?? "production") === "production") {
      if (!value.audience)
        ctx.addIssue({
          code: "custom",
          path: ["audience"],
          message: "Audience is required in production"
        });
      if (!(value.issuer.startsWith("https://") || value.issuer.startsWith("urn:")))
        ctx.addIssue({
          code: "custom",
          path: ["issuer"],
          message: "Production issuer must be HTTPS or a URN"
        });
      if (value.algorithms?.some((alg) => alg.startsWith("HS")))
        ctx.addIssue({
          code: "custom",
          path: ["algorithms"],
          message: "Symmetric JWT algorithms are not allowed in production mode"
        });
    }
  });

export function parseIssue(input: IssueInput): IssueInput {
  const result = issueSchema.safeParse(input);
  if (!result.success)
    throw new TokenError("INVALID_INPUT", "Invalid token issue input", {
      cause: result.error
    });
  return result.data as IssueInput;
}

export function parseOptions(input: TokenServiceOptions): TokenServiceOptions {
  const result = optionsSchema.safeParse(input);
  if (!result.success)
    throw new TokenError("INVALID_INPUT", "Invalid token service options", {
      cause: result.error
    });
  return input;
}

export function parseRevoke(input: RevokeInput): RevokeInput {
  if (!input || typeof input !== "object")
    throw new TokenError("INVALID_INPUT", "Invalid revocation target");
  const entries = Object.entries(input).filter(
    ([, value]) => typeof value === "string" && value.length > 0
  );
  if (
    entries.length !== 1 ||
    Object.keys(input).length !== 1 ||
    !["refreshToken", "jti", "sub", "familyId"].includes(entries[0]![0])
  ) {
    throw new TokenError("INVALID_INPUT", "Exactly one valid revocation target is required");
  }
  return input;
}

export function assertAllowedAlgorithm(
  alg: string,
  allowed: SigningAlgorithm[]
): asserts alg is SigningAlgorithm {
  if (!allowed.includes(alg as SigningAlgorithm))
    throw new TokenError("INVALID_TOKEN", "Token algorithm is not allowed");
}
