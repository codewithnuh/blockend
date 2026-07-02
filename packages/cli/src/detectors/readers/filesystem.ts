import { existsSync } from "fs";
import { join } from "path";

/**
 * Infers where source files live in the project.
 * Checks in this order: src/, app/, lib/, then falls back to project root.
 */
export async function inferSrcDir(cwd: string): Promise<string> {
  const candidates = ["src", "app", "lib"];
  for (const dir of candidates) {
    if (existsSync(join(cwd, dir))) {
      return join(cwd, dir);
    }
  }
  return cwd;
}
