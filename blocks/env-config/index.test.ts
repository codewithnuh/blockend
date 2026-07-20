import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EnvValidationError, parseEnv } from "./index";

describe("Env Config Block", () => {
  it("returns a strongly typed parsed environment object", () => {
    const schema = z.object({
      NODE_ENV: z.enum(["development", "test", "production"]),
      PORT: z.string().regex(/^\d+$/).transform(Number),
      FEATURE_FLAG: z.enum(["true", "false"]).transform((value) => value === "true")
    });

    const env = parseEnv(schema, {
      NODE_ENV: "production",
      PORT: "3000",
      FEATURE_FLAG: "true",
      IGNORED_VALUE: "not part of schema"
    });

    expect(env).toEqual({
      NODE_ENV: "production",
      PORT: 3000,
      FEATURE_FLAG: true
    });
  });

  it("throws EnvValidationError with immutable issue details when validation fails", () => {
    const schema = z.object({
      DATABASE_URL: z.string().url(),
      JWT_SECRET: z.string().min(32)
    });

    expect(() =>
      parseEnv(schema, {
        DATABASE_URL: "not-a-url",
        JWT_SECRET: "short"
      })
    ).toThrow(EnvValidationError);

    try {
      parseEnv(schema, {
        DATABASE_URL: "not-a-url",
        JWT_SECRET: "short"
      });
      throw new Error("parseEnv should have failed");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EnvValidationError);

      const envError = error as EnvValidationError;
      expect(Object.isFrozen(envError)).toBe(true);
      expect(envError.issues).toHaveLength(2);
      expect(envError.issues.map((issue) => issue.path.join("."))).toEqual([
        "DATABASE_URL",
        "JWT_SECRET"
      ]);
      expect(envError.message).toContain("Environment Configuration Validation Failed");
      expect(envError.message).toContain("DATABASE_URL");
      expect(envError.message).toContain("JWT_SECRET");
    }
  });
});
