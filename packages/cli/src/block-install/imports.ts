import path, { dirname } from "path";

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

/**
 * Rewrites imports inside a downloaded file to use path aliases and appends/removes
 * extensions according to the project's config strategy.
 */
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
      // Remove any trailing .ts/tsx/mts/cts extensions if present
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
