/* eslint-disable no-console */
import path, { join } from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { intro, outro, select, text, confirm, spinner, isCancel, log } from "@clack/prompts";
import pc from "picocolors";

import { detectProject } from "../detectors/index.js";
import { format } from "../ui/format.js";
import { theme } from "../ui/theme.js";

// ─── tsconfig path alias resolution ────────────────────────────────────────────

interface TsConfigPaths {
  baseUrl: string;
  paths: Record<string, string[]>;
}

async function resolveTsConfigPaths(cwd: string): Promise<TsConfigPaths> {
  const candidates = [join(cwd, "tsconfig.json"), join(cwd, "jsconfig.json")];

  for (const configPath of candidates) {
    if (!existsSync(configPath)) continue;
    try {
      const raw = await fs.readFile(configPath, "utf-8");
      // Strip block comments and single-line comments (tsconfig allows them)
      const clean = raw.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");
      const parsed = JSON.parse(clean);
      return {
        baseUrl: parsed.compilerOptions?.baseUrl ?? ".",
        paths: (parsed.compilerOptions?.paths ?? {}) as Record<string, string[]>
      };
    } catch {
      // Malformed config — fall through to next candidate
    }
  }

  return { baseUrl: ".", paths: {} };
}

/**
 * Given the tsconfig paths map and the chosen physical blocks directory
 * (relative to project root, e.g. "src/blocks"), derive the import alias
 * that TypeScript will resolve to that directory.
 */
function deriveBlockAlias(
  tsPaths: Record<string, string[]>,
  blocksPhysicalPath: string // e.g. "src/blocks" (no leading ./)
): string | undefined {
  const normalizedBlocksPath = blocksPhysicalPath
    .replace(/^\.\//, "") // strip leading ./
    .replace(/\\/g, "/"); // normalise windows separators

  for (const [aliasKey, targets] of Object.entries(tsPaths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;

    // The first target is canonical; strip trailing /* or / to get the root
    const rawTarget = targets[0].replace(/\\/g, "/");
    const targetRoot = rawTarget
      .replace(/\*$/, "") // strip trailing glob *
      .replace(/\/$/, "") // strip trailing slash
      .replace(/^\.\//, ""); // strip leading ./

    // The alias prefix: strip trailing /* or /
    const aliasRoot = aliasKey
      .replace(/\/\*$/, "") // strip /*
      .replace(/\*$/, ""); // strip bare *

    if (targetRoot === "") {
      // Alias maps to project root ("./") — everything matches
      return `${aliasRoot}/${normalizedBlocksPath}`.replace(/\/+/g, "/");
    }

    if (normalizedBlocksPath === targetRoot || normalizedBlocksPath.startsWith(`${targetRoot}/`)) {
      // Replace the target prefix with the alias prefix
      const suffix = normalizedBlocksPath.slice(targetRoot.length).replace(/^\//, "");
      const alias = suffix ? `${aliasRoot}/${suffix}` : aliasRoot;
      return alias.replace(/\/+/g, "/");
    }
  }

  return undefined;
}

// ─── output helpers ─────────────────────────────────────────────────────────

function outputInitError(json: boolean, message: string): void {
  if (json) {
    process.stdout.write(JSON.stringify({ success: false, error: message }) + "\n");
  } else {
    log.error(format.error(message));
    process.exit(1);
  }
}

function outputInitResult(
  json: boolean,
  result: { success: boolean; message: string; config?: configPayloadType }
): void {
  if (json) {
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    outro(theme.state.success(result.message));
  }
}

// ─── init command ────────────────────────────────────────────────────────────

export async function initCommand(
  options: {
    yes?: boolean;
    json?: boolean;
  } = {}
): Promise<void> {
  const { yes = false, json = false } = options;
  const cwd = process.cwd();
  const configPath = join(cwd, "blockend.json");

  if (!json) {
    console.log("");
    intro(`${pc.bgCyan(pc.black(" blockend "))} ${theme.text.muted("setup")}`);
  }

  // ── Handle existing config ────────────────────────────────────────────────

  if (existsSync(configPath)) {
    let action: string;

    if (yes) {
      action = "overwrite";
    } else {
      const actionPrompt = await select({
        message: "A blockend.json already exists. What would you like to do?",
        options: [
          { value: "keep", label: "Keep existing (cancel setup)" },
          { value: "overwrite", label: "Overwrite current configuration" },
          { value: "regenerate", label: "Delete and regenerate from scratch" }
        ]
      });

      if (isCancel(actionPrompt) || actionPrompt === "keep") {
        if (json) {
          outputInitResult(json, {
            success: false,
            message: "Setup cancelled. Existing config preserved."
          });
        } else {
          outro(format.muted("Setup cancelled. Existing config preserved."));
        }
        return;
      }
      action = actionPrompt as string;
    }

    if (action === "regenerate") {
      await fs.unlink(configPath);
      if (!json) log.warn("Existing configuration deleted.");
    }
  }

  // ── Detect project ────────────────────────────────────────────────────────

  const s = spinner();
  if (!json) s.start("Scanning project architecture...");

  const context = await detectProject(cwd);
  const hasSrcDir = existsSync(join(cwd, "src"));
  const tsConfig = await resolveTsConfigPaths(cwd);

  if (!json) s.stop("Project scanned.");

  // ── Framework selection ───────────────────────────────────────────────────

  let framework = context.framework;

  if (!framework) {
    if (yes) {
      framework = "express";
    } else {
      const frameworkSelect = await select({
        message: "Which framework does this project use?",
        options: [
          { value: "express", label: "Express.js" },
          { value: "fastify", label: "Fastify" },
          { value: "next", label: "Next.js (App Router)" },
          { value: "hono", label: "Hono" }
        ]
      });

      if (isCancel(frameworkSelect)) {
        if (json) {
          outputInitResult(json, { success: false, message: "Setup cancelled." });
        } else {
          outro(format.muted("Setup cancelled."));
        }
        return;
      }
      framework = frameworkSelect as "express" | "fastify" | "hono" | "next";
    }
  } else if (!json) {
    log.info(`Framework detected: ${theme.state.info(framework)}`);
  }

  // ── Blocks directory ──────────────────────────────────────────────────────

  const defaultDir = hasSrcDir ? "src/blocks" : "blocks";
  let rawPhysicalInput = defaultDir;

  if (!yes) {
    const directoryPrompt = await text({
      message: "Where would you like to install blocks?",
      placeholder: defaultDir,
      initialValue: defaultDir,
      validate(value) {
        if (!value || value.trim().length === 0) return "Directory path cannot be empty.";
      }
    });

    if (isCancel(directoryPrompt)) {
      outro(format.muted("Setup cancelled."));
      return;
    }
    rawPhysicalInput = String(directoryPrompt).trim();
  }

  // Normalise to a clean relative path with leading ./
  const relativeBlocksPath = path
    .relative(cwd, path.resolve(cwd, rawPhysicalInput))
    .replace(/\\/g, "/");

  // Store with leading ./ so it is unambiguous in blockend.json
  const finalPath = relativeBlocksPath.startsWith(".")
    ? relativeBlocksPath
    : `./${relativeBlocksPath}`;

  // ── Alias derivation ──────────────────────────────────────────────────────

  const hasTsPaths = Object.keys(tsConfig.paths).length > 0;

  const finalBlockAlias = hasTsPaths
    ? deriveBlockAlias(tsConfig.paths, relativeBlocksPath)
    : undefined;

  if (!json) {
    log.info(
      `Import alias: ${theme.state.info(finalBlockAlias === undefined ? " relative imports" : finalBlockAlias)}`
    );

    // Log the underlying file strategy for extra clarity during setup
    const strategyDisplay =
      context.importRewriteStrategy === "rewrite"
        ? "NodeNext (append .js)"
        : "Bundler / Extensionless";
    log.info(`Import strategy: ${theme.state.info(strategyDisplay)}`);
  }

  // ── Redis ─────────────────────────────────────────────────────────────────

  let includeRedis = false;
  if (context.hasRedis) {
    if (yes) {
      includeRedis = true;
    } else {
      const redisConfirm = await confirm({
        message: "Redis detected in project. Enable Redis-backed variants?",
        initialValue: true
      });
      if (!isCancel(redisConfirm)) {
        includeRedis = Boolean(redisConfirm);
      }
    }
  }

  // ── Write config ──────────────────────────────────────────────────────────

  const configPayload: configPayloadType = {
    $schema: "https://blockend.noorulhassan.com/schema.json",
    environment: (framework || "express") as "express" | "fastify" | "hono" | "next",
    language: context.language || "typescript",
    packageManager: context.packageManager,
    importRewriteStrategy: context.importRewriteStrategy, // PERSIST STRATEGY TO DISK
    includeRedis,
    aliases: {
      ...(finalBlockAlias ? { blocks: finalBlockAlias } : {})
    },
    paths: {
      blocks: finalPath
    }
  };

  if (!json) s.start("Writing configuration...");

  try {
    await fs.writeFile(configPath, JSON.stringify(configPayload, null, 2), "utf-8");
    if (!json) s.stop("Configuration saved.");

    outputInitResult(json, {
      success: true,
      message: "Blockend initialized! Run: npx blockend add <block>",
      config: configPayload
    });
  } catch {
    if (!json) {
      s.stop("Failed");
      outputInitError(false, "Failed to write configuration file.");
    } else {
      outputInitError(true, "Failed to write configuration file.");
    }
  }
}

export type configPayloadType = {
  $schema: string;
  environment: "express" | "fastify" | "hono" | "next" | "none";
  language: "typescript" | "javascript";
  packageManager: string;
  importRewriteStrategy: "rewrite" | "remove"; // Explicit type definition updates
  includeRedis: boolean;
  aliases: {
    blocks?: string;
  };
  paths: {
    blocks: string;
  };
};
