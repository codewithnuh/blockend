import { CreateHealthOptions } from "../types/index";

export function validateConfig(options: CreateHealthOptions): void {
  if (!options.checks || !Array.isArray(options.checks)) {
    throw new Error("Health configuration error: 'checks' must be a valid array.");
  }

  if (options.checks.length === 0) {
    throw new Error("Health configuration error: 'checks' array cannot be empty.");
  }

  const names = new Set<string>();

  for (const check of options.checks) {
    if (!check.name || typeof check.name !== "string" || check.name.trim() === "") {
      throw new Error(
        "Health configuration error: Each check must have a non-empty string 'name'."
      );
    }

    if (names.has(check.name)) {
      throw new Error(
        `Health configuration error: Duplicate check name found: "${check.name}". Names must be unique.`
      );
    }
    names.add(check.name);

    if (typeof check.run !== "function") {
      throw new Error(
        `Health configuration error: Check "${check.name}" is missing a valid 'run' function.`
      );
    }

    if (
      check.timeoutMs !== undefined &&
      (typeof check.timeoutMs !== "number" || check.timeoutMs <= 0)
    ) {
      throw new Error(
        `Health configuration error: Check "${check.name}" has an invalid 'timeoutMs'. It must be a positive number.`
      );
    }
  }

  if (
    options.defaultTimeoutMs !== undefined &&
    (typeof options.defaultTimeoutMs !== "number" || options.defaultTimeoutMs <= 0)
  ) {
    throw new Error("Health configuration error: 'defaultTimeoutMs' must be a positive number.");
  }
}
