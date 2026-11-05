import { readFile } from "fs/promises";
import { existsSync, statSync } from "fs";
import { createRequire } from "module";
import { dirname, join, relative, resolve } from "path";

/** A parsed tsconfig/jsconfig, including its resolved `extends` chain. */
export interface TsConfig {
  extends?: string | string[];
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
    outDir?: string;
    module?: string;
    moduleResolution?: string;
  };
}

/** The compiler config used for detection, tagged by source file kind. */
export interface CompilerConfig {
  kind: "tsconfig" | "jsconfig";
  config: TsConfig;
}

const CONFIG_FILES = [
  { filename: "tsconfig.json", kind: "tsconfig" },
  { filename: "jsconfig.json", kind: "jsconfig" }
] as const;

const MAX_EXTENDS_DEPTH = 5;

/**
 * Reads the project's tsconfig.json or jsconfig.json, resolving any `extends`
 * chain so packages inheriting a shared base still expose its compilerOptions.
 * Returns null when neither exists or neither can be parsed.
 */
export async function readCompilerConfig(cwd: string): Promise<CompilerConfig | null> {
  for (const { filename, kind } of CONFIG_FILES) {
    const configPath = join(cwd, filename);
    if (!existsSync(configPath)) continue;

    const config = await parseConfigFile(configPath);
    if (!config) continue;

    const compilerOptions = await resolveCompilerOptions(configPath, new Set());
    const paths = await resolveEffectivePaths(configPath, dirname(configPath));
    if (paths) compilerOptions.paths = paths;

    return { kind, config: { ...config, compilerOptions } };
  }

  return null;
}

async function parseConfigFile(filePath: string): Promise<TsConfig | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(stripTrailingCommas(stripJsonComments(content))) as TsConfig;
  } catch {
    return null;
  }
}

/** Merges compilerOptions from the whole `extends` chain, child winning. */
async function resolveCompilerOptions(
  filePath: string,
  seen: Set<string>
): Promise<NonNullable<TsConfig["compilerOptions"]>> {
  if (seen.has(filePath)) return {};
  seen.add(filePath);

  const config = await parseConfigFile(filePath);
  if (!config) {
    seen.delete(filePath);
    return {};
  }

  let merged: NonNullable<TsConfig["compilerOptions"]> = {};
  for (const spec of toArray(config.extends)) {
    const target = resolveExtendsTarget(spec, dirname(filePath));
    if (!target) continue;
    merged = { ...merged, ...(await resolveCompilerOptions(target, seen)) };
  }

  seen.delete(filePath);
  return { ...merged, ...config.compilerOptions };
}

/**
 * Path aliases are relative to the config that declares them, so a mapping
 * inherited from another directory must be re-expressed relative to the
 * inheriting package before it can describe that package's files.
 */
async function resolveEffectivePaths(
  configPath: string,
  packageDir: string
): Promise<Record<string, string[]> | undefined> {
  const declaration = await findPathsDeclaration(configPath, new Set(), 0);
  if (!declaration) return undefined;
  if (resolve(declaration.dir) === resolve(packageDir)) return declaration.paths;

  const fromDir = declaration.baseUrl
    ? resolve(declaration.dir, declaration.baseUrl)
    : declaration.dir;

  const rebased: Record<string, string[]> = {};
  for (const [alias, targets] of Object.entries(declaration.paths)) {
    rebased[alias] = Array.isArray(targets)
      ? targets.map((target) =>
          typeof target === "string" ? rebaseTarget(target, fromDir, packageDir) : target
        )
      : targets;
  }
  return rebased;
}

/** Finds the nearest config in the chain that declares `paths`. */
async function findPathsDeclaration(
  filePath: string,
  seen: Set<string>,
  depth: number
): Promise<{ paths: Record<string, string[]>; dir: string; baseUrl?: string } | null> {
  if (depth > MAX_EXTENDS_DEPTH || seen.has(filePath)) return null;
  seen.add(filePath);

  const config = await parseConfigFile(filePath);
  if (!config) return null;

  if (config.compilerOptions?.paths) {
    return {
      paths: config.compilerOptions.paths,
      dir: dirname(filePath),
      baseUrl: config.compilerOptions.baseUrl
    };
  }

  for (const spec of toArray(config.extends)) {
    const target = resolveExtendsTarget(spec, dirname(filePath));
    if (!target) continue;
    const found = await findPathsDeclaration(target, seen, depth + 1);
    if (found) return found;
  }

  return null;
}

function rebaseTarget(target: string, fromDir: string, toDir: string): string {
  const starIndex = target.indexOf("*");
  const dirPart = starIndex >= 0 ? target.slice(0, starIndex) : target;
  const tail = starIndex >= 0 ? target.slice(starIndex) : "";

  const rebased = relative(toDir, resolve(fromDir, dirPart)).replace(/\\/g, "/");
  const prefix = rebased === "" ? "" : rebased + (dirPart.endsWith("/") ? "/" : "");

  return `${prefix}${tail}`;
}

function toArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  return typeof value === "string" && value.length > 0 ? [value] : [];
}

function resolveExtendsTarget(spec: string, fromDir: string): string | null {
  const isRelative = spec.startsWith(".") || spec.startsWith("/") || /^[A-Za-z]:/.test(spec);

  if (isRelative) {
    const base = resolve(fromDir, spec);
    return firstExisting([base, `${base}.json`, join(base, "tsconfig.json")]);
  }

  try {
    const require = createRequire(join(fromDir, "package.json"));
    const resolved = require.resolve(spec);
    return existsSync(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

/** Returns the first candidate that is an existing file, preserving order. */
function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Not a file — try the next candidate.
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
