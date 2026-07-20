import { describe, test, expect } from "vitest";
import { z, ZodError } from "zod";
import { coreValidator } from "./core.js";

describe("Validator Block - Core Validator Engine", () => {
  test("should successfully validate and return data that matches the schema", () => {
    const userSchema = z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      age: z.number().min(18),
      isActive: z.boolean()
    });

    const validPayload = {
      id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      email: "developer@blockend.dev",
      age: 26,
      isActive: true
    };

    const result = coreValidator(userSchema, validPayload);

    expect(result).toEqual(validPayload);
    expect(result.email).toBe("developer@blockend.dev");
  });

  test("should strip out undeclared keys if the schema does not allow them", () => {
    // This test only passes if coreValidator/schema is configured to STRIP unknown keys.
    // If you want to error instead, switch to z.strictObject(...) and expect a throw.
    const internalSchema = z.object({
      apiKey: z.string()
    });

    const payloadWithExtraKeys = {
      apiKey: "sk_live_12345",
      maliciousInjectedKey: "drop tables;"
    };

    const result = coreValidator(internalSchema, payloadWithExtraKeys);

    expect(result).toEqual({ apiKey: "sk_live_12345" });
    expect(result).not.toHaveProperty("maliciousInjectedKey");
  });

  test("should throw a ZodError when validation constraints are violated", () => {
    const productSchema = z.object({
      title: z.string().min(3),
      price: z.number().positive()
    });

    const invalidPayload = {
      title: "ab",
      price: -10.5
    };

    expect(() => coreValidator(productSchema, invalidPayload)).toThrow(ZodError);

    try {
      coreValidator(productSchema, invalidPayload);
      throw new Error("Expected coreValidator to throw");
    } catch (error) {
      if (!(error instanceof ZodError)) {
        throw new Error("Expected thrown object to be an instance of ZodError");
      }

      expect(error.issues).toHaveLength(2);

      // paths are arrays, so check the first segment
      expect(error.issues[0].path[0]).toBe("title");
      expect(error.issues[1].path[0]).toBe("price");
    }
  });
});
