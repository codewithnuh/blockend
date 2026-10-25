/* oxlint-disable no-console */
import path from "path";
import fs from "fs/promises";
import { intro, outro, spinner, log, multiselect, confirm, isCancel } from "@clack/prompts";
import pc from "picocolors";
import {
  applyBlock,
  createGitHubRegistrySource,
  findUp,
  loadRegistry,
  planBlock,
  previewBlock,
  type BlockPlan,
  type BlockendConfig,
  type InstalledBlockRecord,
  type RegistryManifest
} from "../block-install/index.js";

// ─── types ───────────────────────────────────────────────────────────────────

export interface UpdateBlockInfo {
  name: string;
  localVersion: string;
  remoteVersion: string;
  status: "up-to-date" | "update-available" | "not-tracked";
}

export interface FileDiff {
  name: string;
  file: string;
  status: "added" | "modified" | "removed" | "unchanged";
  lines: DiffLine[];
}

export interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface UpdateResult {
  blocks: UpdateBlockInfo[];
  applied?: string[];
  diffs?: Record<string, FileDiff[]>;
  error?: string;
}

// ─── diff helpers ────────────────────────────────────────────────────────────

function computeLineDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m,
    j = n;
  const raw: Array<{
    type: "added" | "removed" | "context";
    oldLine?: number;
    newLine?: number;
    content: string;
  }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      raw.unshift({ type: "context", oldLine: i, newLine: j, content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: "added", newLine: j, content: newLines[j - 1] });
      j--;
    } else {
      raw.unshift({ type: "removed", oldLine: i, content: oldLines[i - 1] });
      i--;
    }
  }

  const result: DiffLine[] = [];
  for (let k = 0; k < raw.length; k++) {
    const r = raw[k];
    const nearChange = raw.slice(Math.max(0, k - 3), k + 4).some((x) => x.type !== "context");
    if (r.type !== "context" || nearChange) {
      result.push({
        type: r.type,
        content: r.content,
        oldLineNo: r.oldLine,
        newLineNo: r.newLine
      });
    }
  }

  return result;
}

function handleCancel(value: unknown): void {
  if (isCancel(value)) {
    outro(pc.dim("Operation cancelled."));
    process.exit(0);
  }
}

// ─── output helpers ──────────────────────────────────────────────────────────

function printDiff(diff: FileDiff[]): void {
  for (const file of diff) {
    if (file.status === "unchanged") continue;

    const icon =
      file.status === "added"
        ? pc.green("+")
        : file.status === "removed"
          ? pc.red("-")
          : pc.yellow("~");
    const label =
      file.status === "added"
        ? pc.green("new")
        : file.status === "removed"
          ? pc.red("deleted")
          : pc.yellow("modified");

    console.log(`\n  ${icon} ${pc.bold(file.name)} ${pc.dim(`(${label})`)}`);

    if (file.lines.length === 0) continue;

    let lastShownLine = -1;
    for (let idx = 0; idx < file.lines.length; idx++) {
      const line = file.lines[idx];
      if (lastShownLine >= 0 && idx - lastShownLine > 1) {
        console.log(`    ${pc.dim("...")}`);
      }
      lastShownLine = idx;

      const lineNo =
        line.type === "removed"
          ? String(line.oldLineNo ?? "").padStart(4)
          : String(line.newLineNo ?? "").padStart(4);
      const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
      const color = line.type === "added" ? pc.green : line.type === "removed" ? pc.red : pc.dim;
      console.log(`    ${pc.dim(lineNo)} ${color(`${prefix} ${line.content}`)}`);
    }
  }
}

function outputUpdateResult(json: boolean, result: UpdateResult): void {
  if (json) {
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }

  console.log("");

  if (result.blocks.length === 0) {
    console.log(pc.dim("  No blocks tracked. Run 'npx blockend add <block>' to get started."));
    console.log("");
    return;
  }

  const upToDate = result.blocks.filter((b) => b.status === "up-to-date");
  const updates = result.blocks.filter((b) => b.status === "update-available");

  if (updates.length > 0) {
    console.log(`  ${pc.bold(pc.yellow("Updates available:"))}\n`);
    for (const block of updates) {
      console.log(
        `    ${pc.yellow("~")} ${pc.bold(block.name)} ${pc.dim(
          `${block.localVersion} → ${block.remoteVersion}`
        )}`
      );
    }
    console.log("");
  }

  if (upToDate.length > 0) {
    console.log(`  ${pc.bold(pc.green("Up to date:"))}`);
    for (const block of upToDate) {
      console.log(`    ${pc.green("✔")} ${block.name} ${pc.dim(`v${block.localVersion}`)}`);
    }
    console.log("");
  }

  // Print diffs if available
  if (result.diffs && Object.keys(result.diffs).length > 0) {
    console.log(`  ${pc.bold(pc.cyan("Change details:"))}`);
    for (const [blockName, diffs] of Object.entries(result.diffs)) {
      console.log(`\n  ${pc.bold(pc.cyan(`▸ ${blockName}`))}`);
      printDiff(diffs);
    }
    console.log("");
  }

  if (result.applied && result.applied.length > 0) {
    outro(pc.green(`✨ Updated ${result.applied.length} block(s) successfully.`));
  } else if (updates.length > 0) {
    outro(`${pc.yellow(`${updates.length} block(s) have updates.`)} Run with --apply to update.`);
  } else {
    outro(pc.green("All tracked blocks are up to date."));
  }
}

// ─── update command ──────────────────────────────────────────────────────────

export async function updateCommand(
  options: { json?: boolean; diff?: boolean; apply?: boolean } = {}
): Promise<UpdateResult> {
  const { json = false, diff = true, apply = false } = options;

  if (!json) {
    console.log("");
    intro(`${pc.bgCyan(pc.black(" blockend "))} ${pc.dim("update")}`);
  }

  const cwd = process.cwd();

  // ── Read blockend.json ──────────────────────────────────────────────────

  const configPath = await findUp("blockend.json", cwd);
  if (!configPath) {
    const error = "blockend.json not found. Run 'npx blockend init' first.";
    if (json) process.stdout.write(JSON.stringify({ blocks: [], error }) + "\n");
    else log.error(error);
    return { blocks: [], error };
  }

  const rootDir = path.dirname(configPath);

  let config: BlockendConfig;
  try {
    config = JSON.parse(await fs.readFile(configPath, "utf-8")) as BlockendConfig;
  } catch {
    const error = "Failed to parse blockend.json.";
    if (json) process.stdout.write(JSON.stringify({ blocks: [], error }) + "\n");
    else log.error(error);
    return { blocks: [], error };
  }

  const physicalBlocksPath = config.paths.blocks;
  const blocksRootAbsolute = path.resolve(rootDir, physicalBlocksPath);
  const envKey = config.environment;
  const aliasBase = config.aliases.blocks;
  const rewriteStrategy = config.importRewriteStrategy ?? "remove";
  const installedRecords: InstalledBlockRecord[] = Array.isArray(config.installed)
    ? config.installed
    : [];

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
    return { blocks: [], error };
  }

  // ── Compare installed blocks with registry ──────────────────────────────

  if (!json) s.start("Comparing versions...");

  const blockResults: UpdateBlockInfo[] = [];
  const diffs: Record<string, FileDiff[]> = {};
  const plans: Record<string, BlockPlan> = {};

  for (const record of installedRecords) {
    const targetFolder = path.resolve(blocksRootAbsolute, record.name);
    const planResult = await planBlock(registry, record.name, envKey, {
      recordedVariant: record.variant,
      targetFolder
    });

    if (!planResult.ok) {
      blockResults.push({
        name: record.name,
        localVersion: record.version,
        remoteVersion: "?",
        status: "not-tracked"
      });
      continue;
    }

    const plan = planResult.plan;
    plans[record.name] = plan;

    const remoteVersion = plan.block.version ?? "0.0.0";
    const hasUpdate = record.version !== remoteVersion || record.contentHash === "0";

    blockResults.push({
      name: record.name,
      localVersion: record.version,
      remoteVersion,
      status: hasUpdate ? "update-available" : "up-to-date"
    });

    // Build diff for blocks with updates
    if (hasUpdate && diff) {
      const previews = await previewBlock(plan, {
        source,
        targetFolder,
        onDownloadError: "empty"
      });

      diffs[record.name] = previews.map((preview) => {
        if (preview.existingContent === null) {
          return {
            name: preview.name,
            file: preview.name,
            status: "added" as const,
            lines: preview.newContent.split("\n").map((line, index) => ({
              type: "added" as const,
              content: line,
              newLineNo: index + 1
            }))
          };
        }

        if (preview.existingContent !== preview.newContent) {
          return {
            name: preview.name,
            file: preview.name,
            status: "modified" as const,
            lines: computeLineDiff(preview.existingContent, preview.newContent)
          };
        }

        return {
          name: preview.name,
          file: preview.name,
          status: "unchanged" as const,
          lines: []
        };
      });
    }
  }

  if (!json) s.stop("Comparison complete.");

  // ── Apply mode: let user select blocks to update ────────────────────────

  const updateableBlocks = blockResults.filter((b) => b.status === "update-available");

  if (apply && updateableBlocks.length > 0) {
    let selectedNames: string[];

    if (json) {
      // In JSON mode, apply all updates
      selectedNames = updateableBlocks.map((b) => b.name);
    } else {
      const multiPrompt = await multiselect({
        message: "Select blocks to update (space to select, enter to confirm):",
        options: updateableBlocks.map((b) => ({
          value: b.name,
          label: `${pc.bold(pc.cyan(b.name))} ${pc.dim(`${b.localVersion} → ${b.remoteVersion}`)}`
        }))
      });
      handleCancel(multiPrompt);
      selectedNames = multiPrompt as string[];
    }

    if (selectedNames.length === 0) {
      if (!json) outro(pc.dim("No blocks selected."));
      return { blocks: blockResults, diffs };
    }

    // Confirm before applying
    if (!json) {
      const proceed = await confirm({
        message: `Update ${selectedNames.length} block(s)? This will overwrite local files.`,
        initialValue: true
      });
      handleCancel(proceed);
      if (!proceed) {
        outro(pc.dim("Update cancelled."));
        return { blocks: blockResults, diffs };
      }
    }

    const applied: string[] = [];

    for (const blockName of selectedNames) {
      const plan = plans[blockName];
      if (!plan) continue;

      try {
        await applyBlock(plan, {
          source,
          blocksRoot: blocksRootAbsolute,
          aliasBase,
          rewriteStrategy,
          configPath
        });

        applied.push(blockName);
        if (!json)
          log.info(`  ${pc.green("✔")} ${blockName} updated to v${plan.block.version ?? "0.0.0"}`);
      } catch (err) {
        if (!json) log.error(`  ${pc.red("✖")} ${blockName}: ${String(err)}`);
      }
    }

    const result: UpdateResult = { blocks: blockResults, applied, diffs };
    outputUpdateResult(json, result);
    return result;
  }

  // ── Default: read-only comparison ───────────────────────────────────────

  const result: UpdateResult = { blocks: blockResults, diffs };
  outputUpdateResult(json, result);
  return result;
}
