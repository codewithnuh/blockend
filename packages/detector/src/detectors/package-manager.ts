import { existsSync } from "fs";
import { join } from "path";
import type { ProjectContext } from "@blockend/core";

/**
 * Detects the package manager by checking for lockfiles.
 * Lockfiles are more reliable than checking for binaries in PATH.
 */
export function detectPackageManager(cwd: string): ProjectContext["packageManager"] {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "bun.lockb"))) return "bun";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}
