/* eslint-disable no-console */
import path, { join, dirname } from "path";
import fs, { readFile } from "fs/promises";
import { exec } from "child_process";
import { intro, outro, select, spinner, confirm, isCancel, log } from "@clack/prompts";
import pc from "picocolors";
import { configPayloadType } from "./init.js";

// ─── types ───────────────────────────────────────────────────────────────────

interface BlockendExtendedConfig extends configPayloadType {
  redisEnabled?: boolean;
}

interface LocalPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface AssetMapping {
  source: string; // repo-relative path,   e.g. "blocks/logger/core.ts"
  target: string; // block-folder-relative, e.g. "core.ts" | "tests/core.test.ts"
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

export interface BlockManifest {
  name: string;
  description: string;
  /**
   * Explicit framework support list.
   * - Named keys ("express", "fastify", "hono", "next") mean this block
   *   only appears for users whose blockend.json environment matches.
   * - "*" means framework-agnostic — shown for every environment.
   * - Omitting the field triggers legacy fallback: the CLI inspects
   *   adapters/environments keys directly (backward compat).
   */
  frameworks?: Array<"express" | "fastify" | "hono" | "next" | "*">;
  /**
   * Top-level dependencies for adapter-free blocks (frameworks: ["*"] with
   * only baseFiles and no adapters/environments). Merged with any
   * adapter-level deps when an adapter context also exists.
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

// ─── constants ───────────────────────────────────────────────────────────────

const REPO_OWNER = "codewithnuh";
const REPO_NAME = "blockend";
const BRANCH = "master";

const RAW_CDN_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;
const MANIFEST_URL = `${RAW_CDN_BASE}/registry/index.json`;

// ─── framework compatibility helpers ─────────────────────────────────────────

function blockSupportsEnv(block: BlockManifest, envKey: string): boolean {
  if (block.frameworks && block.frameworks.length > 0) {
    return block.frameworks.includes("*") || block.frameworks.includes(envKey as never);
  }
  return block.adapters?.[envKey] !== undefined || block.environments?.[envKey] !== undefined;
}
const getMissingDependencies = (deps: string[], installed: Record<string, string>) =>
  [...new Set(deps)].filter((dep) => !(dep in installed));
function resolveAdapterContext(block: BlockManifest, envKey: string): EnvironmentConfig | null {
  return (
    block.adapters?.[envKey] ??
    block.adapters?.["*"] ??
    block.environments?.[envKey] ??
    block.environments?.["*"] ??
    null
  );
}

// ─── import rewriting ────────────────────────────────────────────────────────

/**
 * Rewrites imports inside a downloaded file to use path aliases and appends/removes
 * extensions according to the project's config strategy.
 */
function rewriteFileImports(
  fileContent: string,
  writtenFilePath: string,
  blocksRoot: string,
  aliasBase: string | undefined,
  strategy: "rewrite" | "remove"
): string {
  // Matches: import X from "./foo", export { X } from '../bar', import("./baz")
  const importRegex = /((?:from|import)\s*)(['"`])(\.\.?\/[^'"` \n\r]+)(['"`])/g;
  const fileDir = dirname(writtenFilePath);

  return fileContent.replace(importRegex, (match, keyword, openQuote, relativePath, closeQuote) => {
    let targetPath = relativePath;

    // 1. Resolve path alias replacement if applicable
    if (aliasBase && !aliasBase.startsWith(".")) {
      const absoluteTarget = path.resolve(fileDir, relativePath);
      const fromBlocksRoot = path.relative(blocksRoot, absoluteTarget).replace(/\\/g, "/");

      if (!fromBlocksRoot.startsWith("..")) {
        targetPath = `${aliasBase}/${fromBlocksRoot}`.replace(/\/+/g, "/");
      }
    }

    // 2. Apply extension modifications (NodeNext append vs Bundler remove)
    const hasJsExt = targetPath.endsWith(".js");
    if (strategy === "rewrite" && !hasJsExt) {
      // Remove any trailing .ts/tsx/mts extensions if present before safely appending .js
      targetPath = targetPath.replace(/\.(ts|tsx|mts|cts)$/, "");
      targetPath = `${targetPath}.js`;
    } else if (strategy === "remove" && hasJsExt) {
      targetPath = targetPath.slice(0, -3);
    }

    return `${keyword}${openQuote}${targetPath}${closeQuote}`;
  });
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

// ─── filesystem helpers ──────────────────────────────────────────────────────

async function findUp(filename: string, startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, filename);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

// ─── add command ─────────────────────────────────────────────────────────────

export async function addCommand(
  blockName: string | undefined,
  options: { yes?: boolean; json?: boolean } = {}
): Promise<void> {
  const { yes = false, json = false } = options;

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

  const s = spinner();
  if (!json) s.start("Fetching registry...");

  let registry: RegistryManifest;
  try {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    registry = (await res.json()) as RegistryManifest;
    if (!json) s.stop("Registry synced.");
  } catch (err) {
    if (!json) {
      s.stop("Failed to fetch registry.");
      log.error(pc.dim(String(err)));
    } else outputError(json, "Failed to fetch registry from GitHub.");
    return;
  }

  const blockMap: Record<string, BlockManifest> =
    registry.blocks && typeof registry.blocks === "object" && !Array.isArray(registry.blocks)
      ? (registry.blocks as Record<string, BlockManifest>)
      : (registry as Record<string, BlockManifest>);

  // ── Block selection ─────────────────────────────────────────────────────

  if (yes && !blockName) {
    outputError(json, "Block name required with --yes. Usage: blockend add <block> --yes");
    return;
  }

  let targetBlock = blockName;

  if (!targetBlock) {
    const available = Object.entries(blockMap).filter(
      ([, block]) => block != null && blockSupportsEnv(block, envKey)
    );

    if (available.length === 0) {
      outputError(json, `No blocks available for environment: ${envKey}`);
      if (!json) outro(pc.dim("Exiting."));
      return;
    }

    const maxKeyLen = Math.max(...available.map(([k]) => k.length), 0);
    const selectPrompt = await select({
      message: "Which block would you like to add?",
      options: available.map(([key, block], i) => ({
        value: key,
        label: `${pc.dim(`${i + 1}.`)} ${pc.bold(pc.cyan(key.padEnd(maxKeyLen + 4)))}${pc.dim(
          block.description.length > 60 ? `${block.description.slice(0, 60)}...` : block.description
        )}`
      }))
    });
    handleCancel(selectPrompt);
    targetBlock = selectPrompt as string;
  }

  const blockMeta = blockMap[targetBlock];
  if (!blockMeta) {
    outputError(json, `Block "${targetBlock}" not found in the registry.`);
    return;
  }

  if (!blockSupportsEnv(blockMeta, envKey)) {
    outputError(json, `Block "${targetBlock}" does not support environment: ${envKey}`);
    return;
  }

  // ── Resolve adapter context ─────────────────────────────────────────────

  const adapterContext = resolveAdapterContext(blockMeta, envKey);
  if (!adapterContext) {
    outputError(
      json,
      `Block "${targetBlock}" has no adapter or environment entry for: ${envKey}. ` +
        `This is a registry configuration issue — please open an issue.`
    );
    return;
  }

  // ── Variant selection ───────────────────────────────────────────────────

  const variantKeys = Object.keys(adapterContext.variants ?? {});
  if (variantKeys.length === 0) {
    outputError(json, `No variants found for "${targetBlock}" / "${envKey}".`);
    return;
  }

  let selectedVariant: string;

  if (yes) {
    selectedVariant = variantKeys.includes("memory") ? "memory" : variantKeys[0];
  } else if (variantKeys.includes("redis") && (config.redisEnabled || config.includeRedis)) {
    selectedVariant = "redis";
  } else if (variantKeys.length === 1) {
    selectedVariant = variantKeys[0];
  } else {
    const variantPrompt = await select({
      message: "Select a storage variant:",
      options: variantKeys.map((v) => ({ value: v, label: v.toUpperCase() }))
    });
    handleCancel(variantPrompt);
    selectedVariant = variantPrompt as string;
  }

  const variantMeta = adapterContext.variants[selectedVariant];
  const targetFolder = path.resolve(blocksRootAbsolute, targetBlock);

  // ── Dependency management ───────────────────────────────────────────────

  const packageJsonPath = await findUp("package.json", rootDir);
  if (!packageJsonPath) {
    outputError(json, "Could not locate package.json.");
    return;
  }
  const packageJsonDir = dirname(packageJsonPath);

  let packageJson: LocalPackageJson;
  try {
    packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8")) as LocalPackageJson;
  } catch (err) {
    outputError(json, "Failed to parse package.json.");
    if (!json) log.error(pc.dim(String(err)));
    return;
  }

  const installedDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {})
  };

  const missingProd = getMissingDependencies(
    [
      ...(blockMeta.dependencies ?? []),
      ...(adapterContext.dependencies ?? []),
      ...(variantMeta?.dependencies ?? [])
    ],
    installedDeps
  );
  const missingDev = getMissingDependencies(
    [
      ...(blockMeta.devDependencies ?? []),
      ...(adapterContext.devDependencies ?? []),
      ...(variantMeta?.devDependencies ?? [])
    ],
    installedDeps
  );

  if (missingProd.length > 0 || missingDev.length > 0) {
    if (!json) log.warn(`Missing: ${pc.cyan([...missingProd, ...missingDev].join(", "))}`);

    const shouldInstall = yes
      ? true
      : await confirm({ message: "Install missing dependencies?", initialValue: true });
    if (!yes) handleCancel(shouldInstall);

    if (shouldInstall) {
      const pm = await readFile(join(packageJsonDir, "blockend.json"), "utf8")
        .then((data) => JSON.parse(data).packageManager)
        .catch(() => "npm");

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
        return;
      }
    }
  }

  // ── Build file list ─────────────────────────────────────────────────────

  const filesToDownload: AssetMapping[] = [];

  if (blockMeta.baseFiles?.length) {
    filesToDownload.push(...blockMeta.baseFiles);
  }

  if (adapterContext.core) {
    filesToDownload.push({
      source: adapterContext.core,
      target: path.basename(adapterContext.core)
    });
  }

  if (variantMeta && Array.isArray(variantMeta.files)) {
    for (const entry of variantMeta.files) {
      filesToDownload.push(
        typeof entry === "string" ? { source: entry, target: path.basename(entry) } : entry
      );
    }
  }

  // ── Conflict check ──────────────────────────────────────────────────────

  let hasConflict = false;
  for (const fm of filesToDownload) {
    try {
      await fs.access(join(targetFolder, fm.target));
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
      outputResult(json, { success: false, reason: "aborted", message: "Local files preserved." });
      return;
    }
  }

  // ── Download and write ──────────────────────────────────────────────────

  if (!json) s.start(`Downloading ${targetBlock}...`);

  const filesWritten: string[] = [];

  try {
    for (const fm of filesToDownload) {
      const res = await fetch(`${MANIFEST_URL}/${fm.source}`);
      if (!res.ok) throw new Error(`Download failed: ${fm.source} (HTTP ${res.status})`);

      let content = await res.text();
      const writtenFilePath = path.join(targetFolder, fm.target);

      // Now correctly passes down the rewriteStrategy configuration state
      content = rewriteFileImports(
        content,
        writtenFilePath,
        blocksRootAbsolute,
        aliasBase,
        rewriteStrategy
      );

      await fs.mkdir(dirname(writtenFilePath), { recursive: true });
      await fs.writeFile(writtenFilePath, content, "utf-8");
      filesWritten.push(writtenFilePath);
    }

    if (!json) s.stop("Files written.");
    outputResult(json, {
      success: true,
      block: targetBlock,
      filesWritten,
      dependenciesInstalled: [...missingProd, ...missingDev],
      message: `${targetBlock} added to ${physicalBlocksPath}/${targetBlock}`
    });
  } catch (err) {
    if (!json) {
      s.stop("Failed.");
      log.error(pc.dim(String(err)));
    } else outputError(json, "Fatal error while writing block files.");
  }
}
