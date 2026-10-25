/* oxlint-disable no-console */
import path from "path";
import fs from "fs/promises";
import { intro, outro, spinner, log } from "@clack/prompts";
import pc from "picocolors";
import {
  createGitHubRegistrySource,
  findUp,
  loadRegistry,
  planBlock,
  previewBlock,
  type BlockendConfig,
  type RegistryManifest
} from "../block-install/index.js";

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

  const rootDir = path.dirname(configPath);

  let config: BlockendConfig;
  try {
    config = JSON.parse(await fs.readFile(configPath, "utf-8")) as BlockendConfig;
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

  const source = createGitHubRegistrySource();
  const s = spinner();
  if (!json) s.start("Fetching registry...");

  let registry: RegistryManifest;
  try {
    registry = await loadRegistry(source);
    if (!json) s.stop("Registry synced.");
  } catch (err) {
    const error = `Failed to fetch registry: ${String(err)}`;
    if (!json) {
      s.stop("Failed.");
      log.error(error);
    }
    return { block: blockName, files: [], error };
  }

  // ── Resolve the block plan ──────────────────────────────────────────────

  const targetFolder = path.resolve(blocksRootAbsolute, blockName);
  const installedRecord = config.installed?.find((block) => block.name === blockName);
  const planResult = await planBlock(registry, blockName, envKey, {
    recordedVariant: installedRecord?.variant,
    targetFolder
  });

  if (!planResult.ok) {
    const error =
      planResult.error.code === "no-adapter"
        ? `Block "${blockName}" has no adapter for: ${envKey}`
        : planResult.error.message;
    if (json) {
      process.stdout.write(JSON.stringify({ block: blockName, files: [], error }) + "\n");
    } else {
      log.error(error);
      if (planResult.error.code === "not-found") outro(pc.dim("Block not found."));
    }
    return { block: blockName, files: [], error };
  }

  const plan = planResult.plan;

  // ── Download and compare ────────────────────────────────────────────────

  if (!json) s.start(`Comparing ${blockName} files...`);

  const diffFiles: DiffFile[] = [];

  try {
    const previews = await previewBlock(plan, { source, targetFolder });
    diffFiles.push(...previews);

    if (!json) s.stop("Comparison complete.");

    // ── Print diff summary ──────────────────────────────────────────────

    if (!json) {
      console.log(`\n  ${pc.bold(pc.cyan(blockName))} — ${pc.dim(plan.variant)} variant\n`);

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

      const newCount = diffFiles.filter((file) => file.status === "new").length;
      const modCount = diffFiles.filter((file) => file.status === "modified").length;
      const unchangedCount = diffFiles.filter((file) => file.status === "unchanged").length;

      outro(
        `${pc.green(`${newCount} new`)} | ${pc.yellow(`${modCount} modified`)} | ${pc.dim(
          `${unchangedCount} unchanged`
        )}`
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
