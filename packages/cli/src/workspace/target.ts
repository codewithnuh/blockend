import { dirname, join, resolve, sep } from "path";
import { select, isCancel } from "@clack/prompts";
import { findUp } from "../utils/find-up.js";
import { detectWorkspace } from "./detect.js";
import type { WorkspaceContext, WorkspacePackage } from "./types.js";

export type ProjectTarget =
  | { kind: "package"; rootDir: string; configPath: string; workspace: WorkspaceContext | null }
  | { kind: "needs-init"; rootDir: string; package: WorkspacePackage; workspace: WorkspaceContext }
  | { kind: "guidance"; message: string; workspace: WorkspaceContext }
  | { kind: "no-config" }
  | { kind: "cancelled" };

export interface ResolveTargetOptions {
  /** The command name, used in the workspace guidance message. */
  command: string;
  /** Whether an interactive package prompt may be shown. */
  interactive: boolean;
}

/**
 * Resolves which project (or workspace package) a command should operate on.
 * Inside a package it uses that package's config; at a workspace root it either
 * prompts for a package or returns guidance telling the user to pass `--cwd`.
 */
export async function resolveProjectTarget(
  cwd: string,
  options: ResolveTargetOptions
): Promise<ProjectTarget> {
  const workspace = await detectWorkspace(cwd);

  // Single project: the nearest config, searching upward, is the target.
  if (!workspace) {
    const configPath = await findUp("blockend.json", cwd);
    return configPath
      ? { kind: "package", rootDir: dirname(configPath), configPath, workspace: null }
      : { kind: "no-config" };
  }

  // In a workspace only a package's own config is valid, so an ancestor config
  // (including one above the workspace root) is never inherited.
  const currentPackage = findContainingPackage(workspace, cwd);
  if (currentPackage && resolve(currentPackage.absDir) !== resolve(workspace.root)) {
    return packageTarget(currentPackage, workspace);
  }

  if (workspace.packages.length === 1) {
    return packageTarget(workspace.packages[0], workspace);
  }

  if (options.interactive) {
    return promptForPackage(workspace);
  }

  return {
    kind: "guidance",
    message: formatWorkspaceGuidance(options.command, workspace),
    workspace
  };
}

function packageTarget(pkg: WorkspacePackage, workspace: WorkspaceContext): ProjectTarget {
  if (pkg.hasConfig) {
    return {
      kind: "package",
      rootDir: pkg.absDir,
      configPath: join(pkg.absDir, "blockend.json"),
      workspace
    };
  }
  return { kind: "needs-init", rootDir: pkg.absDir, package: pkg, workspace };
}

/** Deepest workspace package whose directory contains (or equals) `cwd`. */
function findContainingPackage(workspace: WorkspaceContext, cwd: string): WorkspacePackage | null {
  const target = resolve(cwd);
  let best: WorkspacePackage | null = null;

  for (const pkg of workspace.packages) {
    const absDir = resolve(pkg.absDir);
    if (target === absDir || target.startsWith(absDir + sep)) {
      if (!best || absDir.length > resolve(best.absDir).length) best = pkg;
    }
  }

  return best;
}

async function promptForPackage(workspace: WorkspaceContext): Promise<ProjectTarget> {
  const choice = await select({
    message: "Which workspace should this operate on?",
    options: workspace.packages.map((pkg) => ({
      value: pkg.dir,
      label: pkg.name ? `${pkg.dir} ${pkg.name}` : pkg.dir,
      hint: pkg.hasConfig ? undefined : "not initialized"
    }))
  });

  if (isCancel(choice)) return { kind: "cancelled" };

  const selected = workspace.packages.find((pkg) => pkg.dir === choice);
  return selected ? packageTarget(selected, workspace) : { kind: "cancelled" };
}

/** Guidance shown when a workspace target cannot be chosen interactively. */
export function formatWorkspaceGuidance(command: string, workspace: WorkspaceContext): string {
  const lines = [
    `It looks like you are running "${command}" from a monorepo root.`,
    "Install into a workspace with --cwd:",
    ""
  ];

  if (workspace.packages.length === 0) {
    lines.push("  (no workspace packages found)");
  } else {
    for (const pkg of workspace.packages) {
      lines.push(`  blockend ${command} -c ${pkg.dir}`);
    }
  }

  return lines.join("\n");
}

/** Human-readable reason a target could not be resolved, or null when it did. */
export function targetErrorMessage(target: ProjectTarget): string | null {
  switch (target.kind) {
    case "guidance":
      return target.message;
    case "needs-init":
      return `No blockend.json in ${target.package.dir}. Run 'npx blockend init' in that workspace first.`;
    case "no-config":
      return "blockend.json not found. Run 'npx blockend init' first.";
    default:
      return null;
  }
}
