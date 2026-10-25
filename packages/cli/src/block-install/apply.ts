import path, { dirname } from "path";
import fs from "fs/promises";
import type { AppliedBlock, ApplyBlockOptions, BlockPlan, InstalledBlockRecord } from "./types.js";
import { rewriteFileImports } from "./imports.js";
import { recordInstalledBlock } from "./config.js";

function hashContent(content: string, previous: number): number {
  let hash = previous;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Download a plan, rewrite its imports, write every file, and update the
 * installed record in blockend.json.
 */
export async function applyBlock(
  plan: BlockPlan,
  options: ApplyBlockOptions
): Promise<AppliedBlock> {
  const targetFolder = path.resolve(options.blocksRoot, plan.blockName);
  const downloadedTargets = new Set(plan.files.map((file) => file.target));

  // Pass 1: download everything before touching disk. A failed download must
  // not leave a half-written block behind.
  const downloaded: Array<{ file: (typeof plan.files)[number]; raw: string }> = [];
  for (const file of plan.files) {
    downloaded.push({ file, raw: await options.source.fetchFile(file.source) });
  }

  // Pass 2: rewrite with full knowledge of the downloaded file set, then write.
  const filesWritten: string[] = [];
  let contentHash = 0;

  for (const { file, raw } of downloaded) {
    const writtenFilePath = path.join(targetFolder, file.target);
    const content = rewriteFileImports(
      raw,
      writtenFilePath,
      options.blocksRoot,
      options.aliasBase,
      options.rewriteStrategy,
      downloadedTargets
    );

    await fs.mkdir(dirname(writtenFilePath), { recursive: true });
    await fs.writeFile(writtenFilePath, content, "utf-8");
    filesWritten.push(writtenFilePath);
    contentHash = hashContent(content, contentHash);
  }

  const record: InstalledBlockRecord = {
    name: plan.blockName,
    version: plan.block.version ?? "0.0.0",
    installedAt: new Date().toISOString(),
    files: filesWritten.map((file) => path.relative(targetFolder, file).replace(/\\/g, "/")),
    contentHash: contentHash.toString(16),
    variant: plan.variant
  };

  await recordInstalledBlock(options.configPath, record);

  return {
    block: plan.blockName,
    variant: plan.variant,
    files: filesWritten,
    record
  };
}
