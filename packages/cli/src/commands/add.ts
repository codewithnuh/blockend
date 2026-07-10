/* eslint-disable no-console */
import path, { join, dirname } from "path";
import fs from "fs/promises";
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
  source: string; // path inside the GitHub repo,  e.g. "blocks/logger/core.ts"
  target: string; // relative to the block folder,  e.g. "core.ts" or "tests/core.test.ts"
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

// ─── import rewriting ────────────────────────────────────────────────────────

/**
 * Rewrites relative imports inside a downloaded file so they use the
 * project's configured TypeScript path alias instead of relative paths.
 *
 * Only runs when `aliasBase` starts with a non-relative prefix (e.g. "@", "~").
 * If the user has no alias configured, relative imports are already structurally
 * correct because the target layout mirrors the registry layout exactly.
 *
 * @param fileContent     - Raw source of the file being written
 * @param writtenFilePath - Absolute path where the file will be saved on disk
 * @param blocksRoot      - Absolute path to the blocks root dir (e.g. /project/src/blocks)
 * @param aliasBase       - The alias prefix from blockend.json (e.g. "@/blocks")
 */
function rewriteFileImports(
  fileContent: string,
  writtenFilePath: string,
  blocksRoot: string,
  aliasBase: string | undefined
): string {
  // Only rewrite when a real non-relative alias is configured
  if (!aliasBase || aliasBase.startsWith(".")) {
    return fileContent;
  }

  // Matches relative imports/exports in all common forms:
  //   import X from "./foo"
  //   import { X } from '../foo/bar'
  //   export { X } from "./foo"
  //   import("./foo")
  // Captures: (keyword)(quote)(relative-path)(closing-quote)
  const importRegex = /((?:from|import)\s*)(['"`])(\.\.?\/[^'"` \n\r]+)(['"`])/g;

  const fileDir = dirname(writtenFilePath);

  return fileContent.replace(importRegex, (match, keyword, openQuote, relativePath, closeQuote) => {
    // 1. Resolve the import target to an absolute path from THIS file's directory
    //    (not from targetFolder — files in tests/ subdirs resolve differently)
    const absoluteTarget = path.resolve(fileDir, relativePath);

    // 2. Express it relative to the blocks root (e.g. /project/src/blocks)
    //    Result: "logger/core"  or  "logger/tests/core.test"
    const fromBlocksRoot = path.relative(blocksRoot, absoluteTarget).replace(/\\/g, "/");

    // 3. If the import escapes the blocks root (starts with ..) it points
    //    to something outside our control — leave it untouched
    if (fromBlocksRoot.startsWith("..")) {
      return match;
    }

    // 4. Combine alias base + path-from-blocks-root
    //    "@/blocks" + "logger/core"  →  "@/blocks/logger/core"
    const aliased = `${aliasBase}/${fromBlocksRoot}`.replace(/\/+/g, "/");

    return `${keyword}${openQuote}${aliased}${closeQuote}`;
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
      if (parent === dir) break; // reached filesystem root
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

  const rootDir = dirname(configPath); // project root — same dir as blockend.json

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
    if (!json) outro(pc.dim("Exiting."));
    return;
  }

  // ── Derive paths from config ────────────────────────────────────────────
  //
  // config.paths.blocks  is ALWAYS a real physical path  (e.g. "./src/blocks")
  // config.aliases.blocks is ALWAYS the import alias     (e.g. "@/blocks")
  //
  // We resolve these once here; everything downstream uses these two values.

  const physicalBlocksPath = config.paths.blocks; // "./src/blocks"
  const blocksRootAbsolute = path.resolve(rootDir, physicalBlocksPath); // /project/src/blocks
  const aliasBase = config.aliases.blocks; // "@/blocks"
  const envKey = config.environment;

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
    } else {
      outputError(json, "Failed to fetch the component registry from GitHub.");
    }
    return;
  }

  // Registry may be { blocks: { ... } } or flat { "block-name": { ... } }
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
    const available = Object.entries(blockMap).filter(([, block]) => {
      if (!block) return false;
      return block.adapters?.[envKey] !== undefined || block.environments?.[envKey] !== undefined;
    });

    if (available.length === 0) {
      const msg = `No blocks available for environment: ${envKey}`;
      outputError(json, msg);
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
    outputError(json, `Block "${targetBlock}" does not exist in the registry.`);
    return;
  }

  // ── Resolve adapter/environment context ─────────────────────────────────

  const adapterContext = blockMeta.adapters?.[envKey] ?? blockMeta.environments?.[envKey];
  if (!adapterContext) {
    outputError(json, `Block "${targetBlock}" does not support environment: ${envKey}`);
    return;
  }

  // ── Variant selection ───────────────────────────────────────────────────

  const variantKeys = Object.keys(adapterContext.variants ?? {});
  if (variantKeys.length === 0) {
    outputError(json, `No variants found for block "${targetBlock}" in environment "${envKey}"`);
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

  // ── Where the block lands on disk ───────────────────────────────────────
  //
  // targetFolder is the block-specific subdirectory, e.g.:
  //   /project/src/blocks/logger
  //
  // The file tree inside targetFolder mirrors the registry target paths:
  //   "target": "core.ts"              → /project/src/blocks/logger/core.ts
  //   "target": "tests/core.test.ts"   → /project/src/blocks/logger/tests/core.test.ts
  //   "target": "express-adapter.ts"   → /project/src/blocks/logger/express-adapter.ts

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

  const missingProd = [
    ...(adapterContext.dependencies ?? []),
    ...(variantMeta?.dependencies ?? [])
  ].filter((d) => !(d in installedDeps));

  const missingDev = [
    ...(adapterContext.devDependencies ?? []),
    ...(variantMeta?.devDependencies ?? [])
  ].filter((d) => !(d in installedDeps));

  if (missingProd.length > 0 || missingDev.length > 0) {
    if (!json) {
      log.warn(`Missing dependencies: ${pc.cyan([...missingProd, ...missingDev].join(", "))}`);
    }

    const shouldInstall = yes
      ? true
      : await confirm({ message: "Install missing dependencies?", initialValue: true });

    if (!yes) handleCancel(shouldInstall);

    if (shouldInstall) {
      const pm = await fs
        .access(join(packageJsonDir, "pnpm-lock.yaml"))
        .then(() => "pnpm")
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
        } else {
          outputError(json, "Dependency installation failed.");
        }
        return;
      }
    }
  }

  // ── Build file list ─────────────────────────────────────────────────────
  //
  // Order: baseFiles first (shared core), then adapter core, then variant files.
  // This mirrors exactly how your registry.json is structured.

  const filesToDownload: AssetMapping[] = [];

  // 1. Shared base files (e.g. logger/core.ts, logger/tests/core.test.ts)
  if (blockMeta.baseFiles && Array.isArray(blockMeta.baseFiles)) {
    filesToDownload.push(...blockMeta.baseFiles);
  }

  // 2. Adapter-level core file (used by rate-limiter style blocks)
  if (adapterContext.core) {
    filesToDownload.push({
      source: adapterContext.core,
      target: path.basename(adapterContext.core)
    });
  }

  // 3. Variant files (adapter-specific implementations + tests)
  if (variantMeta && Array.isArray(variantMeta.files)) {
    for (const entry of variantMeta.files) {
      if (typeof entry === "string") {
        filesToDownload.push({ source: entry, target: path.basename(entry) });
      } else {
        filesToDownload.push(entry);
      }
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
      // file doesn't exist — no conflict
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

  // ── Download and write files ────────────────────────────────────────────
  //
  // Each file's target path mirrors the registry layout:
  //
  //   registry "target": "core.ts"
  //     → written to:  <blocksRoot>/<blockName>/core.ts
  //     → import alias: @/blocks/logger/core
  //
  //   registry "target": "tests/core.test.ts"
  //     → written to:  <blocksRoot>/<blockName>/tests/core.test.ts
  //     → imports rewritten using dirname of written file so ../core resolves correctly

  if (!json) s.start(`Downloading ${targetBlock}...`);

  const filesWritten: string[] = [];

  try {
    for (const fm of filesToDownload) {
      const fileUrl = `${RAW_CDN_BASE}/${fm.source}`;
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Failed to download: ${fm.source} (HTTP ${res.status})`);

      let content = await res.text();

      // Absolute path where this file will live on the user's disk
      const writtenFilePath = path.join(targetFolder, fm.target);

      // Rewrite imports using:
      //   - writtenFilePath:   so dirname resolves per-file (tests/ vs root)
      //   - blocksRootAbsolute: anchor for alias calculation (/project/src/blocks)
      //   - aliasBase:          what to prefix  (@/blocks)
      content = rewriteFileImports(content, writtenFilePath, blocksRootAbsolute, aliasBase);
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
    } else {
      outputError(json, "Fatal error while writing block files.");
    }
  }
}
