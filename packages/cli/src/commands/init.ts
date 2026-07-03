/* eslint-disable no-console */
import path, { join } from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { intro, outro, select, text, confirm, spinner, isCancel, log } from "@clack/prompts";
import pc from "picocolors";

import { detectProject } from "../detectors/index.js";
import { format } from "../ui/format.js";
import { theme } from "../ui/theme.js";

async function resolveTsConfigPaths(cwd: string) {
  const possiblePaths = [join(cwd, "tsconfig.json"), join(cwd, "jsconfig.json")];

  for (const configPath of possiblePaths) {
    if (existsSync(configPath)) {
      try {
        const rawContent = await fs.readFile(configPath, "utf-8");
        const cleanJsonContent = rawContent.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1");
        const parsed = JSON.parse(cleanJsonContent);

        const baseUrl = parsed.compilerOptions?.baseUrl || ".";
        const paths = parsed.compilerOptions?.paths || {};

        return { baseUrl, paths };
      } catch {
        // Fall back to defaults
      }
    }
  }
  return { baseUrl: ".", paths: {} as Record<string, string[]> };
}

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
    console.log(""); // Empty line for breathing room
    intro(`${pc.bgCyan(pc.black(" blockend "))} ${theme.text.muted("setup")}`);
  }

  if (existsSync(configPath)) {
    let action: string;
    if (yes) {
      action = "overwrite";
    } else {
      const actionPrompt = await select({
        message: "A blockend.json configuration already exists. What would you like to do?",
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

  const s = spinner();
  if (!json) s.start("Scanning project architecture...");

  const context = await detectProject(cwd);
  const hasSrcDir = existsSync(join(cwd, "src"));
  const tsConfig = await resolveTsConfigPaths(cwd);

  if (!json) s.stop("Project scanned.");

  let framework = context.framework;

  if (!framework) {
    if (yes) {
      framework = "express"; // Fallback rule for automation environments
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

  const defaultDir = hasSrcDir ? "src/blocks" : "blocks";
  let rawPhysicalInput = defaultDir;

  if (!yes) {
    const directoryPrompt = await text({
      message: "Where would you like to install blocks?",
      placeholder: defaultDir,
      initialValue: defaultDir,
      validate(value) {
        if (value?.trim().length === 0) return "Directory path cannot be empty.";
      }
    });

    if (isCancel(directoryPrompt)) {
      outro(format.muted("Setup cancelled."));
      return;
    }
    rawPhysicalInput = String(directoryPrompt).trim();
  }

  const relativeBlocksPath = path.relative(cwd, path.resolve(cwd, rawPhysicalInput));
  let finalPath = relativeBlocksPath.replace(/\\/g, "/");
  if (!finalPath.startsWith(".") && !finalPath.startsWith("/")) {
    finalPath = `./${finalPath}`;
  }

  let finalBlockAlias = "@/blocks";
  const configuredAliases = Object.keys(tsConfig.paths);

  if (configuredAliases.length > 0) {
    const matchedAliasKey = configuredAliases.find((alias) => {
      const targets = tsConfig.paths[alias];
      if (Array.isArray(targets) && targets.length > 0) {
        const targetSubPath = targets[0].replace(/\*$/, "").replace(/\\/g, "/");
        return finalPath.replace(/^\.\//, "").startsWith(targetSubPath);
      }
      return false;
    });

    if (matchedAliasKey) {
      const cleanKey = matchedAliasKey.replace(/\*$/, "");
      const targets = tsConfig.paths[matchedAliasKey];
      const targetSubPath = targets[0].replace(/\*$/, "").replace(/\\/g, "/");
      const relativeSuffix = finalPath.replace(/^\.\//, "").replace(targetSubPath, "");
      finalBlockAlias = `${cleanKey}${relativeSuffix}`.replace(/\/$/, "");
    } else {
      const primaryAlias = configuredAliases.find((k) => k.startsWith("@")) || configuredAliases[0];
      const inferredBaseAlias = primaryAlias.replace(/\*$/, "");
      const folderSegmentName = path.basename(finalPath);
      finalBlockAlias = `${inferredBaseAlias}${folderSegmentName}`;
    }
  } else {
    const folderSegmentName = path.basename(finalPath);
    finalBlockAlias = `@/${folderSegmentName}`;
  }

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

  const configPayload: configPayloadType = {
    $schema: "https://blockend.dev/schema.json",
    environment: (framework || "express") as "express" | "fastify" | "hono" | "next",
    language: context.language || "typescript",
    includeRedis,
    aliases: {
      blocks: finalBlockAlias
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
      message: "Blockend initialized successfully! Run: npx blockend add <block>",
      config: configPayload
    });
  } catch {
    if (!json) {
      s.stop("Failed");
      outputInitError(false, "Failed to write configuration file.");
    } else {
      outputInitError(true, "Failed to write architectural layout configuration map.");
    }
  }
}

export type configPayloadType = {
  $schema: string;
  environment: "express" | "fastify" | "hono" | "next" | "none";
  language: "typescript" | "javascript";
  includeRedis: boolean;
  aliases: {
    blocks: string;
  };
  paths: {
    blocks: string;
  };
};
