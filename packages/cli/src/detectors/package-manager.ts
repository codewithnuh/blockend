import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { ProjectContext } from "../types/index.js";

/**
 * Detects the package manager by checking for lockfiles.
 * Lockfiles are more reliable than checking for binaries in PATH.
 */
export function detectPackageManager(cwd: string): ProjectContext["packageManager"] {
  const pkgJsonPath = join(cwd, "package.json");
  if (existsSync(pkgJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

      if (typeof packageJson.packageManager === "string") {
        const manager = packageJson.packageManager.split("@")[0];

        if (manager === "npm" || manager === "pnpm" || manager === "yarn" || manager === "bun") {
          return manager;
        }
      }
    } catch {
      // Ignore invalid package.json and continue
    }
  }
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "bun.lockb"))) return "bun";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}
