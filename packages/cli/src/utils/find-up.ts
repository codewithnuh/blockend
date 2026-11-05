import { dirname, join } from "path";
import fs from "fs/promises";

/**
 * Walks up from `startDir` until `filename` is found, returning its absolute
 * path. Returns null at the filesystem root without a match.
 */
export async function findUp(filename: string, startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, filename);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}
