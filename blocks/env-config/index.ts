import { z, ZodType } from "zod";

/**
 * Thrown when environment variable validation fails.
 *
 * This error is designed to fail fast during application startup,
 * preventing the application from running with an invalid configuration.
 */
export class EnvValidationError extends Error {
  public readonly issues: readonly z.core.$ZodIssue[];

  constructor(issues: readonly z.core.$ZodIssue[]) {
    const formattedIssues = issues
      .map(({ path, message }) => `  • ${path.length ? path.join(".") : "(root)"} → ${message}`)
      .join("\n");

    super(
      [
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "❌ Environment Configuration Validation Failed",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        formattedIssues,
        "",
        "Please verify your environment variables before restarting.",
        ""
      ].join("\n")
    );

    this.name = "EnvValidationError";
    this.issues = issues;

    Object.setPrototypeOf(this, new.target.prototype);

    Object.freeze(this);
  }
}

/**
 * Validates and parses environment variables using a Zod schema.
 *
 * The application should invoke this function exactly once during startup.
 * If validation fails, an {@link EnvValidationError} is thrown immediately,
 * ensuring the application never starts with an invalid configuration.
 *
 * @template T
 * The inferred type of the validated environment object.
 *
 * @param schema
 * Zod schema describing the expected environment variables.
 *
 * @param source
 * Environment source to validate.
 * Defaults to `process.env`.
 *
 * @returns
 * Fully validated and strongly typed environment configuration.
 *
 * @throws {EnvValidationError}
 * When one or more environment variables are missing or invalid.
 */
export function parseEnv<T>(
  schema: ZodType<T>,
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): T {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }

  return result.data;
}
