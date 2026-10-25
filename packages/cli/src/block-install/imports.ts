import path, { dirname } from "path";

/**
 * Given a relative import path and the directory of the file containing it,
 * checks whether a downloaded index file lives in the resolved directory.
 * Downloaded target paths are relative to the block folder, not the importing
 * file's directory.
 */
function resolveIndexImport(
  importPath: string,
  sourceFileDir: string,
  downloadedFiles: Set<string>,
  blockRoot: string
): boolean {
  const resolved = path.resolve(sourceFileDir, importPath);
  // Check if any downloaded file is an index file inside this directory
  for (const downloaded of downloadedFiles) {
    const downloadedAbs = path.resolve(blockRoot, downloaded);
    const dirOfDownloaded = dirname(downloadedAbs);
    const basenameOfDownloaded = path.basename(downloadedAbs);
    if (dirOfDownloaded === resolved && basenameOfDownloaded.startsWith("index.")) {
      return true;
    }
  }
  return false;
}

/**
 * Rewrites imports inside a downloaded file to use path aliases and appends/removes
 * extensions according to the project's config strategy.
 * `blockRoot` is the block folder that downloaded target paths are relative to.
 */
export function rewriteFileImports(
  fileContent: string,
  writtenFilePath: string,
  blocksRoot: string,
  aliasBase: string | undefined,
  strategy: "rewrite" | "remove",
  downloadedFiles: Set<string> = new Set<string>(),
  blockRoot: string = dirname(writtenFilePath)
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
      // Remove any trailing .ts/tsx/mts/cts extensions if present
      targetPath = targetPath.replace(/\.(ts|tsx|mts|cts)$/, "");

      // Smart index resolution: check if this path points to a directory with index.ts
      // e.g., "./types" → "./types/index" when types/index.ts exists
      if (downloadedFiles.size > 0) {
        if (resolveIndexImport(importPath, fileDir, downloadedFiles, blockRoot)) {
          targetPath = `${targetPath}/index`;
        }
      }

      targetPath = `${targetPath}.js`;
    } else if (strategy === "remove" && hasJsExt) {
      targetPath = targetPath.slice(0, -3);
    }

    return `${keyword}${openQuote}${targetPath}${closeQuote}`;
  });
}
