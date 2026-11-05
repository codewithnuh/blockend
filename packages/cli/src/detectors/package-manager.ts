import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import type { ProjectContext } from "../types/index.js";

const MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

const LOCKFILES: Array<{ file: string; manager: ProjectContext["packageManager"] }> = [
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "bun.lockb", manager: "bun" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "package-lock.json", manager: "npm" }
];

function packageManagerField(dir: string): ProjectContext["packageManager"] | null {
  const pkgJsonPath = join(dir, "package.json");
  if (!existsSync(pkgJsonPath)) return null;

  try {
    const packageJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    if (typeof packageJson.packageManager !== "string") return null;

    const manager = packageJson.packageManager.split("@")[0];
    return (MANAGERS as readonly string[]).includes(manager)
      ? (manager as ProjectContext["packageManager"])
      : null;
  } catch {
    return null;
  }
}

/**
 * Detects the package manager from the nearest `packageManager` field or
 * lockfile. Walking up lets a workspace package inherit the root's choice.
 */
export function detectPackageManager(cwd: string): ProjectContext["packageManager"] {
  let dir = cwd;
  while (true) {
    const declared = packageManagerField(dir);
    if (declared) return declared;

    for (const { file, manager } of LOCKFILES) {
      if (existsSync(join(dir, file))) return manager;
    }

    const parent = dirname(dir);
    if (parent === dir) return "npm";
    dir = parent;
  }
}
