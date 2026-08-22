/* oxlint-disable no-console */
import path, { join, dirname } from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { intro, outro, select, multiselect, spinner, confirm, isCancel, log } from "@clack/prompts";
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
  version?: string;
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
/**
 * Parse a dependency specifier like "vitest@^4.0.0" into { name, versionRange }.
 * If no version specified, versionRange is null.
 */
export function parseDepSpec(dep: string): { name: string; versionRange: string | null } {
  const atIndex = dep.lastIndexOf("@");
  if (atIndex > 0) {
    return { name: dep.slice(0, atIndex), versionRange: dep.slice(atIndex + 1) };
  }
  return { name: dep, versionRange: null };
}

/**
 * Simple semver comparison. Returns true if `installed` satisfies `range`.
 * Supports: exact (1.2.3), caret (^1.2.3), tilde (~1.2.3), gte (>=1.2.3).
 * Falls back to true if we can't parse (don't block installs for weird ranges).
 */
export function semverSatisfies(installed: string, range: string): boolean {
  const parse = (v: string) => {
    const clean = v.replace(/^[~^>=<]+/, "");
    const parts = clean.split(".").map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };

  const [iMajor, iMinor, iPatch] = parse(installed);
  const raw = range.replace(/^[~^>=<]+/, "");
  const [rMajor, rMinor, rPatch] = parse(raw);

  if (range.startsWith("^")) {
    // ^1.2.3 means >=1.2.3 <2.0.0
    return (
      (iMajor > rMajor ||
        (iMajor === rMajor && (iMinor > rMinor || (iMinor === rMinor && iPatch >= rPatch)))) &&
      iMajor === rMajor
    );
  }

  if (range.startsWith("~")) {
    // ~1.2.3 means >=1.2.3 <1.3.0
    return iMajor === rMajor && iMinor === rMinor && iPatch >= rPatch;
  }

  if (range.startsWith(">=")) {
    return (
      iMajor > rMajor ||
      (iMajor === rMajor && (iMinor > rMinor || (iMinor === rMinor && iPatch >= rPatch)))
    );
  }

  // Exact match
  return installed === raw;
}

/**
 * Check if a block's dependency conflicts with the user's installed version.
 * Returns list of conflicts like "vitest: block requires ^4.0.0, you have 3.0.0"
 */
export function getVersionConflicts(deps: string[], installed: Record<string, string>): string[] {
  const conflicts: string[] = [];
  for (const dep of deps) {
    const { name, versionRange } = parseDepSpec(dep);
    if (versionRange && name in installed) {
      const installedVersion = installed[name];
      if (!semverSatisfies(installedVersion, versionRange)) {
        conflicts.push(`${name}: block requires ${versionRange}, you have ${installedVersion}`);
      }
    }
  }
  return conflicts;
}

/**
 * Returns deps that need to be installed or updated.
 *
 * Three cases:
 * 1. Dep not installed at all → include it
 * 2. Dep installed but version doesn't satisfy the required range → include with version spec
 * 3. Dep installed, no version range in registry, but installed version is old →
 *    include with @latest to ensure block-compatible version
 *
 * Case 3 handles the common case where registry says "vitest" (no version)
 * but user has vitest@3.x and block was tested with vitest@4.x.
 */
export const getMissingDependencies = (
  deps: string[],
  installed: Record<string, string>,
  forceLatest = false
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const dep of deps) {
    const { name, versionRange } = parseDepSpec(dep);
    if (seen.has(name)) continue;
    seen.add(name);

    if (!(name in installed)) {
      // Case 1: Dep not installed at all
      result.push(dep);
    } else if (versionRange && !semverSatisfies(installed[name], versionRange)) {
      // Case 2: Dep installed but version incompatible with required range
      result.push(dep); // e.g. "vitest@^4.0.0"
    } else if (!versionRange && forceLatest) {
      // Case 3: No version range specified, but force latest to ensure compatibility
      // This handles registry entries that just say "vitest" without a version
      result.push(`${name}@latest`);
    }
    // else: dep exists and is compatible — skip
  }

  return result;
};
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
/**
 * Given a relative import path and the file it's imported from,
 * checks if the path resolves to a directory containing an index.ts file.
 * Returns the resolved target path (e.g., "./types" → "./types/index").
 */
function resolveIndexImport(
  importPath: string,
  sourceFileDir: string,
  downloadedFiles: Set<string>
): string | null {
  const resolved = path.resolve(sourceFileDir, importPath);
  // Check if any downloaded file is an index file inside this directory
  for (const downloaded of downloadedFiles) {
    const downloadedAbs = path.resolve(sourceFileDir, downloaded);
    const dirOfDownloaded = dirname(downloadedAbs);
    const basenameOfDownloaded = path.basename(downloadedAbs);
    if (dirOfDownloaded === resolved && basenameOfDownloaded.startsWith("index.")) {
      // Found an index file — return the path with /index suffix
      return `${importPath}/index`;
    }
  }
  return null;
}

export function rewriteFileImports(
  fileContent: string,
  writtenFilePath: string,
  blocksRoot: string,
  aliasBase: string | undefined,
  strategy: "rewrite" | "remove",
  downloadedFiles: Set<string> = new Set()
): string {
  // Only match RELATIVE imports (starting with ./ or ../)
  // Never touch bare external packages like "vitest", "express", "pino"
  const importRegex = /((?:from|import)\s*)(['"`])(\.\.?\/[^'"` \n\r]+)(['"`])/g;
  const fileDir = dirname(writtenFilePath);

  return fileContent.replace(importRegex, (match, keyword, openQuote, importPath, closeQuote) => {
    let targetPath = importPath;

    // 1. Resolve path alias replacement if applicable
    if (aliasBase && !aliasBase.startsWith(".")) {
      const absoluteTarget = path.resolve(fileDir, importPath);
      const fromBlocksRoot = path.relative(blocksRoot, absoluteTarget).replace(/\\/g, "/");

      if (!fromBlocksRoot.startsWith("..")) {
        targetPath = `${aliasBase}/${fromBlocksRoot}`.replace(/\/+/g, "/");
      }
    }

    // 2. Apply extension modifications (NodeNext append vs Bundler remove)
    const hasJsExt = targetPath.endsWith(".js");
    if (strategy === "rewrite" && !hasJsExt) {
      // Remove any trailing .ts/tsx/mts extensions if present
      targetPath = targetPath.replace(/\.(ts|tsx|mts|cts)$/, "");

      // Smart index resolution: check if this path points to a directory with index.ts
      // e.g., "./types" → "./types/index" when types/index.ts exists
      if (downloadedFiles.size > 0) {
        const indexResolved = resolveIndexImport(targetPath, fileDir, downloadedFiles);
        if (indexResolved) {
          targetPath = indexResolved;
        }
      }

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

/**
 * Add a single block to the project.
 * Extracted so it can be called once per block in multi-select mode.
 */
async function addSingleBlock(
  targetBlock: string,
  blockMap: Record<string, BlockManifest>,
  config: BlockendExtendedConfig,
  rootDir: string,
  physicalBlocksPath: string,
  blocksRootAbsolute: string,
  aliasBase: string | undefined,
  envKey: string,
  rewriteStrategy: "rewrite" | "remove",
  options: { yes?: boolean; json?: boolean }
): Promise<{ success: boolean; filesWritten: string[]; message: string }> {
  const { yes = false, json = false } = options;
  const s = spinner();

  const blockMeta = blockMap[targetBlock];
  if (!blockMeta) {
    outputError(json, `Block "${targetBlock}" not found in the registry.`);
    return { success: false, filesWritten: [], message: `Block "${targetBlock}" not found` };
  }

  if (!blockSupportsEnv(blockMeta, envKey)) {
    outputError(json, `Block "${targetBlock}" does not support environment: ${envKey}`);
    return { success: false, filesWritten: [], message: `Block "${targetBlock}" incompatible` };
  }

  // ── Resolve adapter context ─────────────────────────────────────────────

  const adapterContext = resolveAdapterContext(blockMeta, envKey);
  if (!adapterContext) {
    outputError(
      json,
      `Block "${targetBlock}" has no adapter or environment entry for: ${envKey}. ` +
        `This is a registry configuration issue — please open an issue.`
    );
    return { success: false, filesWritten: [], message: `No adapter for "${targetBlock}"` };
  }

  // ── Variant selection ───────────────────────────────────────────────────

  const variantKeys = Object.keys(adapterContext.variants ?? {});
  if (variantKeys.length === 0) {
    outputError(json, `No variants found for "${targetBlock}" / "${envKey}".`);
    return { success: false, filesWritten: [], message: `No variants for "${targetBlock}"` };
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
      message: `Select a storage variant for ${targetBlock}:`,
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

  const allBlockDeps = [
    ...(blockMeta.dependencies ?? []),
    ...(adapterContext.dependencies ?? []),
    ...(variantMeta?.dependencies ?? [])
  ];
  const allBlockDevDeps = [
    ...(blockMeta.devDependencies ?? []),
    ...(adapterContext.devDependencies ?? []),
    ...(variantMeta?.devDependencies ?? [])
  ];

  const missingProd = getMissingDependencies(allBlockDeps, installedDeps, true);
  const missingDev = getMissingDependencies(allBlockDevDeps, installedDeps, true);

  // ── Version conflict detection ───────────────────────────────────────
  const prodConflicts = getVersionConflicts(allBlockDeps, installedDeps);
  const devConflicts = getVersionConflicts(allBlockDevDeps, installedDeps);
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
      const pm = await fs
        .readFile(join(packageJsonDir, "blockend.json"), "utf8")
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
        return { success: false, filesWritten: [], message: "Dependency installation failed" };
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
      return { success: false, filesWritten: [], message: "Local files preserved." };
    }
  }

  // ── Download and write ──────────────────────────────────────────────────

  if (!json) s.start(`Downloading ${targetBlock}...`);

  const filesWritten: string[] = [];
  // Track all file targets for smart index resolution (pass 1 downloads, pass 2 rewrites)
  const downloadedTargets = new Set<string>();

  try {
    // Pass 1: download all files into memory so we know the full file set
    const fileBatches: Array<{ fm: AssetMapping; raw: string }> = [];
    for (const fm of filesToDownload) {
      const res = await fetch(`${RAW_CDN_BASE}/${fm.source}`);
      if (!res.ok) throw new Error(`Download failed: ${fm.source} (HTTP ${res.status})`);
      fileBatches.push({ fm, raw: await res.text() });
      downloadedTargets.add(fm.target);
    }

    // Pass 2: rewrite imports with full knowledge of all files, then write
    let contentHash = 0;
    for (const { fm, raw } of fileBatches) {
      const writtenFilePath = path.join(targetFolder, fm.target);
      const content = rewriteFileImports(
        raw,
        writtenFilePath,
        blocksRootAbsolute,
        aliasBase,
        rewriteStrategy,
        downloadedTargets
      );

      await fs.mkdir(dirname(writtenFilePath), { recursive: true });
      await fs.writeFile(writtenFilePath, content, "utf-8");
      filesWritten.push(writtenFilePath);

      // Accumulate content hash for version tracking
      for (let i = 0; i < content.length; i++) {
        contentHash = ((contentHash << 5) - contentHash + content.charCodeAt(i)) | 0;
      }
    }

    // ── Record installed block in blockend.json ────────────────────────

    const blockVersion = blockMeta.version ?? "0.0.0";
    const installedRecord = {
      name: targetBlock,
      version: blockVersion,
      installedAt: new Date().toISOString(),
      files: filesWritten.map((f) => path.relative(targetFolder, f).replace(/\\/g, "/")),
      contentHash: contentHash.toString(16)
    };

    try {
      const blockendPath = join(rootDir, "blockend.json");
      const cfgRaw = await fs.readFile(blockendPath, "utf-8");
      const cfgData = JSON.parse(cfgRaw) as BlockendExtendedConfig;
      if (!Array.isArray(cfgData.installed)) cfgData.installed = [];
      cfgData.installed = cfgData.installed.filter((b: { name: string }) => b.name !== targetBlock);
      cfgData.installed.push(installedRecord);
      await fs.writeFile(blockendPath, JSON.stringify(cfgData, null, 2), "utf-8");
    } catch {
      // Non-fatal: files were written, just tracking failed
    }

    if (!json) s.stop("Files written.");
    return {
      success: true,
      filesWritten,
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

  // ── Multi-select mode ───────────────────────────────────────────────────

  if (multi && !blockName) {
    const available = Object.entries(blockMap).filter(
      ([, block]) => block != null && blockSupportsEnv(block, envKey)
    );

    if (available.length === 0) {
      outputError(json, `No blocks available for environment: ${envKey}`);
      if (!json) outro(pc.dim("Exiting."));
      return;
    }

    const maxKeyLen = Math.max(...available.map(([k]) => k.length), 0);
    const multiSelectPrompt = await multiselect({
      message: "Select blocks to add (space to select, enter to confirm):",
      options: available.map(([key, block], i) => ({
        value: key,
        label: `${pc.dim(`${i + 1}.`)} ${pc.bold(pc.cyan(key.padEnd(maxKeyLen + 4)))}${pc.dim(
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
      const result = await addSingleBlock(
        block,
        blockMap,
        config,
        rootDir,
        physicalBlocksPath,
        blocksRootAbsolute,
        aliasBase,
        envKey,
        rewriteStrategy,
        options
      );
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

  const result = await addSingleBlock(
    targetBlock!,
    blockMap,
    config,
    rootDir,
    physicalBlocksPath,
    blocksRootAbsolute,
    aliasBase,
    envKey,
    rewriteStrategy,
    options
  );

  outputResult(json, {
    success: result.success,
    block: targetBlock,
    filesWritten: result.filesWritten,
    message: result.message
  });
}
