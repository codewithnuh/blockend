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

    // Process line-by-line to avoid destroying URLs within strings
    const cleanLines = content
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        // Drop purely single-line comments
        return !trimmed.startsWith("//") && !trimmed.startsWith("/*");
      })
      .join("\n")
      // Safely handle trailing commas which standard JSON.parse rejects
      .replace(/,(\s*[}\]])/g, "$1");

    return JSON.parse(cleanLines) as TsConfig;
  } catch {
    // console.log("⚠️ Failed to parse tsconfig.json:", error);
    return null;
  }
}
