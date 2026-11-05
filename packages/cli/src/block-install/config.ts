import fs from "fs/promises";
import type { BlockendConfig, InstalledBlockRecord } from "./types.js";

export { findUp } from "../utils/find-up.js";

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
