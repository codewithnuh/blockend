import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
    outDir?: string;
  };
}

/**
 * Reads tsconfig.json if it exists. Returns null if not found.
 * Does NOT throw — absence of tsconfig just means JavaScript project.
 */
export async function readTsConfig(cwd: string): Promise<TsConfig | null> {
  const tsconfigPath = join(cwd, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return null;

  try {
    const content = await readFile(tsconfigPath, "utf-8");
    // Strip JSON comments — tsconfig allows them, JSON.parse does not
    const stripped = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    return JSON.parse(stripped) as TsConfig;
  } catch {
    // Malformed tsconfig — treat as no tsconfig rather than crashing the CLI
    return null;
  }
}
