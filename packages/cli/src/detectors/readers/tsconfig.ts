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
      const clean = stripTrailingCommas(stripJsonComments(content));

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

/**
 * Removes line and block comments without touching comment-like sequences
 * inside JSON strings, such as the "@/*" alias key.
 */
function stripJsonComments(input: string): string {
  let output = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      } else if (char === "\n" || char === "\r") {
        output += char;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    output += char;
  }

  return output;
}

/** Removes trailing commas without touching commas inside JSON strings. */
function stripTrailingCommas(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let next = i + 1;
      while (next < input.length && /\s/.test(input[next])) next++;
      if (input[next] === "}" || input[next] === "]") continue;
    }

    output += char;
  }

  return output;
}
