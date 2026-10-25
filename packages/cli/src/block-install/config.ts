import { dirname, join } from "path";
import fs from "fs/promises";
import type { BlockendConfig, InstalledBlockRecord } from "./types.js";

/**
 * Walk up from `startDir` until `filename` is found.
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

/**
 * Replace the installed record for a block. Tracking failures are non-fatal:
 * the files are already on disk and the command should not fail because the
 * bookkeeping file could not be updated.
 */
export async function recordInstalledBlock(
  configPath: string,
  record: InstalledBlockRecord
): Promise<void> {
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(raw) as BlockendConfig;
    if (!Array.isArray(config.installed)) config.installed = [];
    config.installed = config.installed.filter((block) => block.name !== record.name);
    config.installed.push(record);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch {
    // Non-fatal: files were written, just tracking failed.
  }
}
