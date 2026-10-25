/* oxlint-disable no-console */
import path, { join } from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { intro, outro, select, text, confirm, spinner, isCancel, log } from "@clack/prompts";
import pc from "picocolors";

import { detectProject } from "../detectors/index.js";
import { format } from "../ui/format.js";
import { theme } from "../ui/theme.js";
import type { BlockendConfig } from "../block-install/index.js";

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
  result: { success: boolean; message: string; config?: BlockendConfig }
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

  // ── Blocks directory ──────────────────────────────────────────────────────

  const hasSrcDir = existsSync(join(cwd, "src"));
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

  // ── Detect project ────────────────────────────────────────────────────────

  const s = spinner();
  if (!json) s.start("Scanning project architecture...");

  const context = await detectProject(cwd, { blocksDir: rawPhysicalInput });

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

  // Normalise to a clean relative path with leading ./
  const relativeBlocksPath = path.relative(cwd, context.blocksDir).replace(/\\/g, "/");

  // Store with leading ./ so it is unambiguous in blockend.json
  const finalPath = relativeBlocksPath.startsWith(".")
    ? relativeBlocksPath
    : `./${relativeBlocksPath}`;

  // ── Import alias ──────────────────────────────────────────────────────────

  const finalBlockAlias = context.blocksAlias;

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

  const configPayload: BlockendConfig = {
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
