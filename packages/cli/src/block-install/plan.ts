import path from "path";
import type {
  AssetMapping,
  AvailableBlock,
  BlockManifest,
  BlockPlan,
  BlockPlanError,
  BlockPlanErrorCode,
  BlockPlanResult,
  EnvironmentConfig,
  FrameworkName,
  PlanBlockOptions,
  RegistryManifest
} from "./types.js";
import { getBlockMap } from "./registry.js";
import { resolvePreferredVariant, selectVariant } from "./variants.js";

function blockSupportsEnv(block: BlockManifest, environment: string): boolean {
  if (block.frameworks && block.frameworks.length > 0) {
    return (
      block.frameworks.includes("*") || block.frameworks.includes(environment as FrameworkName)
    );
  }
  return (
    block.adapters?.[environment] !== undefined || block.environments?.[environment] !== undefined
  );
}

function resolveAdapterContext(
  block: BlockManifest,
  environment: string
): EnvironmentConfig | null {
  return (
    block.adapters?.[environment] ??
    block.adapters?.["*"] ??
    block.environments?.[environment] ??
    block.environments?.["*"] ??
    null
  );
}

function normalizeFiles(files: Array<string | AssetMapping> | undefined): AssetMapping[] {
  if (!files) return [];
  return files.map((entry) =>
    typeof entry === "string" ? { source: entry, target: path.basename(entry) } : entry
  );
}

function planError(
  code: BlockPlanErrorCode,
  blockName: string,
  environment: string
): BlockPlanError {
  if (code === "not-found") {
    return {
      code,
      blockName,
      environment,
      message: `Block "${blockName}" not found in the registry.`
    };
  }

  if (code === "unsupported-environment") {
    return {
      code,
      blockName,
      environment,
      message: `Block "${blockName}" does not support environment: ${environment}`
    };
  }

  if (code === "no-adapter") {
    return {
      code,
      blockName,
      environment,
      message:
        `Block "${blockName}" has no adapter or environment entry for: ${environment}. ` +
        `This is a registry configuration issue — please open an issue.`
    };
  }

  return {
    code,
    blockName,
    environment,
    message: `No variants found for "${blockName}" / "${environment}".`
  };
}

/**
 * Resolve a block + environment into one concrete install plan.
 * This is the single decision point for support checks, variant selection,
 * file composition, and dependency composition.
 */
export async function planBlock(
  registry: RegistryManifest,
  blockName: string,
  environment: string,
  options: PlanBlockOptions = {}
): Promise<BlockPlanResult> {
  const block = getBlockMap(registry)[blockName];
  if (!block) {
    return { ok: false, error: planError("not-found", blockName, environment) };
  }

  if (!blockSupportsEnv(block, environment)) {
    return { ok: false, error: planError("unsupported-environment", blockName, environment) };
  }

  const adapterContext = resolveAdapterContext(block, environment);
  if (!adapterContext) {
    return { ok: false, error: planError("no-adapter", blockName, environment) };
  }

  const variantKeys = Object.keys(adapterContext.variants ?? {});
  if (variantKeys.length === 0) {
    return { ok: false, error: planError("no-variants", blockName, environment) };
  }

  let preferred = options.variant ?? options.recordedVariant;
  if (options.targetFolder && (!preferred || !variantKeys.includes(preferred))) {
    preferred =
      (await resolvePreferredVariant(variantKeys, preferred, options.targetFolder)) ?? preferred;
  }

  const selectedVariant = selectVariant(variantKeys, preferred);
  const variantMeta = adapterContext.variants[selectedVariant];

  const files: AssetMapping[] = [];
  if (block.baseFiles?.length) files.push(...block.baseFiles);
  if (adapterContext.core) {
    files.push({ source: adapterContext.core, target: path.basename(adapterContext.core) });
  }
  files.push(...normalizeFiles(variantMeta?.files));

  const plan: BlockPlan = {
    blockName,
    block,
    environment,
    variant: selectedVariant,
    variantKeys,
    files,
    dependencies: [
      ...(block.dependencies ?? []),
      ...(adapterContext.dependencies ?? []),
      ...(variantMeta?.dependencies ?? [])
    ],
    devDependencies: [
      ...(block.devDependencies ?? []),
      ...(adapterContext.devDependencies ?? []),
      ...(variantMeta?.devDependencies ?? [])
    ]
  };

  return { ok: true, plan };
}

/**
 * Blocks that can actually produce a plan for this environment.
 * A block is not advertised if its registry metadata promises support but no
 * adapter/environment entry exists to resolve.
 */
export async function listAvailableBlocks(
  registry: RegistryManifest,
  environment: string
): Promise<AvailableBlock[]> {
  const available: AvailableBlock[] = [];

  for (const [name, block] of Object.entries(getBlockMap(registry))) {
    if (!block) continue;
    const result = await planBlock(registry, name, environment);
    if (!result.ok) continue;

    available.push({
      name,
      description: block.description,
      variants: result.plan.variantKeys
    });
  }

  return available;
}
