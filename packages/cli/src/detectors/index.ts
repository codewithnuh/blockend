import path, { join } from "path";
import type { ProjectContext } from "../types/index.js";
import { readPackageJson } from "./readers/package.js";
import { readCompilerConfig } from "./readers/tsconfig.js";
import { inferSrcDir } from "./readers/filesystem.js";
import { detectFramework } from "./framework.js";
import { detectRuntime } from "./runtime.js";
import { detectPackageManager } from "./package-manager.js";
import { deriveBlocksAlias, flattenTsPaths } from "./alias.js";

export interface DetectProjectOptions {
  /**
   * Absolute or root-relative directory where block files will be installed.
   * Defaults to the conventional srcDir/lib/blocks location.
   */
  blocksDir?: string;
}

/**
 * Analyzes a project directory and returns a ProjectContext.
 * This is the single entry point for all detection logic.
 */
export async function detectProject(
  cwd: string,
  options: DetectProjectOptions = {}
): Promise<ProjectContext> {
  const [pkg, compilerConfig] = await Promise.all([readPackageJson(cwd), readCompilerConfig(cwd)]);
  const allDeps: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies
  };

  const srcDir = await inferSrcDir(cwd);
  const compilerOptions = compilerConfig?.config.compilerOptions;
  const moduleOpt = compilerOptions?.module?.toLocaleLowerCase();
  const resolutionOpt = compilerOptions?.moduleResolution?.toLocaleLowerCase();
  let importRewriteStrategy: "rewrite" | "remove" = "remove";
  if (
    moduleOpt === "nodenext" ||
    moduleOpt === "node16" ||
    resolutionOpt === "nodenext" ||
    resolutionOpt === "node16" ||
    (pkg.type === "module" && !resolutionOpt) // Pure Node ESM fallback rule
  ) {
    importRewriteStrategy = "rewrite";
  }

  const blocksDir = options.blocksDir
    ? path.resolve(cwd, options.blocksDir)
    : join(srcDir, "lib", "blocks");
  const relativeBlocksDir = path.relative(cwd, blocksDir).replace(/\\/g, "/");
  const tsPaths = compilerOptions?.paths;

  return {
    root: cwd,
    language: compilerConfig?.kind === "tsconfig" ? "typescript" : "javascript",
    runtime: detectRuntime(allDeps),
    framework: detectFramework(allDeps),
    packageManager: detectPackageManager(cwd),
    hasRedis: "ioredis" in allDeps || "redis" in allDeps,
    hasPrisma: "@prisma/client" in allDeps,
    hasDrizzle: "drizzle-orm" in allDeps,
    aliasMap: tsPaths ? flattenTsPaths(tsPaths) : {},
    srcDir,
    blocksDir,
    blocksAlias: tsPaths ? deriveBlocksAlias(tsPaths, relativeBlocksDir) : undefined,
    importRewriteStrategy
  };
}
