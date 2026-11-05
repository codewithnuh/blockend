import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { glob } from "tinyglobby";
import type { WorkspaceContext, WorkspaceManager, WorkspacePackage } from "./types.js";

interface WorkspacePackageJson {
  name?: string;
  workspaces?: string[] | { packages?: string[] };
  packageManager?: string;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  const content = await readTextOrNull(filePath);
  if (content === null) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readTextOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/** Reads the `workspaces` field in either the array or `{ packages }` shape. */
function readWorkspacesField(pkg: WorkspacePackageJson | null): string[] {
  const workspaces = pkg?.workspaces;
  if (Array.isArray(workspaces)) return workspaces;
  if (workspaces && Array.isArray(workspaces.packages)) return workspaces.packages;
  return [];
}

async function hasWorkspaceMarker(dir: string): Promise<boolean> {
  if (existsSync(join(dir, "pnpm-workspace.yaml"))) return true;
  if (existsSync(join(dir, "lerna.json"))) return true;
  if (existsSync(join(dir, "nx.json"))) return true;
  return (
    readWorkspacesField(await readJson<WorkspacePackageJson>(join(dir, "package.json"))).length > 0
  );
}

/** Walks up from `startDir` to the nearest directory acting as a workspace root. */
export async function findWorkspaceRoot(startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    if (await hasWorkspaceMarker(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Extracts the `packages:` list from a pnpm-workspace.yaml. Only the list is
 * read, so this stays a focused parser rather than a general YAML reader. It
 * handles the block form (indented or flush) and inline flow arrays.
 */
export function parsePnpmWorkspacePackages(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  let packagesIndent = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const keyMatch = line.match(/^(\s*)([A-Za-z0-9_-]+)\s*:(.*)$/);
    if (keyMatch) {
      packagesIndent = keyMatch[1].length;
      inPackages = keyMatch[2] === "packages";
      if (inPackages) patterns.push(...parseFlowList(keyMatch[3]));
      continue;
    }

    if (!inPackages) continue;

    const itemMatch = line.match(/^(\s*)-\s*(.+?)(?:\s+#.*)?\s*$/);
    if (!itemMatch || itemMatch[1].length < packagesIndent) continue;

    patterns.push(itemMatch[2].trim().replace(/^["']|["']$/g, ""));
  }

  return patterns;
}

/** Reads a YAML flow sequence such as `["apps/*", "{apps,packages}/*"]`. */
function parseFlowList(value: string): string[] {
  const inner = extractFlowSequence(value);
  if (inner === null) return [];

  const entries: string[] = [];
  let current = "";
  let quote: string | null = null;
  let depth = 0;

  for (const char of inner) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") depth--;

    if (char === "," && depth === 0) {
      entries.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  entries.push(current);

  return entries
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
    .filter((entry) => entry.length > 0);
}

/** Returns the contents of an inline `[...]`, or null when there is no array. */
function extractFlowSequence(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[")) return null;

  let quote: string | null = null;
  for (let i = 1; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "]") return trimmed.slice(1, i);
  }
  return trimmed.slice(1);
}

/** Resolves the workspace's package globs and the tool that owns the layout. */
export async function readWorkspacePatterns(
  root: string
): Promise<{ manager: WorkspaceManager; patterns: string[] }> {
  const patterns: string[] = [];
  const markers = { pnpm: false, lerna: false, nx: false };

  const pnpmWorkspacePath = join(root, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspacePath)) {
    markers.pnpm = true;
    const content = await readTextOrNull(pnpmWorkspacePath);
    if (content) patterns.push(...parsePnpmWorkspacePackages(content));
  }

  const rootPackageJson = await readJson<WorkspacePackageJson>(join(root, "package.json"));
  const declaredWorkspaces = readWorkspacesField(rootPackageJson);
  patterns.push(...declaredWorkspaces);

  const lernaPath = join(root, "lerna.json");
  if (existsSync(lernaPath)) {
    markers.lerna = true;
    const lerna = await readJson<{ packages?: string[] }>(lernaPath);
    if (lerna?.packages) patterns.push(...lerna.packages);
    else if (declaredWorkspaces.length === 0) patterns.push("packages/*");
  }

  if (existsSync(join(root, "nx.json"))) markers.nx = true;

  return {
    manager: pickManager(
      markers,
      rootPackageJson,
      declaredWorkspaces,
      existsSync(join(root, "yarn.lock"))
    ),
    patterns: dedupe(patterns)
  };
}

/** Dedicated monorepo tools win over a bare `package.json#workspaces` field. */
function pickManager(
  markers: { pnpm: boolean; lerna: boolean; nx: boolean },
  rootPackageJson: WorkspacePackageJson | null,
  declaredWorkspaces: string[],
  hasYarnLock: boolean
): WorkspaceManager {
  if (markers.pnpm) return "pnpm";
  if (markers.lerna) return "lerna";
  if (markers.nx) return "nx";
  if (declaredWorkspaces.length > 0) {
    if (rootPackageJson?.packageManager?.startsWith("yarn") || hasYarnLock) return "yarn";
    return "npm";
  }
  return "npm";
}

function dedupe(patterns: string[]): string[] {
  return Array.from(new Set(patterns));
}

/** Expands workspace globs into the packages that have a manifest. */
export async function listWorkspacePackages(
  root: string,
  patterns: string[],
  manager: WorkspaceManager = "npm"
): Promise<WorkspacePackage[]> {
  const dirs = new Set<string>();

  for (const dir of await expandPatterns(root, patterns)) dirs.add(dir);
  if (manager === "nx") {
    for (const dir of await discoverNxProjectDirs(root)) dirs.add(dir);
  }

  const packages: WorkspacePackage[] = [];
  for (const dir of Array.from(dirs).sort()) {
    const absDir = join(root, dir);
    const pkg = await readJson<WorkspacePackageJson>(join(absDir, "package.json"));
    const project =
      manager === "nx" ? await readJson<{ name?: string }>(join(absDir, "project.json")) : null;
    if (!pkg && !project) continue;

    packages.push({
      name: pkg?.name ?? project?.name ?? null,
      dir,
      absDir,
      hasConfig: existsSync(join(absDir, "blockend.json"))
    });
  }

  return packages;
}

async function expandPatterns(root: string, patterns: string[]): Promise<string[]> {
  if (patterns.length === 0) return [];

  try {
    const dirs = await glob(patterns, {
      cwd: root,
      onlyDirectories: true,
      ignore: ["**/node_modules/**", "**/.git/**"]
    });
    return dirs.map(normalizeDir).filter((dir): dir is string => dir !== null);
  } catch {
    return [];
  }
}

/** Integrated Nx projects are declared by a `project.json`, not a workspace glob. */
async function discoverNxProjectDirs(root: string): Promise<string[]> {
  try {
    const files = await glob("**/project.json", {
      cwd: root,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.nx/**"]
    });
    return files
      .map((file) => normalizeDir(dirname(file.replace(/\\/g, "/"))))
      .filter((dir): dir is string => dir !== null);
  } catch {
    return [];
  }
}

function normalizeDir(dir: string): string | null {
  const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized === "" || normalized === "." ? null : normalized;
}

/**
 * Detects whether `cwd` sits inside a workspace and enumerates its packages.
 * Returns null when no workspace marker is found on the path to the root.
 */
export async function detectWorkspace(cwd: string): Promise<WorkspaceContext | null> {
  const root = await findWorkspaceRoot(cwd);
  if (!root) return null;

  const { manager, patterns } = await readWorkspacePatterns(root);
  const packages = await listWorkspacePackages(root, patterns, manager);

  return { manager, root, patterns, packages };
}
