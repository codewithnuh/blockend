/* oxlint-disable no-console */
import path, { dirname, join } from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { intro, outro, select, multiselect, spinner, confirm, isCancel, log } from "@clack/prompts";
import pc from "picocolors";
import {
  applyBlock,
  createGitHubRegistrySource,
  findUp,
  getMissingDependencies,
  getVersionConflicts,
  listAvailableBlocks,
  loadRegistry,
  planBlock,
  type BlockPlan,
  type BlockPlanErrorCode,
  type BlockendConfig,
  type RegistryManifest,
  type RegistrySource
} from "../block-install/index.js";

// ─── types ───────────────────────────────────────────────────────────────────

interface BlockendExtendedConfig extends BlockendConfig {
  redisEnabled?: boolean;
}

interface LocalPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface AddContext {
  registry: RegistryManifest;
  source: RegistrySource;
  config: BlockendExtendedConfig;
  configPath: string;
  rootDir: string;
  physicalBlocksPath: string;
  blocksRootAbsolute: string;
  aliasBase: string | undefined;
  envKey: string;
  rewriteStrategy: "rewrite" | "remove";
  options: { yes?: boolean; json?: boolean };
}

// ─── output helpers ──────────────────────────────────────────────────────────

function outputError(json: boolean, message: string): void {
  if (json) {
    process.stdout.write(JSON.stringify({ success: false, error: message }) + "\n");
  } else {
    log.error(message);
  }
}

function outputResult(
  json: boolean,
  result: {
    success: boolean;
    block?: string;
    filesWritten?: string[];
    dependenciesInstalled?: string[];
    reason?: string;
    message?: string;
  }
): void {
  if (json) {
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    outro(result.success ? pc.green(`✨ ${result.message}`) : pc.yellow(`ℹ ${result.message}`));
  }
}

function handleCancel(value: unknown): void {
  if (isCancel(value)) {
    outro(pc.dim("Operation cancelled."));
    process.exit(0);
  }
}

function failureMessage(code: BlockPlanErrorCode, blockName: string): string {
  if (code === "not-found") return `Block "${blockName}" not found`;
  if (code === "unsupported-environment") return `Block "${blockName}" incompatible`;
  if (code === "no-adapter") return `No adapter for "${blockName}"`;
  return `No variants for "${blockName}"`;
}

// ─── add command ─────────────────────────────────────────────────────────────

/**
 * Add a single block to the project.
 * Extracted so it can be called once per block in multi-select mode.
 */
async function addSingleBlock(
  targetBlock: string,
  context: AddContext
): Promise<{ success: boolean; filesWritten: string[]; message: string }> {
  const { yes = false, json = false } = context.options;
  const {
    registry,
    source,
    config,
    configPath,
    rootDir,
    physicalBlocksPath,
    blocksRootAbsolute,
    aliasBase,
    envKey,
    rewriteStrategy
  } = context;
  const s = spinner();

  const initialPlan = await planBlock(registry, targetBlock, envKey);
  if (!initialPlan.ok) {
    outputError(json, initialPlan.error.message);
    return {
      success: false,
      filesWritten: [],
      message: failureMessage(initialPlan.error.code, targetBlock)
    };
  }

  // ── Variant selection ───────────────────────────────────────────────────

  const variantKeys = initialPlan.plan.variantKeys;
  let selectedVariant: string;

  if (yes) {
    selectedVariant = variantKeys.includes("memory") ? "memory" : variantKeys[0];
  } else if (variantKeys.includes("redis") && (config.redisEnabled || config.includeRedis)) {
    selectedVariant = "redis";
  } else if (variantKeys.length === 1) {
    selectedVariant = variantKeys[0];
  } else {
    const variantPrompt = await select({
      message: `Select a storage variant for ${targetBlock}:`,
      options: variantKeys.map((variant) => ({ value: variant, label: variant.toUpperCase() }))
    });
    handleCancel(variantPrompt);
    selectedVariant = variantPrompt as string;
  }

  let plan: BlockPlan = initialPlan.plan;
  if (selectedVariant !== initialPlan.plan.variant) {
    const selectedPlan = await planBlock(registry, targetBlock, envKey, {
      variant: selectedVariant
    });
    if (!selectedPlan.ok) {
      outputError(json, selectedPlan.error.message);
      return {
        success: false,
        filesWritten: [],
        message: failureMessage(selectedPlan.error.code, targetBlock)
      };
    }
    plan = selectedPlan.plan;
  }

  const targetFolder = path.resolve(blocksRootAbsolute, targetBlock);

  // ── Dependency management ───────────────────────────────────────────────

  const packageJsonPath = await findUp("package.json", rootDir);
  if (!packageJsonPath) {
    outputError(json, "Could not locate package.json.");
    return { success: false, filesWritten: [], message: "package.json not found" };
  }
  const packageJsonDir = dirname(packageJsonPath);

  let packageJson: LocalPackageJson;
  try {
    packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8")) as LocalPackageJson;
  } catch (err) {
    outputError(json, "Failed to parse package.json.");
    if (!json) log.error(pc.dim(String(err)));
    return { success: false, filesWritten: [], message: "Failed to parse package.json" };
  }

  const installedDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {})
  };

  const missingProd = getMissingDependencies(plan.dependencies, installedDeps, true);
  const missingDev = getMissingDependencies(plan.devDependencies, installedDeps, true);

  // ── Version conflict detection ───────────────────────────────────────

  const prodConflicts = getVersionConflicts(plan.dependencies, installedDeps);
  const devConflicts = getVersionConflicts(plan.devDependencies, installedDeps);
  const allConflicts = [...prodConflicts, ...devConflicts];

  if (allConflicts.length > 0 && !json) {
    log.warn(`Version conflicts detected:`);
    for (const conflict of allConflicts) {
      log.warn(`  ${pc.yellow("!")} ${conflict}`);
    }
  }

  if (missingProd.length > 0 || missingDev.length > 0) {
    if (!json) log.warn(`Missing: ${pc.cyan([...missingProd, ...missingDev].join(", "))}`);

    const shouldInstall = yes
      ? true
      : await confirm({
          message: `Install missing dependencies for ${targetBlock}?`,
          initialValue: true
        });
    if (!yes) handleCancel(shouldInstall);

    if (shouldInstall) {
      const pm = config.packageManager || "npm";

      if (!json) s.start(`Installing via ${pm}...`);

      const tasks: string[] = [];
      if (missingProd.length > 0) {
        tasks.push(
          pm === "pnpm"
            ? `pnpm add ${missingProd.join(" ")}`
            : `npm install ${missingProd.join(" ")}`
        );
      }
      if (missingDev.length > 0) {
        tasks.push(
          pm === "pnpm"
            ? `pnpm add -D ${missingDev.join(" ")}`
            : `npm install --save-dev ${missingDev.join(" ")}`
        );
      }

      try {
        for (const cmd of tasks) {
          if (!json) s.message(`Running: ${cmd}`);
          await new Promise<void>((resolve, reject) => {
            const child = exec(cmd, { cwd: packageJsonDir });
            child.stdout?.on("data", (d: string) => {
              if (!json) process.stdout.write(pc.dim(d));
            });
            child.stderr?.on("data", (d: string) => {
              if (!json) process.stdout.write(pc.dim(pc.red(d)));
            });
            child.on("close", (code) =>
              code === 0 ? resolve() : reject(new Error(`Exit ${code}`))
            );
          });
        }
        if (!json) s.stop("Dependencies installed.");
      } catch (err) {
        if (!json) {
          s.stop("Installation failed.");
          log.error(pc.dim(String(err)));
        } else outputError(json, "Dependency installation failed.");
        return { success: false, filesWritten: [], message: "Dependency installation failed" };
      }
    }
  }

  // ── Conflict check ──────────────────────────────────────────────────────

  let hasConflict = false;
  for (const file of plan.files) {
    try {
      await fs.access(join(targetFolder, file.target));
      hasConflict = true;
      break;
    } catch {
      /* no conflict */
    }
  }

  if (hasConflict) {
    const overwrite = yes
      ? true
      : await confirm({
          message: `Files for "${targetBlock}" already exist. Overwrite?`,
          initialValue: false
        });
    if (!yes) handleCancel(overwrite);
    if (!overwrite) {
      return { success: false, filesWritten: [], message: "Local files preserved." };
    }
  }

  // ── Download, rewrite, write, and record ────────────────────────────────

  if (!json) s.start(`Downloading ${targetBlock}...`);

  try {
    const applied = await applyBlock(plan, {
      source,
      blocksRoot: blocksRootAbsolute,
      aliasBase,
      rewriteStrategy,
      configPath
    });

    if (!json) s.stop("Files written.");
    return {
      success: true,
      filesWritten: applied.files,
      message: `${targetBlock} added to ${physicalBlocksPath}/${targetBlock}`
    };
  } catch (err) {
    if (!json) {
      s.stop("Failed.");
      log.error(pc.dim(String(err)));
    } else outputError(json, "Fatal error while writing block files.");
    return { success: false, filesWritten: [], message: `Failed to add ${targetBlock}` };
  }
}

// ─── main add entry point ───────────────────────────────────────────────────

export async function addCommand(
  blockName: string | undefined,
  options: { yes?: boolean; json?: boolean; multi?: boolean } = {}
): Promise<void> {
  const { yes = false, json = false, multi = false } = options;

  if (!json) {
    console.log("");
    intro(`${pc.bgCyan(pc.black(" blockend "))} ${pc.dim("add")}`);
  }

  const cwd = process.cwd();

  // ── Read blockend.json ──────────────────────────────────────────────────

  const configPath = await findUp("blockend.json", cwd);
  if (!configPath) {
    outputError(json, "blockend.json not found. Run 'npx blockend init' first.");
    return;
  }

  const rootDir = dirname(configPath);

  let config: BlockendExtendedConfig;
  try {
    config = JSON.parse(await fs.readFile(configPath, "utf-8")) as BlockendExtendedConfig;
  } catch (err) {
    outputError(json, "Failed to parse blockend.json.");
    if (!json) log.error(pc.dim(String(err)));
    return;
  }

  if (config.language !== "typescript") {
    outputError(json, "Blockend currently only supports TypeScript projects.");
    return;
  }

  const physicalBlocksPath = config.paths.blocks;
  const blocksRootAbsolute = path.resolve(rootDir, physicalBlocksPath);
  const aliasBase = config.aliases.blocks;
  const envKey = config.environment;

  // Default fallback to "remove" strategy if not explicitly declared in an older json file
  const rewriteStrategy = config.importRewriteStrategy ?? "remove";

  // ── Fetch registry ──────────────────────────────────────────────────────

  const source = createGitHubRegistrySource();
  const s = spinner();
  if (!json) s.start("Fetching registry...");

  let registry: RegistryManifest;
  try {
    registry = await loadRegistry(source);
    if (!json) s.stop("Registry synced.");
  } catch (err) {
    if (!json) {
      s.stop("Failed to fetch registry.");
      log.error(pc.dim(String(err)));
    } else outputError(json, "Failed to fetch registry from GitHub.");
    return;
  }

  const context: AddContext = {
    registry,
    source,
    config,
    configPath,
    rootDir,
    physicalBlocksPath,
    blocksRootAbsolute,
    aliasBase,
    envKey,
    rewriteStrategy,
    options
  };

  // ── Block selection ─────────────────────────────────────────────────────

  if (yes && !blockName) {
    outputError(json, "Block name required with --yes. Usage: blockend add <block> --yes");
    return;
  }

  // ── Multi-select mode ───────────────────────────────────────────────────

  if (multi && !blockName) {
    const available = await listAvailableBlocks(registry, envKey);

    if (available.length === 0) {
      outputError(json, `No blocks available for environment: ${envKey}`);
      if (!json) outro(pc.dim("Exiting."));
      return;
    }

    const maxKeyLen = Math.max(...available.map((block) => block.name.length), 0);
    const multiSelectPrompt = await multiselect({
      message: "Select blocks to add (space to select, enter to confirm):",
      options: available.map((block, i) => ({
        value: block.name,
        label: `${pc.dim(`${i + 1}.`)} ${pc.bold(
          pc.cyan(block.name.padEnd(maxKeyLen + 4))
        )}${pc.dim(
          block.description.length > 60 ? `${block.description.slice(0, 60)}...` : block.description
        )}`
      }))
    });
    handleCancel(multiSelectPrompt);
    const selectedBlocks = multiSelectPrompt as string[];

    if (selectedBlocks.length === 0) {
      outputError(json, "No blocks selected.");
      return;
    }

    // Process each selected block sequentially
    if (!json) log.info(`\nAdding ${selectedBlocks.length} block(s)...\n`);

    const results: string[] = [];
    for (const block of selectedBlocks) {
      const result = await addSingleBlock(block, context);
      if (result.success) {
        results.push(result.message);
      }
    }

    if (json) {
      process.stdout.write(JSON.stringify({ success: true, blocks: results }) + "\n");
    } else {
      outro(pc.green(`\n✨ Added ${results.length} block(s) successfully!`));
    }
    return;
  }

  // ── Single block mode ───────────────────────────────────────────────────

  let targetBlock = blockName;

  if (!targetBlock) {
    const available = await listAvailableBlocks(registry, envKey);

    if (available.length === 0) {
      outputError(json, `No blocks available for environment: ${envKey}`);
      if (!json) outro(pc.dim("Exiting."));
      return;
    }

    const maxKeyLen = Math.max(...available.map((block) => block.name.length), 0);
    const selectPrompt = await select({
      message: "Which block would you like to add?",
      options: available.map((block, i) => ({
        value: block.name,
        label: `${pc.dim(`${i + 1}.`)} ${pc.bold(
          pc.cyan(block.name.padEnd(maxKeyLen + 4))
        )}${pc.dim(
          block.description.length > 60 ? `${block.description.slice(0, 60)}...` : block.description
        )}`
      }))
    });
    handleCancel(selectPrompt);
    targetBlock = selectPrompt as string;
  }

  const result = await addSingleBlock(targetBlock!, context);

  outputResult(json, {
    success: result.success,
    block: targetBlock,
    filesWritten: result.filesWritten,
    message: result.message
  });
}
