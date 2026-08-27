export class PasswordHashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordHashError";
  }
}

export class InvalidPepperError extends PasswordHashError {
  constructor(message = "Pepper must be a base64-encoded string of at least 32 bytes") {
    super(message);
    this.name = "InvalidPepperError";
  }
}

export class InvalidConfigError extends PasswordHashError {
  constructor(message = "Invalid password-hash configuration parameters") {
    super(message);
    this.name = "InvalidConfigError";
  }
}

export class PasswordTooLongError extends PasswordHashError {
  constructor(maxBytes: number) {
    super(`Password exceeds maximum allowed byte length (${maxBytes} bytes)`);
    this.name = "PasswordTooLongError";
  }
}
