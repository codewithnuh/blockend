/** The workspace tool that owns the monorepo layout. */
export type WorkspaceManager = "pnpm" | "npm" | "yarn" | "lerna" | "nx";

/** A workspace package discovered from the layout's globs. */
export interface WorkspacePackage {
  /** Package name from its package.json, when present. */
  name: string | null;
  /** Workspace-root-relative POSIX directory, e.g. "apps/api". */
  dir: string;
  /** Absolute directory path. */
  absDir: string;
  /** Whether the package already has its own blockend.json. */
  hasConfig: boolean;
}

/** The detected monorepo: its manager, root, patterns, and packages. */
export interface WorkspaceContext {
  manager: WorkspaceManager;
  /** Absolute monorepo root (where the workspace marker lives). */
  root: string;
  /** Glob patterns from pnpm-workspace.yaml / package.json#workspaces. */
  patterns: string[];
  packages: WorkspacePackage[];
}
