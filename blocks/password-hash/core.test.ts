import { describe, it, expect, beforeAll } from "vitest";
import { performance } from "node:perf_hooks";
import { PasswordHasher } from "./core";
import { InvalidPepperError, PasswordTooLongError } from "./errors";

const PEPPER_A = Buffer.alloc(32, 7).toString("base64");
const PEPPER_B = Buffer.alloc(32, 11).toString("base64");

const LOW_MEMORY_CONFIG = {
  pepper: PEPPER_A,
  memoryCost: 8192, // 8 MiB – fast for unit tests
  timeCost: 1,
  parallelism: 1,
  outputLen: 32,
  maxInputBytes: 128
};

// OWASP-recommended production parameters (plan section 8 + final notes)
const PRODUCTION_CONFIG = {
  pepper: PEPPER_A,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
  maxInputBytes: 128
};

/** PHC string layout: "" / "argon2id" / "v=19" / "m=..,t=..,p=.." / salt / digest */
function phcParts(hash: string): string[] {
  return hash.split("$");
}

function decodeB64(part: string | undefined): Buffer {
  return Buffer.from(part ?? "", "base64");
}

describe("PasswordHasher Core", () => {
  let hasher: PasswordHasher;

  beforeAll(() => {
    hasher = new PasswordHasher(LOW_MEMORY_CONFIG);
  });

  describe("construction and framework agnosticism (plan 9.x)", () => {
    it("instantiates without any web framework imports", () => {
      const plain = new PasswordHasher(LOW_MEMORY_CONFIG);
      expect(plain).toBeInstanceOf(PasswordHasher);
      expect(typeof plain.hashPassword).toBe("function");
      expect(typeof plain.verifyPassword).toBe("function");
      expect(typeof plain.needsRehash).toBe("function");
    });

    it("exposes async methods that return real Promises", async () => {
      const pending = hasher.hashPassword("async-check");
      expect(pending).toBeInstanceOf(Promise);
      await expect(pending).resolves.toMatch(/^\$argon2id\$/);
      const verification = hasher.verifyPassword("x", "not-a-hash");
      expect(verification).toBeInstanceOf(Promise);
      await expect(verification).resolves.toBe(false);
    });

    it("currentConfig returns a defensive copy", () => {
      const snapshot = hasher.currentConfig;
      expect(snapshot.memoryCost).toBe(8192);
      (snapshot as { memoryCost: number }).memoryCost = 1;
      expect(hasher.currentConfig.memoryCost).toBe(8192);
    });
  });

  describe("pepper application (plan 2.x)", () => {
    it("produces verifiable output for both minimal and maximal input lengths", async () => {
      // Indirect proof the HMAC pre-hash yields a uniform fixed-size buffer:
      // 1-byte and maxInputBytes passwords take the identical hashing path.
      const tiny = await hasher.hashPassword("a");
      const max = await hasher.hashPassword("a".repeat(128));
      await expect(hasher.verifyPassword("a", tiny)).resolves.toBe(true);
      await expect(hasher.verifyPassword("a".repeat(128), max)).resolves.toBe(true);
    });

    it("uses the decoded pepper bytes as the HMAC key (same password, different peppers)", async () => {
      const hashA = await hasher.hashPassword("cross-pepper");
      const hashB = await new PasswordHasher({
        ...LOW_MEMORY_CONFIG,
        pepper: PEPPER_B
      }).hashPassword("cross-pepper");
      expect(hashA.split("$")[5]).not.toBe(hashB.split("$")[5]);
      await expect(hasher.verifyPassword("cross-pepper", hashB)).resolves.toBe(false);
      await expect(
        new PasswordHasher({ ...LOW_MEMORY_CONFIG, pepper: PEPPER_B }).verifyPassword(
          "cross-pepper",
          hashA
        )
      ).resolves.toBe(false);
    });

    it("never exposes the pepper in the stored hash or thrown errors (plan 2.3)", async () => {
      const rawPepperBytes = Buffer.from(PEPPER_A, "base64");
      const stored = await hasher.hashPassword("leak-check");
      expect(stored).not.toContain(PEPPER_A);
      expect(stored).not.toContain(rawPepperBytes.toString("hex"));
      expect(stored.toLowerCase()).not.toContain(rawPepperBytes.toString("latin1").toLowerCase());

      try {
        await hasher.hashPassword("x".repeat(1000));
        expect.unreachable("should have thrown");
      } catch (error) {
        expect((error as Error).message).not.toContain(PEPPER_A);
      }
    });
  });

  describe("hashPassword (plan 3.x)", () => {
    it("returns a valid Argon2id PHC string with embedded parameters (plan 3.1, 3.5)", async () => {
      const stored = await hasher.hashPassword("CorrectHorseBatteryStaple");
      expect(stored).toMatch(/^\$argon2id\$v=19\$m=8192,t=1,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
      expect(stored.slice(1, 9)).toBe("argon2id"); // algorithm identifier is Argon2id
      expect(stored).not.toMatch(/^\$argon2[i d]\$/i);
    });

    it("generates a unique salt per hash (plan 3.2)", async () => {
      const first = await hasher.hashPassword("SamePassword");
      const second = await hasher.hashPassword("SamePassword");
      expect(first).not.toBe(second);
      expect(phcParts(first)[4]).not.toBe(phcParts(second)[4]);
    });

    it("uses a salt of at least 16 bytes (plan 3.3)", async () => {
      const stored = await hasher.hashPassword("salt-length");
      const salt = decodeB64(phcParts(stored)[4]);
      expect(salt.length).toBeGreaterThanOrEqual(16);
    });

    it("emits an output equal to config.outputLen bytes (plan 3.4)", async () => {
      const custom = new PasswordHasher({ ...LOW_MEMORY_CONFIG, outputLen: 64 });
      const stored = await custom.hashPassword("output-len");
      expect(decodeB64(phcParts(stored)[5]).length).toBe(64);

      const defaultStored = await hasher.hashPassword("output-len-default");
      expect(decodeB64(phcParts(defaultStored)[5]).length).toBe(32);
    });

    it("accepts a password exactly at maxInputBytes and rejects one byte more (plan 3.6)", async () => {
      await expect(hasher.hashPassword("a".repeat(128))).resolves.toMatch(/^\$argon2id\$/);
      await expect(hasher.hashPassword("a".repeat(129))).rejects.toThrow(PasswordTooLongError);
    });

    it("counts multi-byte characters in bytes, not characters (plan 3.6, 10.3)", async () => {
      // '€' is 3 bytes in UTF-8: 42 chars = 126 bytes (ok), 43 chars = 129 bytes (too long)
      await expect(hasher.hashPassword("€".repeat(42))).resolves.toMatch(/^\$argon2id\$/);
      await expect(hasher.hashPassword("€".repeat(43))).rejects.toThrow(PasswordTooLongError);
      // 100 × '€' = 300 bytes, far beyond the limit
      await expect(hasher.hashPassword("€".repeat(100))).rejects.toThrow(PasswordTooLongError);
    });

    it("round-trips unicode passwords with emoji and accents (plan 10.3)", async () => {
      const unicode = "pässwörd-🔐-日本語";
      const stored = await hasher.hashPassword(unicode);
      await expect(hasher.verifyPassword(unicode, stored)).resolves.toBe(true);
      await expect(hasher.verifyPassword("pässwörd-🔐-日本", stored)).resolves.toBe(false);
    });

    it("hashes an empty password by design; minimum-length policy belongs to callers (plan 10.1)", async () => {
      const stored = await hasher.hashPassword("");
      expect(stored).toMatch(/^\$argon2id\$/);
      await expect(hasher.verifyPassword("", stored)).resolves.toBe(true);
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["number", 12345]
    ])("rejects %s instead of producing a hash (plan 10.2)", async (_, bad) => {
      const input = bad as unknown as string;
      await expect(hasher.hashPassword(input)).rejects.toThrow(TypeError);
    });
  });

  describe("verifyPassword (plan 4.x)", () => {
    it("verifies the correct password (plan 4.1)", async () => {
      const password = "MySecretPassword123!";
      const stored = await hasher.hashPassword(password);
      await expect(hasher.verifyPassword(password, stored)).resolves.toBe(true);
    });

    it("rejects an incorrect password (plan 4.2)", async () => {
      const stored = await hasher.hashPassword("OriginalPassword");
      await expect(hasher.verifyPassword("WrongPassword", stored)).resolves.toBe(false);
    });

    it("still verifies hashes created with older/weaker parameters (plan 4.6)", async () => {
      const legacy = new PasswordHasher({ ...LOW_MEMORY_CONFIG, memoryCost: 4096, timeCost: 1 });
      const legacyHash = await legacy.hashPassword("legacy-user-password");
      await expect(hasher.verifyPassword("legacy-user-password", legacyHash)).resolves.toBe(true);
      await expect(hasher.verifyPassword("wrong", legacyHash)).resolves.toBe(false);
    });

    it("returns false for non-Argon2id hashes to prevent downgrade (plan 4.4)", async () => {
      const foreign = [
        "$2b$10$abcdefghijklmnopqrstuv", // bcrypt
        "$argon2i$v=19$m=8192,t=1,p=1$c2FsdA$aGFzaA", // argon2i
        "$argon2d$v=19$m=8192,t=1,p=1$c2FsdA$aGFzaA" // argon2d
      ];
      for (const hash of foreign) {
        await expect(hasher.verifyPassword("password", hash)).resolves.toBe(false);
      }
    });

    it("returns false (never throws) for malformed hashes (plan 4.5, 6.2)", async () => {
      const malformed = [
        "",
        "garbage",
        "$argon2id$",
        "$argon2id$v=19$",
        "$argon2id$v=19$m=8192,t=1,p=1$",
        "$argon2id$v=19$m=8192,t=1,p=1$c2FsdA", // missing digest
        "$argon2id$v=19$m=abc,t=x,p=y$!!!!$!!!!", // unparsable params
        "$argon2id$v=19$m=8192,t=1,p=1$salt-with-$-dollar$aGFzaA", // tampered salt
        "$argon2id$v=99$m=99999999999,t=99,p=255$!!!!$!!!!" // absurd params
      ];
      for (const hash of malformed) {
        await expect(hasher.verifyPassword("password", hash)).resolves.toBe(false);
      }
    });

    it("propagates PasswordTooLongError during verification (plan 4.7)", async () => {
      const stored = await hasher.hashPassword("short");
      await expect(hasher.verifyPassword("a".repeat(129), stored)).rejects.toThrow(
        PasswordTooLongError
      );
      await expect(hasher.verifyPassword("a".repeat(200), stored)).rejects.toThrow(/129|128/);
    });

    it("does not leak the pepper through verification errors", async () => {
      const stored = await hasher.hashPassword("no-leak");
      try {
        await hasher.verifyPassword("x".repeat(5000), stored);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect((error as Error).message).not.toContain(PEPPER_A);
      }
    });
  });

  describe("needsRehash (plan 5.x)", () => {
    it("returns false when hash parameters match current config (plan 5.1)", async () => {
      const stored = await hasher.hashPassword("fresh");
      expect(hasher.needsRehash(stored)).toBe(false);
    });

    it("returns true when stored memory cost is weaker (plan 5.2)", async () => {
      const old = new PasswordHasher({ ...LOW_MEMORY_CONFIG, memoryCost: 4096 });
      const stored = await old.hashPassword("password");
      expect(hasher.needsRehash(stored)).toBe(true);
    });

    it("returns false when stored parameters are stronger than required (plan 5.2 inverse)", async () => {
      const stronger = new PasswordHasher({ ...LOW_MEMORY_CONFIG, memoryCost: 16384 });
      const stored = await stronger.hashPassword("password");
      expect(hasher.needsRehash(stored)).toBe(false);
    });

    it("returns true when stored time cost is weaker (plan 5.3)", async () => {
      const current = new PasswordHasher({ ...LOW_MEMORY_CONFIG, timeCost: 2 });
      const stored = await hasher.hashPassword("password"); // timeCost=1
      expect(current.needsRehash(stored)).toBe(true);
    });

    it("returns true when stored parallelism differs, even if higher (plan 5.4)", async () => {
      const higher = new PasswordHasher({ ...LOW_MEMORY_CONFIG, parallelism: 2 });
      const stored = await higher.hashPassword("password");
      expect(hasher.needsRehash(stored)).toBe(true); // current parallelism = 1
    });

    it("returns true for non-Argon2id hashes such as bcrypt (plan 5.5)", () => {
      expect(hasher.needsRehash("$2b$10$abcdefghijklmnopqrstuv")).toBe(true);
      expect(hasher.needsRehash("$argon2i$v=19$m=8192,t=1,p=1$c2FsdA$aGFzaA")).toBe(true);
    });

    it("returns true for malformed or unreadable hashes (plan 5.6)", () => {
      expect(hasher.needsRehash("garbage")).toBe(true);
      expect(hasher.needsRehash("")).toBe(true);
      expect(hasher.needsRehash("$argon2id$v=19$m=nonsense")).toBe(true);
    });

    it("treats a future Argon2 version as requiring rehash (plan 5.7 decision: v != 19 -> rehash)", () => {
      const futureVersion =
        "$argon2id$v=20$m=8192,t=1,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2g";
      expect(hasher.needsRehash(futureVersion)).toBe(true);
    });
  });

  describe("dummy hash timing equalization (plan 7.x)", () => {
    it("produces a dummy hash with exactly the same parameters as real hashes (plan 7.1)", async () => {
      const dummy = await hasher.hashPassword("dummy-password-for-missing-users");
      expect(dummy).toMatch(/^\$argon2id\$v=19\$m=8192,t=1,p=1\$/);
      expect(hasher.needsRehash(dummy)).toBe(false);
    });

    it("never authenticates against the dummy hash (plan 7.2)", async () => {
      const dummy = await hasher.hashPassword("dummy-password-for-missing-users");
      await expect(hasher.verifyPassword("attacker-password", dummy)).resolves.toBe(false);
      await expect(hasher.verifyPassword("dummy-password-for-missing-users", dummy)).resolves.toBe(
        true
      ); // only its own preimage matches
    });

    it("verification cost is comparable to hashing cost (plan 4.3, 7.3, loose bound)", async () => {
      const password = "timing-probe";
      const stored = await hasher.hashPassword(password);

      const hashStart = performance.now();
      await hasher.hashPassword(password);
      const hashMs = performance.now() - hashStart;

      const verifyStart = performance.now();
      const verified = await hasher.verifyPassword(password, stored);
      const verifyMs = performance.now() - verifyStart;

      expect(verified).toBe(true);
      // Both run the same Argon2 work; allow generous slack for scheduler noise.
      expect(verifyMs).toBeLessThan(Math.max(hashMs * 3, 250));
    }, 10_000);
  });

  describe("production parameter benchmarks (plan 8.x)", () => {
    let production: PasswordHasher;

    beforeAll(() => {
      production = new PasswordHasher(PRODUCTION_CONFIG);
    });

    it("hashes with OWASP parameters (64 MiB, t=3) in under 2 seconds (plan 8.1)", async () => {
      const start = performance.now();
      const stored = await production.hashPassword("benchmark-password");
      const elapsed = performance.now() - start;

      expect(stored).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
      expect(elapsed).toBeLessThan(2000);
    }, 10_000);

    it("verifies with production parameters in under 2 seconds (plan 8.2)", async () => {
      const stored = await production.hashPassword("benchmark-password");

      const start = performance.now();
      const result = await production.verifyPassword("benchmark-password", stored);
      const elapsed = performance.now() - start;

      expect(result).toBe(true);
      expect(elapsed).toBeLessThan(2000);
    }, 10_000);

    it("rejects oversized input under production configuration too", async () => {
      await expect(production.hashPassword("a".repeat(129))).rejects.toThrow(PasswordTooLongError);
    });
  });

  describe("integration flows (plan 11.x)", () => {
    it("supports register -> login with correct and incorrect credentials (plan 11.1)", async () => {
      const email = "user@example.com";
      const database = new Map<string, string>();

      // registration
      database.set(email, await hasher.hashPassword("Sup3r-Secret!"));

      // login: wrong attempt
      expect(await hasher.verifyPassword("wrong-guess", database.get(email)!)).toBe(false);
      // login: correct attempt
      expect(await hasher.verifyPassword("Sup3r-Secret!", database.get(email)!)).toBe(true);
    });

    it("migrates a user's hash after a parameter upgrade (plan 11.1)", async () => {
      const weak = new PasswordHasher(LOW_MEMORY_CONFIG);
      const strong = new PasswordHasher({ ...LOW_MEMORY_CONFIG, timeCost: 2, memoryCost: 16384 });
      const password = "upgrade-me";
      const database = new Map<string, string>([["user", await weak.hashPassword(password)]]);

      // login on the old hash still works...
      const stored = database.get("user")!;
      expect(await strong.verifyPassword(password, stored)).toBe(true);
      // ...but triggers a transparent upgrade
      expect(strong.needsRehash(stored)).toBe(true);
      const upgraded = await strong.hashPassword(password);
      database.set("user", upgraded);

      expect(await strong.verifyPassword(password, upgraded)).toBe(true);
      expect(strong.needsRehash(upgraded)).toBe(false);
    });

    it("handles legacy bcrypt records via verify=false plus needsRehash=true (plan 11.2)", async () => {
      const legacyBcrypt = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.PxHptXCxrsPynTFNlLONSNJOmDQW"; // shape only
      expect(await hasher.verifyPassword("plaintext-attempt", legacyBcrypt)).toBe(false);
      expect(hasher.needsRehash(legacyBcrypt)).toBe(true);

      // The application layer would then rehash the freshly supplied plaintext:
      const migrated = await hasher.hashPassword("plaintext-attempt");
      expect(await hasher.verifyPassword("plaintext-attempt", migrated)).toBe(true);
      expect(hasher.needsRehash(migrated)).toBe(false);
    });

    it("rejects construction entirely when no pepper can be resolved", () => {
      const previous = process.env.APP_PASSWORD_PEPPER;
      delete process.env.APP_PASSWORD_PEPPER;
      const { pepper: _unused, ...overridesWithoutPepper } = LOW_MEMORY_CONFIG;
      try {
        expect(() => new PasswordHasher(overridesWithoutPepper)).toThrow(InvalidPepperError);
        expect(() => new PasswordHasher()).toThrow(InvalidPepperError);
      } finally {
        if (previous !== undefined) process.env.APP_PASSWORD_PEPPER = previous;
      }
    });
  });
});
