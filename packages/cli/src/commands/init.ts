/* eslint-disable no-console */
import path, { join } from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { intro, outro, select, text, confirm, spinner, isCancel } from "@clack/prompts";

import { detectProject } from "@blockend/detector";
import { format } from "../ui/format.js";
import { theme } from "../ui/theme.js"; // Import your theme tokens safely

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

export async function initCommand() {
  const cwd = process.cwd();
  const configPath = join(cwd, "blockend.json");

  console.log(`
██████╗ ██╗         ██████╗  ██████╗██╗  ██╗███████╗███╗   ██╗██████╗
██╔══██╗██║        ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝████╗  ██║██╔══██╗
██████╔╝██║        ██║   ██║██║     █████╔╝ █████╗  ██╔██╗ ██║██║  ██║
██╔══██╗██║        ██║   ██║██║     ██╔═██╗ ██╔══╝  ██║╚██╗██║██║  ██║
██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗███████╗██║ ╚████║██████╔╝
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═════╝
`);

  // Uses your layout formatting system safely
  intro(theme.brand.primary(" Blockend · Intelligent Backend Blocks Setup "));

  if (existsSync(configPath)) {
    const action = await select({
      message: "blockend.json already exists. What do you want to do?",
      options: [
        { value: "keep", label: "Keep existing config (cancel init)" },
        { value: "overwrite", label: "Overwrite config" },
        { value: "regenerate", label: "Delete and regenerate" }
      ]
    });

    if (isCancel(action) || action === "keep") {
      outro(format.muted("Initialization cancelled. Existing config preserved."));
      return;
    }

    if (action === "regenerate") {
      await fs.unlink(configPath);
      console.log(format.error("Existing config deleted"));
    }
  }

  const s = spinner();
  s.start("Scanning project layout...");
  const context = await detectProject(cwd);
  const hasSrcDir = existsSync(join(cwd, "src"));
  const tsConfig = await resolveTsConfigPaths(cwd);
  s.stop(format.success("Project architecture scanned"));

  let framework = context.framework;
  if (framework) {
    console.log(
      `${format.success("✔")} Framework environment detected: ${theme.state.info(framework)}`
    );
  } else {
    const frameworkSelect = await select({
      message: "Framework could not be auto-detected. Select framework environment manually:",
      options: [
        { value: "express", label: "Express.js" },
        { value: "fastify", label: "Fastify" },
        { value: "next", label: "Next.js (App Router)" },
        { value: "hono", label: "Hono" }
      ]
    });

    if (isCancel(frameworkSelect)) {
      outro(format.muted("Initialization cancelled."));
      return;
    }
    framework = frameworkSelect;
  }

  const defaultDir = hasSrcDir ? "src/blocks" : "blocks";
  const directoryPrompt = await text({
    message: "Configure the targeted physical directory destination for blocks:",
    placeholder: defaultDir,
    initialValue: defaultDir,
    validate(value) {
      if (value?.trim().length === 0) return "Physical path location directory cannot be empty.";
    }
  });

  if (isCancel(directoryPrompt)) {
    outro(format.muted("Initialization cancelled."));
    return;
  }
  const rawPhysicalInput = String(directoryPrompt).trim();

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
    const redisConfirm = await confirm({
      message: "Redis detected. Enable Redis-backed block variants automatically?",
      initialValue: true
    });

    if (!isCancel(redisConfirm)) {
      includeRedis = Boolean(redisConfirm);
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

  const writeSpinner = spinner();
  writeSpinner.start("Finalizing configuration...");

  try {
    await fs.writeFile(configPath, JSON.stringify(configPayload, null, 2), "utf-8");
    writeSpinner.stop(format.success("blockend.json ready"));

    outro(
      theme.state.success("✨ Blockend initialized successfully. Run: npx blockend add <block>")
    );
  } catch {
    writeSpinner.stop(format.error("Failed to write configuration"));
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
