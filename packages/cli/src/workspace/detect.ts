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
 * read, so this stays a focused parser rather than a general YAML reader.
 */
export function parsePnpmWorkspacePackages(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  let packagesIndent = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const keyMatch = line.match(/^(\s*)([A-Za-z0-9_-]+)\s*:/);
    if (keyMatch) {
      packagesIndent = keyMatch[1].length;
      inPackages = keyMatch[2] === "packages";
      continue;
    }

    if (!inPackages) continue;

    const itemMatch = line.match(/^(\s*)-\s*(.+?)\s*(?:#.*)?$/);
    if (!itemMatch || itemMatch[1].length <= packagesIndent) continue;

    patterns.push(itemMatch[2].trim().replace(/^["']|["']$/g, ""));
  }

  return patterns;
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
    patterns.push(...(lerna?.packages ?? ["packages/*"]));
  }

  if (existsSync(join(root, "nx.json"))) markers.nx = true;

  return {
    manager: pickManager(markers, rootPackageJson, declaredWorkspaces),
    patterns: dedupe(patterns)
  };
}

/** Dedicated monorepo tools win over a bare `package.json#workspaces` field. */
function pickManager(
  markers: { pnpm: boolean; lerna: boolean; nx: boolean },
  rootPackageJson: WorkspacePackageJson | null,
  declaredWorkspaces: string[]
): WorkspaceManager {
  if (markers.pnpm) return "pnpm";
  if (markers.lerna) return "lerna";
  if (markers.nx) return "nx";
  if (declaredWorkspaces.length > 0) {
    return rootPackageJson?.packageManager?.startsWith("yarn") ? "yarn" : "npm";
  }
  return "npm";
}

function dedupe(patterns: string[]): string[] {
  return Array.from(new Set(patterns));
}

/** Expands workspace globs into the packages that have a package.json. */
export async function listWorkspacePackages(
  root: string,
  patterns: string[]
): Promise<WorkspacePackage[]> {
  if (patterns.length === 0) return [];

  let dirs: string[];
  try {
    dirs = await glob(patterns, {
      cwd: root,
      onlyDirectories: true,
      ignore: ["**/node_modules/**", "**/.git/**"]
    });
  } catch {
    return [];
  }

  const packages: WorkspacePackage[] = [];
  for (const dir of dirs.sort()) {
    const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    const absDir = join(root, normalized);
    if (!existsSync(join(absDir, "package.json"))) continue;

    const pkg = await readJson<WorkspacePackageJson>(join(absDir, "package.json"));
    packages.push({
      name: pkg?.name ?? null,
      dir: normalized,
      absDir,
      hasConfig: existsSync(join(absDir, "blockend.json"))
    });
  }

  return packages;
}

/**
 * Detects whether `cwd` sits inside a workspace and enumerates its packages.
 * Returns null when no workspace marker is found on the path to the root.
 */
export async function detectWorkspace(cwd: string): Promise<WorkspaceContext | null> {
  const root = await findWorkspaceRoot(cwd);
  if (!root) return null;

  const { manager, patterns } = await readWorkspacePatterns(root);
  const packages = await listWorkspacePackages(root, patterns);

  return { manager, root, patterns, packages };
}
