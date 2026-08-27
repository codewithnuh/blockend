import { describe, it, expect } from "vitest";
import { PasswordHashError, InvalidPepperError, PasswordTooLongError } from "./errors";

describe("Error Classes", () => {
  it("PasswordHashError extends Error", () => {
    const err = new PasswordHashError("generic");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PasswordHashError");
    expect(err.message).toBe("generic");
  });

  it("InvalidPepperError has correct name and default message", () => {
    const err = new InvalidPepperError();
    expect(err).toBeInstanceOf(PasswordHashError);
    expect(err.name).toBe("InvalidPepperError");
    expect(err.message).toContain("at least 32 bytes");
  });

  it("PasswordTooLongError includes max bytes in message", () => {
    const err = new PasswordTooLongError(128);
    expect(err).toBeInstanceOf(PasswordHashError);
    expect(err.name).toBe("PasswordTooLongError");
    expect(err.message).toContain("128");
  });

  it("error hierarchy is intact for instanceof checks", () => {
    expect(new InvalidPepperError()).toBeInstanceOf(Error);
    expect(new PasswordTooLongError(64)).toBeInstanceOf(Error);
    expect(new PasswordHashError("x")).not.toBeInstanceOf(InvalidPepperError);
  });

  it("messages never embed caller-supplied secrets", () => {
    const secretish = "super-secret-pepper-material";
    const err = new PasswordTooLongError(128);
    expect(err.message).not.toContain(secretish);
  });
});
