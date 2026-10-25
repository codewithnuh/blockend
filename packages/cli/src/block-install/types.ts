// ─── registry types ──────────────────────────────────────────────────────────

import type {
  AdapterConfig as RegistryAdapterConfig,
  AssetMapping as RegistryAssetMapping,
  BlockManifest as RegistryBlockManifest,
  EnvironmentConfig as RegistryEnvironmentConfig,
  FrameworkName as RegistryFrameworkName,
  RegistryManifest as RegistryManifestType
} from "@blockend/registry";

export type AssetMapping = RegistryAssetMapping;
export type AdapterConfig = RegistryAdapterConfig;
export type EnvironmentConfig = RegistryEnvironmentConfig;
export type FrameworkName = RegistryFrameworkName;
export type BlockManifest = RegistryBlockManifest;
export type RegistryManifest = RegistryManifestType;

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
