/* eslint-disable no-console */
import path, { join, dirname } from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { intro, outro, select, spinner, confirm, isCancel, log } from "@clack/prompts";
import pc from "picocolors";
import { configPayloadType } from "./init.js";

interface BlockendExtendedConfig extends configPayloadType {
  redisEnabled?: boolean;
}

interface LocalPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const REPO_OWNER = "codewithnuh";
const REPO_NAME = "blockend";
const BRANCH = "master";

const RAW_CDN_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;
const MANIFEST_URL = `${RAW_CDN_BASE}/registry/index.json`;

export interface AssetMapping {
  source: string;
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
  variants: {
    [variantKey: string]: AdapterConfig;
  };
}

export interface BlockManifest {
  name: string;
  description: string;
  baseFiles?: AssetMapping[];
  adapters?: {
    [adapterKey: string]: EnvironmentConfig;
  };
  environments?: {
    [envKey: string]: EnvironmentConfig;
  };
}

export interface RegistryManifest {
  version?: string;
  blocks?: Record<string, BlockManifest>;
  [blockKey: string]: unknown;
}

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
    if (result.success) {
      outro(pc.green(`✨ ${result.message}`));
    } else {
      outro(pc.yellow(`ℹ ${result.message}`));
    }
  }
}

function handleCancel(value: unknown): void {
  if (isCancel(value)) {
    outro(pc.dim("Operation cancelled."));
    process.exit(0);
  }
}

async function findUp(filename: string, startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    const checkPath = join(dir, filename);
    try {
      await fs.access(checkPath);
      return checkPath;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

export async function addCommand(
  blockName: string | undefined,
  options: {
    yes?: boolean;
    json?: boolean;
  } = {}
): Promise<void> {
  const { yes = false, json = false } = options;

  if (!json) {
    console.log(""); // Empty line for breathing room
    intro(`${pc.bgCyan(pc.black(" blockend "))} ${pc.dim("add")}`);
  }
  const cwd = process.cwd();

  const configPath = await findUp("blockend.json", cwd);
  if (!configPath) {
    outputError(json, "blockend.json not found. Run 'npx blockend init' first.");
    return;
  }
  const rootDir = dirname(configPath);

  let config: BlockendExtendedConfig;
  try {
    const configFile = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(configFile) as BlockendExtendedConfig;
  } catch (error) {
    outputError(json, "Failed to parse blockend.json.");
    if (!json) log.error(pc.dim(String(error)));
    return;
  }

  if (config.language !== "typescript") {
    if (json) {
      outputError(json, "Registry exclusively supports TypeScript projects.");
    } else {
      log.warn("Blockend currently only supports TypeScript projects.");
      outro(pc.dim("Exiting."));
    }
    return;
  }

  const s = spinner();
  if (!json) {
    s.start("Fetching registry...");
  }

  let registry: RegistryManifest;
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
    registry = (await response.json()) as RegistryManifest;
    if (!json) s.stop("Registry synced.");
  } catch (error) {
    if (!json) {
      s.stop("Failed to fetch registry.");
      log.error(pc.dim(String(error)));
    } else {
      outputError(json, "Failed to fetch the component registry from GitHub.");
    }
    return;
  }

  let blockMap: Record<string, BlockManifest> = {};
  if (registry.blocks && typeof registry.blocks === "object" && !Array.isArray(registry.blocks)) {
    blockMap = registry.blocks as Record<string, BlockManifest>;
  } else {
    blockMap = registry as Record<string, BlockManifest>;
  }

  const envKey = String(config.environment);

  let targetBlock = blockName;

  if (yes && !targetBlock) {
    outputError(
      json,
      "Block name required when using --yes flag. Usage: blockend add <block> --yes"
    );
    return;
  }

  if (!targetBlock) {
    const filteredBlocks = Object.entries(blockMap).filter(([_, block]) => {
      if (!block) return false;
      const hasAdapter = block.adapters?.[envKey] !== undefined;
      const hasEnvironment = block.environments?.[envKey] !== undefined;
      return hasAdapter || hasEnvironment;
    });

    if (filteredBlocks.length === 0) {
      const msg = `No backend blocks are currently available for: ${envKey}.`;
      if (json) {
        outputError(json, msg);
      } else {
        log.warn(msg);
        outro(pc.dim("Exiting."));
      }
      return;
    }

    // Dynamic padding calculations for beautiful columnar alignment
    const maxKeyLength = Math.max(...filteredBlocks.map(([key]) => key.length), 0);

    const availableOptions = filteredBlocks.map(([key, block], index) => {
      // Align descriptions on a matching vertical column line
      const paddedKey = key.padEnd(maxKeyLength + 4, " ");

      // Limit description length to protect standard terminal viewport sizes
      const maxDescWidth = 60;
      const optimizedDescription =
        block.description.length > maxDescWidth
          ? `${block.description.slice(0, maxDescWidth)}...`
          : block.description;

      return {
        value: key,
        label: `${pc.dim(`${index + 1}.`)} ${pc.bold(pc.cyan(paddedKey))}${pc.dim(optimizedDescription)}`
      };
    });

    const selectBlockPrompt = await select({
      message: "Which block would you like to add?",
      options: availableOptions
    });
    handleCancel(selectBlockPrompt);
    targetBlock = selectBlockPrompt as string;
  }

  const blockMeta = blockMap[targetBlock];
  if (!blockMeta) {
    outputError(json, `Block "${targetBlock}" does not exist in the registry.`);
    return;
  }

  const adapterContext = blockMeta.adapters?.[envKey] ?? blockMeta.environments?.[envKey];
  if (!adapterContext) {
    outputError(json, `The block "${targetBlock}" does not support your environment: ${envKey}`);
    return;
  }

  let selectedVariant: string;
  const variantKeys = Object.keys(adapterContext.variants || {});

  if (variantKeys.length === 0) {
    outputError(json, `No storage variants found for block environment: ${envKey}`);
    return;
  }

  if (yes) {
    selectedVariant = variantKeys.includes("memory") ? "memory" : variantKeys[0];
  } else if (variantKeys.includes("redis") && config.redisEnabled) {
    selectedVariant = "redis";
  } else if (variantKeys.length === 1) {
    selectedVariant = variantKeys[0];
  } else {
    const selectVariantPrompt = await select({
      message: "Select a storage variant:",
      options: variantKeys.map((vKey) => ({
        value: vKey,
        label: vKey.toUpperCase()
      }))
    });
    handleCancel(selectVariantPrompt);
    selectedVariant = selectVariantPrompt as string;
  }

  const variantMeta = adapterContext.variants[selectedVariant];

  let physicalPath = config.paths.blocks;
  if (physicalPath.startsWith("@")) {
    physicalPath = "./src/blocks";
  }
  const targetFolder = path.resolve(rootDir, physicalPath, targetBlock);

  const packageJsonPath = await findUp("package.json", rootDir);
  if (!packageJsonPath) {
    outputError(json, "Could not locate package.json in your current directory.");
    return;
  }
  const packageJsonDir = dirname(packageJsonPath);

  let packageJson: LocalPackageJson;
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    packageJson = JSON.parse(packageJsonContent) as LocalPackageJson;
  } catch (error) {
    outputError(json, "Failed parsing package.json.");
    if (!json) log.error(pc.dim(String(error)));
    return;
  }

  const installedDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {})
  };

  const missingProdDeps = (adapterContext.dependencies ?? [])
    .concat(variantMeta?.dependencies ?? [])
    .filter((dep) => !(dep in installedDeps));

  const missingDevDeps = (adapterContext.devDependencies ?? [])
    .concat(variantMeta?.devDependencies ?? [])
    .filter((dep) => !(dep in installedDeps));

  const hasMissingDeps = missingProdDeps.length > 0 || missingDevDeps.length > 0;

  if (hasMissingDeps) {
    const allMissingNames = [...missingProdDeps, ...missingDevDeps];
    if (!json) {
      log.warn(`Missing dependencies: ${pc.cyan(allMissingNames.join(", "))}`);
    }

    const shouldInstallPrompt = yes
      ? true
      : await confirm({
          message: "Install missing dependencies?",
          initialValue: true
        });
    if (!yes) handleCancel(shouldInstallPrompt);

    if (shouldInstallPrompt) {
      const packageManager = await fs
        .access(join(packageJsonDir, "pnpm-lock.yaml"))
        .then(() => "pnpm")
        .catch(() => "npm");

      if (!json) s.start(`Installing via ${packageManager}...`);
      try {
        const installTasks: string[] = [];

        if (missingProdDeps.length > 0) {
          installTasks.push(
            packageManager === "pnpm"
              ? `pnpm add ${missingProdDeps.join(" ")}`
              : `npm install ${missingProdDeps.join(" ")}`
          );
        }

        if (missingDevDeps.length > 0) {
          installTasks.push(
            packageManager === "pnpm"
              ? `pnpm add -D ${missingDevDeps.join(" ")}`
              : `npm install --save-dev ${missingDevDeps.join(" ")}`
          );
        }

        for (const installCmd of installTasks) {
          if (!json) s.message(`Executing: ${installCmd}`);

          await new Promise<void>((resolve, reject) => {
            const child = exec(installCmd, { cwd: packageJsonDir });
            child.stdout?.on("data", (data: string) => {
              if (!json) process.stdout.write(pc.dim(data));
            });
            child.stderr?.on("data", (data: string) => {
              if (!json) process.stdout.write(pc.dim(pc.red(data)));
            });
            child.on("close", (code) =>
              code === 0 ? resolve() : reject(new Error(`Exit code ${code}`))
            );
          });
        }

        if (!json) {
          s.stop("Dependencies installed.");
        }
      } catch (error) {
        if (!json) {
          s.stop("Installation failed.");
          log.error(pc.dim(String(error)));
        } else {
          outputError(json, "Automated dependency installation failed.");
        }
        return;
      }
    }
  }

  const filesToDownload: AssetMapping[] = [];

  if (blockMeta.baseFiles) {
    filesToDownload.push(...blockMeta.baseFiles);
  }

  if (adapterContext.core) {
    filesToDownload.push({
      source: adapterContext.core,
      target: path.basename(adapterContext.core, ".txt")
    });
  }

  if (variantMeta && Array.isArray(variantMeta.files)) {
    for (const fileEntry of variantMeta.files) {
      if (typeof fileEntry === "string") {
        filesToDownload.push({
          source: fileEntry,
          target: path.basename(fileEntry, ".txt")
        });
      } else {
        filesToDownload.push(fileEntry);
      }
    }
  }

  let fileExistsConflict = false;
  for (const fileMap of filesToDownload) {
    const destinationPath = join(targetFolder, fileMap.target);
    try {
      await fs.access(destinationPath);
      fileExistsConflict = true;
      break;
    } catch {
      // Handled cleanly
    }
  }

  if (fileExistsConflict) {
    const overwritePrompt = yes
      ? true
      : await confirm({
          message: `Files for "${targetBlock}" already exist. Overwrite?`,
          initialValue: false
        });
    if (!yes) handleCancel(overwritePrompt);

    if (!overwritePrompt) {
      outputResult(json, {
        success: false,
        reason: "aborted",
        message: "Local modifications preserved."
      });
      return;
    }
  }

  if (!json) {
    s.start(`Downloading ${targetBlock}...`);
  }

  try {
    for (const fileMap of filesToDownload) {
      const fileUrl = `${RAW_CDN_BASE}/${fileMap.source}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Download failed for: ${fileMap.source}`);

      const fileContent = await response.text();
      const localWriteLocation = join(targetFolder, fileMap.target);

      await fs.mkdir(dirname(localWriteLocation), { recursive: true });
      await fs.writeFile(localWriteLocation, fileContent, "utf-8");
    }

    if (!json) s.stop("Files copied.");

    outputResult(json, {
      success: true,
      block: targetBlock,
      filesWritten: filesToDownload.map((f) => join(targetFolder, f.target)),
      dependenciesInstalled: [...missingProdDeps, ...missingDevDeps],
      message: `Block added to ${physicalPath}/${targetBlock}`
    });
  } catch (error) {
    if (!json) {
      s.stop("Failed to write files.");
      log.error(pc.dim(String(error)));
    } else {
      outputError(json, "Fatal error occurred while writing block files.");
    }
  }
}
