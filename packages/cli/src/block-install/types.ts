// ─── registry types ──────────────────────────────────────────────────────────

export interface AssetMapping {
  /** Repo-relative path, e.g. "blocks/logger/core.ts". */
  source: string;
  /** Block-folder-relative path, e.g. "core.ts" or "tests/core.test.ts". */
  target: string;
}

export interface AdapterConfig {
  dependencies?: string[];
  devDependencies?: string[];
  files: string[] | AssetMapping[];
}

export interface EnvironmentConfig {
  core?: string;
  dependencies?: string[];
  devDependencies?: string[];
  variants: Record<string, AdapterConfig>;
}

export type FrameworkName = "express" | "fastify" | "hono" | "next";

export interface BlockManifest {
  name: string;
  description: string;
  version?: string;
  /**
   * Explicit framework support list.
   * - Named keys mean this block only appears for that environment.
   * - "*" means framework-agnostic.
   * - Omitting the field triggers legacy fallback: inspect adapter/environment keys.
   */
  frameworks?: Array<FrameworkName | "*">;
  /**
   * Top-level dependencies for adapter-free blocks. Merged with adapter-level
   * dependencies when an adapter context also exists.
   */
  dependencies?: string[];
  devDependencies?: string[];
  baseFiles?: AssetMapping[];
  adapters?: Record<string, EnvironmentConfig>;
  environments?: Record<string, EnvironmentConfig>;
}

export interface RegistryManifest {
  version?: string;
  blocks?: Record<string, BlockManifest>;
  [blockKey: string]: unknown;
}

// ─── registry source seam ────────────────────────────────────────────────────

export interface RegistrySource {
  fetchRegistry(): Promise<RegistryManifest>;
  fetchFile(sourcePath: string): Promise<string>;
}

// ─── project config types ────────────────────────────────────────────────────

export interface InstalledBlockRecord {
  name: string;
  version: string;
  installedAt: string;
  files: string[];
  contentHash: string;
  /** Storage variant selected at install time (e.g. "memory", "redis", "default"). */
  variant?: string;
}

export interface BlockendConfig {
  $schema: string;
  environment: FrameworkName | "none";
  language: "typescript" | "javascript";
  packageManager: string;
  importRewriteStrategy: "rewrite" | "remove";
  includeRedis: boolean;
  aliases: {
    blocks?: string;
  };
  paths: {
    blocks: string;
  };
  installed?: InstalledBlockRecord[];
}

// ─── planning / preview / apply results ─────────────────────────────────────

export interface PlanBlockOptions {
  /** Explicit variant. Takes precedence over the recorded variant. */
  variant?: string;
  /** Variant recorded in blockend.json for non-interactive commands. */
  recordedVariant?: string;
  /** When present, infer a variant from on-disk redis markers. */
  targetFolder?: string;
}

export interface BlockPlan {
  blockName: string;
  block: BlockManifest;
  environment: string;
  variant: string;
  variantKeys: string[];
  files: AssetMapping[];
  dependencies: string[];
  devDependencies: string[];
}

export type BlockPlanErrorCode =
  | "not-found"
  | "unsupported-environment"
  | "no-adapter"
  | "no-variants";

export interface BlockPlanError {
  code: BlockPlanErrorCode;
  blockName: string;
  environment: string;
  message: string;
}

export type BlockPlanResult = { ok: true; plan: BlockPlan } | { ok: false; error: BlockPlanError };

export interface AvailableBlock {
  name: string;
  description: string;
  variants: string[];
}

export interface PreviewFile {
  name: string;
  sourcePath: string;
  targetPath: string;
  existingContent: string | null;
  newContent: string;
  status: "new" | "modified" | "unchanged";
}

export interface PreviewBlockOptions {
  source: RegistrySource;
  targetFolder: string;
  /**
   * Diff treats download failures as errors. Update preserves its historical
   * behaviour of treating a failed remote read as empty content.
   */
  onDownloadError?: "throw" | "empty";
}

export interface ApplyBlockOptions {
  source: RegistrySource;
  /** Absolute path to the directory that contains block folders. */
  blocksRoot: string;
  aliasBase?: string;
  rewriteStrategy: "rewrite" | "remove";
  /** Absolute path to blockend.json. */
  configPath: string;
}

export interface AppliedBlock {
  block: string;
  variant: string;
  files: string[];
  record: InstalledBlockRecord;
}
