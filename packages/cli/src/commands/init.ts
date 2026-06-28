/* eslint-disable no-console */
import path, { join } from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { intro, outro, select, text, confirm, spinner, isCancel } from "@clack/prompts";

import { detectProject } from "@blockend/detector";
import { format } from "../ui/format.js";

export async function initCommand() {
  const cwd = process.cwd();
  const configPath = join(cwd, "blockend.json");

  // -------------------------
  // Banner / Intro
  // -------------------------
  console.log(`
██████╗ ██╗       ██████╗  ██████╗██╗  ██╗███████╗███╗   ██╗██████╗
██╔══██╗██║      ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝████╗  ██║██╔══██╗
██████╔╝██║      ██║   ██║██║     █████╔╝ █████╗  ██╔██╗ ██║██║  ██║
██╔══██╗██║      ██║   ██║██║     ██╔═██╗ ██╔══╝  ██║╚██╗██║██║  ██║
██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗███████╗██║ ╚████║██████╔╝
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═════╝
`);

  intro(format.title("Blockend · Intelligent Backend Blocks Setup"));

  // -------------------------
  // Existing config check
  // -------------------------
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

  // -------------------------
  // Project Fingerprinting Phase
  // -------------------------
  const s = spinner();

  s.start("Scanning project structure...");
  const context = await detectProject(cwd);
  s.stop(format.success("Project structure detected"));

  s.start("Analyzing framework signals...");
  await new Promise((r) => setTimeout(r, 400));
  s.stop(format.success(`Detected ${context.framework || "unknown"} environment`));

  s.start("Resolving alias mappings...");
  await new Promise((r) => setTimeout(r, 300));
  s.stop(format.success("Import strategy mapped"));

  console.log(
    format.muted(
      `System: ${context.framework || "unknown"} · ${
        context.language || "ts"
      } · aliases=${Object.keys(context.aliasMap || {}).length}`
    )
  );

  // -------------------------
  // Framework & Language Selections
  // -------------------------
  const framework = await select({
    message: "Confirm framework environment",
    initialValue: context.framework || "express",
    options: [
      { value: "express", label: "Express.js" },
      { value: "fastify", label: "Fastify" },
      { value: "next", label: "Next.js (App Router)" },
      { value: "hono", label: "Hono" }
    ]
  });

  if (isCancel(framework)) {
    outro(format.muted("Initialization cancelled."));
    return;
  }

  // -------------------------
  // Alias & Path Resolution Strategy
  // -------------------------
  const availableAliases = Object.keys(context.aliasMap || {});
  const baseAliasToken = availableAliases.length > 0 ? availableAliases[0] : "@/";

  const blockAliasInput = await text({
    message: "Configure blocks import alias",
    initialValue: `${baseAliasToken}blocks`,
    placeholder: `${baseAliasToken}blocks`
  });

  if (isCancel(blockAliasInput)) {
    outro(format.muted("Initialization cancelled."));
    return;
  }

  const blockAlias = String(blockAliasInput);
  const aliasPrefix = availableAliases.find((a) => blockAlias.startsWith(a)) || "";
  const physicalPrefix = aliasPrefix ? context.aliasMap[aliasPrefix] : "./";

  const resolvedSubDir = blockAlias.replace(aliasPrefix, "");
  const assumedPhysicalDir = join(physicalPrefix, resolvedSubDir);

  const relativeBlocksPath = path.relative(cwd, path.resolve(cwd, assumedPhysicalDir));
  const normalizedPath = relativeBlocksPath.replace(/\\/g, "/");
  const finalPath = normalizedPath.startsWith(".") ? normalizedPath : `./${normalizedPath}`;

  // -------------------------
  // Infrastructure Flags (Redis)
  // -------------------------
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

  // -------------------------
  // Construct Configuration Payload
  // -------------------------
  const configPayload: configPayloadType = {
    $schema: "https://blockend.dev/schema.json",
    environment: framework as "express" | "fastify" | "hono" | "next",
    language: "typescript",
    includeRedis,
    aliases: {
      blocks: blockAlias
    },
    paths: {
      blocks: finalPath
    }
  };

  // -------------------------
  // Write Config Target payload
  // -------------------------
  const writeSpinner = spinner();
  writeSpinner.start("Finalizing configuration...");

  try {
    await fs.writeFile(configPath, JSON.stringify(configPayload, null, 2), "utf-8");
    writeSpinner.stop(format.success("blockend.json ready"));

    outro(format.title("Blockend initialized successfully. Run: npx blockend add <block>"));
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
