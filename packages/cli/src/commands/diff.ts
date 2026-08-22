/* oxlint-disable no-console */
import path, { join, dirname } from "path";
import fs from "fs/promises";
import { intro, outro, spinner, log } from "@clack/prompts";
import pc from "picocolors";
import { RegistryManifest, BlockManifest, AssetMapping, EnvironmentConfig } from "./add.js";
import { configPayloadType } from "./init.js";

// ─── types ───────────────────────────────────────────────────────────────────

export interface DiffFile {
  name: string;
  sourcePath: string;
  targetPath: string;
  existingContent: string | null;
  newContent: string;
  status: "new" | "modified" | "unchanged";
}

export interface DiffResult {
  block: string;
  files: DiffFile[];
  error?: string;
}

// ─── constants ───────────────────────────────────────────────────────────────

const REPO_OWNER = "codewithnuh";
const REPO_NAME = "blockend";
const BRANCH = "master";

const RAW_CDN_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;
const MANIFEST_URL = `${RAW_CDN_BASE}/registry/index.json`;

// ─── framework compatibility helpers (reused from add.ts) ────────────────────

function blockSupportsEnv(block: BlockManifest, envKey: string): boolean {
  if (block.frameworks && block.frameworks.length > 0) {
    return block.frameworks.includes("*") || block.frameworks.includes(envKey as never);
  }
  return block.adapters?.[envKey] !== undefined || block.environments?.[envKey] !== undefined;
}

function resolveAdapterContext(block: BlockManifest, envKey: string): EnvironmentConfig | null {
  return (
    block.adapters?.[envKey] ??
    block.adapters?.["*"] ??
    block.environments?.[envKey] ??
    block.environments?.["*"] ??
    null
  );
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── diff command ────────────────────────────────────────────────────────────

export async function diffCommand(
  blockName: string | undefined,
  options: { json?: boolean } = {}
): Promise<DiffResult> {
  const { json = false } = options;

  if (!json) {
    console.log("");
    intro(`${pc.bgCyan(pc.black(" blockend "))} ${pc.dim("diff")}`);
  }

  if (!blockName) {
    return { block: "", files: [], error: "Block name is required. Usage: blockend diff <block>" };
  }

  const cwd = process.cwd();

  // ── Read blockend.json ──────────────────────────────────────────────────

  const configPath = await findUp("blockend.json", cwd);
  if (!configPath) {
    const error = "blockend.json not found. Run 'npx blockend init' first.";
    if (json) {
      process.stdout.write(JSON.stringify({ block: blockName, files: [], error }) + "\n");
    } else {
      log.error(error);
    }
    return { block: blockName, files: [], error };
  }

  const rootDir = dirname(configPath);

  let config: configPayloadType;
  try {
    config = JSON.parse(await fs.readFile(configPath, "utf-8")) as configPayloadType;
  } catch {
    const error = "Failed to parse blockend.json.";
    if (json) {
      process.stdout.write(JSON.stringify({ block: blockName, files: [], error }) + "\n");
    } else {
      log.error(error);
    }
    return { block: blockName, files: [], error };
  }

  const physicalBlocksPath = config.paths.blocks;
  const blocksRootAbsolute = path.resolve(rootDir, physicalBlocksPath);
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
    const error = `Failed to fetch registry: ${String(err)}`;
    if (!json) {
      s.stop("Failed.");
      log.error(error);
    }
    return { block: blockName, files: [], error };
  }

  const blockMap: Record<string, BlockManifest> =
    registry.blocks && typeof registry.blocks === "object" && !Array.isArray(registry.blocks)
      ? (registry.blocks as Record<string, BlockManifest>)
      : (registry as Record<string, BlockManifest>);

  // ── Validate block ──────────────────────────────────────────────────────

  const blockMeta = blockMap[blockName];
  if (!blockMeta) {
    const error = `Block "${blockName}" not found in the registry.`;
    if (json) {
      process.stdout.write(JSON.stringify({ block: blockName, files: [], error }) + "\n");
    } else {
      log.error(error);
      outro(pc.dim("Block not found."));
    }
    return { block: blockName, files: [], error };
  }

  if (!blockSupportsEnv(blockMeta, envKey)) {
    const error = `Block "${blockName}" does not support environment: ${envKey}`;
    if (json) {
      process.stdout.write(JSON.stringify({ block: blockName, files: [], error }) + "\n");
    } else {
      log.error(error);
    }
    return { block: blockName, files: [], error };
  }

  // ── Resolve adapter context ─────────────────────────────────────────────

  const adapterContext = resolveAdapterContext(blockMeta, envKey);
  if (!adapterContext) {
    const error = `Block "${blockName}" has no adapter for: ${envKey}`;
    if (json) {
      process.stdout.write(JSON.stringify({ block: blockName, files: [], error }) + "\n");
    } else {
      log.error(error);
    }
    return { block: blockName, files: [], error };
  }

  // ── Resolve variant (use first available) ───────────────────────────────

  const variantKeys = Object.keys(adapterContext.variants ?? {});
  if (variantKeys.length === 0) {
    const error = `No variants found for "${blockName}" / "${envKey}".`;
    if (json) {
      process.stdout.write(JSON.stringify({ block: blockName, files: [], error }) + "\n");
    } else {
      log.error(error);
    }
    return { block: blockName, files: [], error };
  }

  const selectedVariant = variantKeys[0];
  const variantMeta = adapterContext.variants[selectedVariant];
  const targetFolder = path.resolve(blocksRootAbsolute, blockName);

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

  // ── Download and compare ────────────────────────────────────────────────

  if (!json) s.start(`Comparing ${blockName} files...`);

  const diffFiles: DiffFile[] = [];

  try {
    for (const fm of filesToDownload) {
      // Download new content
      const res = await fetch(`${RAW_CDN_BASE}/${fm.source}`);
      if (!res.ok) throw new Error(`Download failed: ${fm.source} (HTTP ${res.status})`);
      const newContent = await res.text();

      const targetPath = path.join(targetFolder, fm.target);

      // Check if file exists locally
      let existingContent: string | null = null;
      let status: "new" | "modified" | "unchanged" = "new";

      if (await fileExists(targetPath)) {
        try {
          existingContent = await fs.readFile(targetPath, "utf-8");
          status = existingContent === newContent ? "unchanged" : "modified";
        } catch {
          // File exists but can't be read — treat as new
        }
      }

      diffFiles.push({
        name: fm.target,
        sourcePath: fm.source,
        targetPath,
        existingContent,
        newContent,
        status
      });
    }

    if (!json) s.stop("Comparison complete.");

    // ── Print diff summary ──────────────────────────────────────────────

    if (!json) {
      console.log(`\n  ${pc.bold(pc.cyan(blockName))} — ${pc.dim(selectedVariant)} variant\n`);

      for (const file of diffFiles) {
        const icon =
          file.status === "new"
            ? pc.green("+")
            : file.status === "modified"
              ? pc.yellow("~")
              : pc.dim("=");
        const label =
          file.status === "new"
            ? pc.green("new")
            : file.status === "modified"
              ? pc.yellow("modified")
              : pc.dim("unchanged");

        console.log(`  ${icon} ${pc.bold(file.name)} ${pc.dim(`(${label})`)}`);

        if (file.status === "modified" && file.existingContent !== null) {
          // Show a simple diff summary
          const oldLines = file.existingContent.split("\n");
          const newLines = file.newContent.split("\n");
          const maxLines = Math.max(oldLines.length, newLines.length);

          for (let i = 0; i < Math.min(maxLines, 20); i++) {
            const oldLine = oldLines[i];
            const newLine = newLines[i];
            if (oldLine !== newLine) {
              if (oldLine !== undefined) {
                console.log(`    ${pc.red(`- ${oldLine}`)}`);
              }
              if (newLine !== undefined) {
                console.log(`    ${pc.green(`+ ${newLine}`)}`);
              }
            }
          }
          if (maxLines > 20) {
            console.log(`    ${pc.dim(`... ${maxLines - 20} more lines`)}`);
          }
        }
      }
      console.log("");

      const newCount = diffFiles.filter((f) => f.status === "new").length;
      const modCount = diffFiles.filter((f) => f.status === "modified").length;
      const unchangedCount = diffFiles.filter((f) => f.status === "unchanged").length;

      outro(
        `${pc.green(`${newCount} new`)} | ${pc.yellow(`${modCount} modified`)} | ${pc.dim(`${unchangedCount} unchanged`)}`
      );
    }

    const result: DiffResult = { block: blockName, files: diffFiles };
    if (json) {
      process.stdout.write(JSON.stringify(result) + "\n");
    }
    return result;
  } catch (err) {
    const error = `Failed during diff: ${String(err)}`;
    if (!json) {
      s.stop("Failed.");
      log.error(error);
    }
    const result: DiffResult = { block: blockName, files: diffFiles, error };
    if (json) {
      process.stdout.write(JSON.stringify(result) + "\n");
    }
    return result;
  }
}
