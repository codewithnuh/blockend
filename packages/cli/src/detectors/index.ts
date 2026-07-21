import { join } from "path";
import type { ProjectContext } from "../types/index.js";
import { readPackageJson } from "./readers/package.js";
import { readTsConfig } from "./readers/tsconfig.js";
import { inferSrcDir } from "./readers/filesystem.js";
import { detectFramework } from "./framework.js";
import { detectRuntime } from "./runtime.js";
import { detectPackageManager } from "./package-manager.js";

/**
 * Analyzes a project directory and returns a ProjectContext.
 * This is the single entry point for all detection logic.
 */
export async function detectProject(cwd: string): Promise<ProjectContext> {
  const [pkg, tsConfig] = await Promise.all([readPackageJson(cwd), readTsConfig(cwd)]);
  const allDeps: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies
  };

  const srcDir = await inferSrcDir(cwd);
  const moduleOpt = tsConfig?.compilerOptions?.module?.toLocaleLowerCase();
  const resolutionOpt = tsConfig?.compilerOptions?.moduleResolution?.toLocaleLowerCase();
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

  return {
    root: cwd,
    language: tsConfig !== null ? "typescript" : "javascript",
    runtime: detectRuntime(allDeps),
    framework: detectFramework(allDeps),
    packageManager: detectPackageManager(cwd),
    hasRedis: "ioredis" in allDeps || "redis" in allDeps,
    hasPrisma: "@prisma/client" in allDeps,
    hasDrizzle: "drizzle-orm" in allDeps,
    aliasMap: tsConfig?.compilerOptions?.paths
      ? flattenTsPaths(tsConfig.compilerOptions.paths)
      : {},
    srcDir,
    // Default blocks directory: srcDir/lib/blocks
    blocksDir: join(srcDir, "lib", "blocks"),
    importRewriteStrategy
  };
}

/**
 * Converts TypeScript compilerOptions.paths to a flat alias map.
 * Example: { "@/*": ["./src/*"] } -> { "@/": "./src/" }
 */
function flattenTsPaths(paths: Record<string, string[]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [alias, targets] of Object.entries(paths)) {
    if (targets[0]) {
      result[alias.replace("/*", "/")] = targets[0].replace("/*", "/");
    }
  }
  return result;
}
