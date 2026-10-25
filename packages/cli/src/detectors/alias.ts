/**
 * Converts TypeScript compilerOptions.paths to a flat alias map.
 * Example: { "@/*": ["./src/*"] } -> { "@/": "./src/" }
 */
export function flattenTsPaths(paths: Record<string, string[]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [alias, targets] of Object.entries(paths)) {
    if (Array.isArray(targets) && typeof targets[0] === "string" && targets[0].length > 0) {
      result[alias.replace("/*", "/")] = targets[0].replace("/*", "/");
    }
  }
  return result;
}

/**
 * Given compiler path mappings and the chosen blocks directory (relative to
 * the project root, e.g. "src/blocks"), derives the import alias that
 * TypeScript or JavaScript will resolve to that directory.
 */
export function deriveBlocksAlias(
  tsPaths: Record<string, string[]>,
  blocksPhysicalPath: string
): string | undefined {
  const normalizedBlocksPath = blocksPhysicalPath.replace(/^\.\//, "").replace(/\\/g, "/");

  for (const [aliasKey, targets] of Object.entries(tsPaths)) {
    if (!Array.isArray(targets) || typeof targets[0] !== "string") continue;

    // The first target is canonical; strip trailing /* or / to get the root.
    const rawTarget = targets[0].replace(/\\/g, "/");
    const targetRoot = rawTarget.replace(/\*$/, "").replace(/\/$/, "").replace(/^\.\//, "");

    // The alias prefix: strip trailing /* or /.
    const aliasRoot = aliasKey.replace(/\/\*$/, "").replace(/\*$/, "");

    if (targetRoot === "") {
      // Alias maps to project root ("./") - everything matches.
      return `${aliasRoot}/${normalizedBlocksPath}`.replace(/\/+/g, "/");
    }

    if (normalizedBlocksPath === targetRoot || normalizedBlocksPath.startsWith(`${targetRoot}/`)) {
      // Replace the target prefix with the alias prefix.
      const suffix = normalizedBlocksPath.slice(targetRoot.length).replace(/^\//, "");
      const alias = suffix ? `${aliasRoot}/${suffix}` : aliasRoot;
      return alias.replace(/\/+/g, "/");
    }
  }

  return undefined;
}
