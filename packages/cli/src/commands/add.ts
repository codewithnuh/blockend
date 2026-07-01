/* eslint-disable no-console */
import path, { join, dirname } from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { intro, outro, select, spinner, confirm, isCancel } from "@clack/prompts";
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
  // Dual layout capability supporting modern adapters and legacy environments concurrently
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

function handleCancel(value: unknown): void {
  if (isCancel(value)) {
    outro(pc.yellow("⚠ Operation cancelled. Exiting Blockend CLI cleanly."));
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

export async function addCommand(blockName: string | undefined): Promise<void> {
  intro(pc.bgBlack(pc.magenta(" Blockend Component Ingestion ")));
  const cwd = process.cwd();

  const configPath = await findUp("blockend.json", cwd);
  if (!configPath) {
    outro(pc.red("✖ blockend.json not found. Run 'npx blockend init' first."));
    return;
  }
  const rootDir = dirname(configPath);

  let config: BlockendExtendedConfig;
  try {
    const configFile = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(configFile) as BlockendExtendedConfig;
  } catch (error) {
    outro(pc.red("✖ Failed to parse blockend.json layout configuration."));
    console.error(pc.dim(String(error)));
    return;
  }

  if (config.language !== "typescript") {
    outro(
      pc.yellow(
        `\nℹ Blockend forces modern architectural standards. Registry exclusively supports TypeScript.`
      )
    );
    return;
  }

  const s = spinner();
  s.start("Connecting to remote Blockend Registry manifest...");

  let registry: RegistryManifest;
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
    registry = (await response.json()) as RegistryManifest;
    s.stop(pc.green("✔ Remote manifest synchronization complete."));
  } catch (error) {
    s.stop(pc.red("✖ Failed to fetch the component registry from GitHub network paths."));
    console.error(pc.dim(String(error)));
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
  if (!targetBlock) {
    const availableOptions = Object.entries(blockMap)
      .filter(([_, block]) => {
        if (!block) return false;
        const hasAdapter = block.adapters?.[envKey] !== undefined;
        const hasEnvironment = block.environments?.[envKey] !== undefined;
        return hasAdapter || hasEnvironment;
      })
      .map(([key, block]) => ({
        value: key,
        label: `${key} - ${pc.dim(block.description)}`
      }));

    if (availableOptions.length === 0) {
      outro(
        pc.yellow(
          `⚠ No backend blocks are currently available for your framework layer: [${envKey}].`
        )
      );
      return;
    }

    const selectBlockPrompt = await select({
      message: "Which backend block would you like to inject?",
      options: availableOptions
    });
    handleCancel(selectBlockPrompt);
    targetBlock = selectBlockPrompt as string;
  }

  const blockMeta = blockMap[targetBlock];
  if (!blockMeta) {
    outro(pc.red(`✖ Block "${targetBlock}" does not exist in the remote registry.`));
    return;
  }

  // Fallback pattern prioritizes modern adapters mapping before parsing legacy environments
  const adapterContext = blockMeta.adapters?.[envKey] ?? blockMeta.environments?.[envKey];
  if (!adapterContext) {
    outro(
      pc.red(`✖ The block "${targetBlock}" does not support your environment layout: ${envKey}`)
    );
    return;
  }

  let selectedVariant: string;
  const variantKeys = Object.keys(adapterContext.variants || {});

  if (variantKeys.length === 0) {
    outro(pc.red(`✖ No architecture storage layout variants found for block framework: ${envKey}`));
    return;
  }

  if (variantKeys.includes("redis") && config.redisEnabled) {
    selectedVariant = "redis";
  } else if (variantKeys.length === 1) {
    selectedVariant = variantKeys[0];
  } else {
    const selectVariantPrompt = await select({
      message: "Which architectural storage variant do you want to back this block?",
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
    outro(pc.red("✖ Could not locate package.json in your current directory layout hierarchy."));
    return;
  }
  const packageJsonDir = dirname(packageJsonPath);

  let packageJson: LocalPackageJson;
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    packageJson = JSON.parse(packageJsonContent) as LocalPackageJson;
  } catch (error) {
    outro(pc.red("✖ Failed parsing file data configurations from target package.json location."));
    console.error(pc.dim(String(error)));
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
    console.log(
      pc.yellow(`\n⚠️ Missing required infrastructure packages: ${allMissingNames.join(", ")}`)
    );
    const shouldInstallPrompt = await confirm({
      message: "Would you like the CLI to automatically install these dependencies?",
      initialValue: true
    });
    handleCancel(shouldInstallPrompt);

    if (shouldInstallPrompt) {
      const packageManager = await fs
        .access(join(packageJsonDir, "pnpm-lock.yaml"))
        .then(() => "pnpm")
        .catch(() => "npm");
      s.start(`Preparing native workspace via ${packageManager}...`);
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
          s.stop(pc.cyan(`Executing: ${installCmd}\n`));

          await new Promise<void>((resolve, reject) => {
            const child = exec(installCmd, { cwd: packageJsonDir });
            child.stdout?.on("data", (data: string) => process.stdout.write(pc.dim(data)));
            child.stderr?.on("data", (data: string) => process.stdout.write(pc.dim(pc.red(data))));
            child.on("close", (code) =>
              code === 0 ? resolve() : reject(new Error(`Exit code ${code}`))
            );
          });
        }

        s.start(pc.green("✔ All dependencies synchronized successfully."));
        s.stop();
      } catch (error) {
        s.stop(pc.red("✖ Automated dependency installation failed. Please run setup manually."));
        console.error(pc.dim(String(error)));
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
      // Intentionally empty logic block inside loop; explicitly handles the file not existing check
    }
  }

  if (fileExistsConflict) {
    const overwritePrompt = await confirm({
      message: `⚠ Components in [${targetBlock}] already exist. Overwrite custom revisions?`,
      initialValue: false
    });
    handleCancel(overwritePrompt);
    if (!overwritePrompt) {
      outro(pc.yellow("ℹ Operation aborted safely. Local code modifications preserved."));
      return;
    }
  }

  s.start(`Downloading and building template adapter blocks [${targetBlock}]...`);
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

    s.stop(pc.green("✔ Component isolation structures written smoothly."));
    outro(
      pc.cyan(
        `✨ Source blocks written to ${physicalPath}/${targetBlock}/. Code ownership transferred!`
      )
    );
  } catch (error) {
    s.stop(pc.red("✖ Fatal error occurred while assembling file mappings."));
    console.error(pc.dim(String(error)));
  }
}
