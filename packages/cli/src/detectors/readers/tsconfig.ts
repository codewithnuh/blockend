import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
    outDir?: string;
    module?: string;
    moduleResolution?: string;
  };
}

export interface CompilerConfig {
  kind: "tsconfig" | "jsconfig";
  config: TsConfig;
}

const CONFIG_FILES = [
  { filename: "tsconfig.json", kind: "tsconfig" },
  { filename: "jsconfig.json", kind: "jsconfig" }
] as const;

/**
 * Reads the project's tsconfig.json or jsconfig.json.
 * Returns null when neither exists or neither can be parsed.
 */
export async function readCompilerConfig(cwd: string): Promise<CompilerConfig | null> {
  for (const { filename, kind } of CONFIG_FILES) {
    const configPath = join(cwd, filename);
    if (!existsSync(configPath)) continue;

    try {
      const content = await readFile(configPath, "utf-8");

      // Strip block and single-line comments, then tolerate trailing commas.
      const clean = content
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1")
        .replace(/,(\s*[}\]])/g, "$1");

      return {
        kind,
        config: JSON.parse(clean) as TsConfig
      };
    } catch {
      // Malformed config - fall through to the next candidate.
    }
  }

  return null;
}
