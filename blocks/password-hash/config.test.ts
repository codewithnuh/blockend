import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config";
import { InvalidPepperError } from "./errors";

describe("Configuration Loading and Validation", () => {
  const VALID_PEPPER = Buffer.alloc(32, 1).toString("base64"); // decodes to 32 bytes

  beforeEach(() => {
    vi.stubEnv("APP_PASSWORD_PEPPER", VALID_PEPPER);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("pepper requirement (plan 1.1)", () => {
    it("throws InvalidPepperError when APP_PASSWORD_PEPPER is missing entirely", () => {
      vi.stubEnv("APP_PASSWORD_PEPPER", undefined);
      expect(() => loadConfig()).toThrow(InvalidPepperError);
    });

    it("throws InvalidPepperError when APP_PASSWORD_PEPPER is empty", () => {
      vi.stubEnv("APP_PASSWORD_PEPPER", "");
      expect(() => loadConfig()).toThrow(InvalidPepperError);
      expect(() => loadConfig()).toThrow(/APP_PASSWORD_PEPPER/);
    });
  });

  describe("pepper length (plan 1.2)", () => {
    it("throws InvalidPepperError when pepper decodes to less than 32 bytes", () => {
      vi.stubEnv("APP_PASSWORD_PEPPER", Buffer.alloc(31, 2).toString("base64"));
      expect(() => loadConfig()).toThrow(InvalidPepperError);
    });

    it("accepts a pepper that decodes to exactly 32 bytes", () => {
      const config = loadConfig();
      expect(config.pepper).toBe(VALID_PEPPER);
    });

    it("accepts a pepper longer than 32 bytes", () => {
      vi.stubEnv("APP_PASSWORD_PEPPER", Buffer.alloc(64, 3).toString("base64"));
      expect(() => loadConfig()).not.toThrow();
    });
  });

  describe("pepper format (plan 1.3)", () => {
    it("rejects a long string containing non-base64 characters", () => {
      // Long enough that the lenient decoder would produce >= 32 bytes,
      // so only strict format validation can reject it.
      vi.stubEnv(
        "APP_PASSWORD_PEPPER",
        "not*valid*base64*but*decodes*long*enough*to*fool*a*lenient*reader"
      );
      expect(() => loadConfig()).toThrow(InvalidPepperError);
    });

    it("rejects a pepper with invalid characters even when length would suffice", () => {
      vi.stubEnv("APP_PASSWORD_PEPPER", `${"A".repeat(48)}!`);
      expect(() => loadConfig()).toThrow(InvalidPepperError);
    });

    it("rejects a whitespace-only pepper", () => {
      vi.stubEnv("APP_PASSWORD_PEPPER", "   ");
      expect(() => loadConfig()).toThrow(InvalidPepperError);
    });

    it("rejects base64 with incorrect padding placement", () => {
      // 'QQ==' in the middle of the string is not canonical base64
      vi.stubEnv("APP_PASSWORD_PEPPER", `QQ==${Buffer.alloc(30, 4).toString("base64")}`);
      expect(() => loadConfig()).toThrow(InvalidPepperError);
    });

    it("does not leak the pepper value in the rejection message", () => {
      const bad = "not*valid*base64*but*decodes*long*enough*to*fool*a*lenient*reader";
      vi.stubEnv("APP_PASSWORD_PEPPER", bad);
      try {
        loadConfig();
        expect.unreachable("loadConfig should have thrown");
      } catch (error) {
        expect((error as Error).message).not.toContain(bad);
      }
    });
  });

  describe("default values (plan 1.4)", () => {
    it("uses secure defaults when only pepper is set", () => {
      const config = loadConfig();
      expect(config).toEqual({
        pepper: VALID_PEPPER,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
        outputLen: 32,
        maxInputBytes: 128
      });
    });
  });

  describe("environment variable overrides (plan 1.5)", () => {
    it("overrides each default via its environment variable", () => {
      vi.stubEnv("ARGON2_MEMORY_COST", "47104");
      vi.stubEnv("ARGON2_TIME_COST", "4");
      vi.stubEnv("ARGON2_PARALLELISM", "2");
      vi.stubEnv("ARGON2_OUTPUT_LEN", "64");
      vi.stubEnv("PASSWORD_MAX_INPUT_BYTES", "256");

      const config = loadConfig();
      expect(config.memoryCost).toBe(47104);
      expect(config.timeCost).toBe(4);
      expect(config.parallelism).toBe(2);
      expect(config.outputLen).toBe(64);
      expect(config.maxInputBytes).toBe(256);
    });

    it("lets constructor overrides win over environment variables (plan 1.6)", () => {
      vi.stubEnv("ARGON2_MEMORY_COST", "47104");
      vi.stubEnv("ARGON2_TIME_COST", "4");

      const config = loadConfig({ memoryCost: 8192, timeCost: 1 });
      expect(config.memoryCost).toBe(8192);
      expect(config.timeCost).toBe(1);
      // untouched values still come from env/defaults
      expect(config.parallelism).toBe(1);
      expect(config.outputLen).toBe(32);
    });

    it("supports partial overrides merged with defaults (plan 1.6)", () => {
      const config = loadConfig({ maxInputBytes: 64 });
      expect(config.maxInputBytes).toBe(64);
      expect(config.memoryCost).toBe(65536);
      expect(config.timeCost).toBe(3);
    });
  });

  describe("numeric parameter validation (plan 1.7)", () => {
    it.each([
      ["ARGON2_MEMORY_COST", "-1"],
      ["ARGON2_MEMORY_COST", "abc"],
      ["ARGON2_MEMORY_COST", "3.5"],
      ["ARGON2_TIME_COST", "0"],
      ["ARGON2_TIME_COST", "-3"],
      ["ARGON2_TIME_COST", "NaN"],
      ["ARGON2_PARALLELISM", "0"],
      ["ARGON2_PARALLELISM", "256"],
      ["ARGON2_OUTPUT_LEN", "0"],
      ["PASSWORD_MAX_INPUT_BYTES", "0"],
      ["PASSWORD_MAX_INPUT_BYTES", "-128"]
    ])("rejects %s=%s instead of passing it to Argon2", (name, value) => {
      vi.stubEnv(name, value);
      expect(() => loadConfig()).toThrow(/invalid|must be|positive/i);
    });

    it("treats empty numeric env vars as unset and falls back to defaults", () => {
      vi.stubEnv("ARGON2_MEMORY_COST", "");
      expect(loadConfig().memoryCost).toBe(65536);
    });

    it("rejects an override object containing impossible parameters", () => {
      expect(() => loadConfig({ memoryCost: -8192 })).toThrow(/invalid|must be|positive/i);
      expect(() => loadConfig({ timeCost: 0 })).toThrow(/invalid|must be|positive/i);
      expect(() => loadConfig({ parallelism: 300 })).toThrow(/invalid|must be|positive/i);
    });
  });
});
