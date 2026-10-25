import path from "path";
import fs from "fs/promises";
import type { BlockPlan, PreviewBlockOptions, PreviewFile } from "./types.js";

/**
 * Download a plan's files and compare them with what is on disk.
 * Never writes. The caller decides how to present the result.
 */
export async function previewBlock(
  plan: BlockPlan,
  options: PreviewBlockOptions
): Promise<PreviewFile[]> {
  const previews: PreviewFile[] = [];

  for (const file of plan.files) {
    const targetPath = path.join(options.targetFolder, file.target);

    let newContent: string;
    try {
      newContent = await options.source.fetchFile(file.source);
    } catch (error) {
      if (options.onDownloadError === "empty") {
        newContent = "";
      } else {
        throw error;
      }
    }

    let existingContent: string | null = null;
    let status: PreviewFile["status"] = "new";

    try {
      existingContent = await fs.readFile(targetPath, "utf-8");
      status = existingContent === newContent ? "unchanged" : "modified";
    } catch {
      // Missing or unreadable local file — treat it as new.
    }

    previews.push({
      name: file.target,
      sourcePath: file.source,
      targetPath,
      existingContent,
      newContent,
      status
    });
  }

  return previews;
}
