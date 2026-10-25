/**
 * Block install — the single interface for reading the registry, planning a
 * block install, previewing it, and applying it.
 *
 * Commands are adapters over this module. They own prompts, spinners, JSON
 * output, and package-manager execution; this module owns the block behaviour.
 */

export type {
  AdapterConfig,
  AppliedBlock,
  ApplyBlockOptions,
  AssetMapping,
  AvailableBlock,
  BlockPlan,
  BlockPlanError,
  BlockPlanErrorCode,
  BlockPlanResult,
  BlockManifest,
  BlockendConfig,
  EnvironmentConfig,
  FrameworkName,
  InstalledBlockRecord,
  PlanBlockOptions,
  PreviewBlockOptions,
  PreviewFile,
  RegistryManifest,
  RegistrySource
} from "./types.js";

export {
  createGitHubRegistrySource,
  createStaticRegistrySource,
  loadRegistry,
  type GitHubRegistrySourceOptions
} from "./registry.js";

export { listAvailableBlocks, planBlock } from "./plan.js";
export { previewBlock } from "./preview.js";
export { applyBlock } from "./apply.js";
export { findUp } from "./config.js";
export { resolvePreferredVariant, selectVariant } from "./variants.js";
export {
  getMissingDependencies,
  getVersionConflicts,
  parseDepSpec,
  semverSatisfies
} from "./deps.js";
export { rewriteFileImports } from "./imports.js";
