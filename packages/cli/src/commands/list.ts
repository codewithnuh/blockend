/* eslint-disable no-console */
import { dirname, join } from "path";
import fs from "fs/promises";
import pc from "picocolors";
import { outro, spinner } from "@clack/prompts";
import { configPayloadType } from "./init.js";
import { RegistryManifest, BlockManifest } from "./add.js";

const REPO_OWNER = "codewithnuh";
const REPO_NAME = "blockend";
const BRANCH = "master";
const MANIFEST_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/registry/index.json`;

async function findUp(filename: string, startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    const checkPath = join(dir, filename);
    try {
      await fs.access(checkPath);
      return checkPath;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

export async function listCommand(options: { json?: boolean } = {}): Promise<void> {
  const { json = false } = options;
  const cwd = process.cwd();

  const configPath = await findUp("blockend.json", cwd);
  if (!configPath) {
    if (json) {
      process.stdout.write(
        JSON.stringify({ success: false, error: "blockend.json not found." }) + "\n"
      );
    } else {
      outro(pc.red("✖ blockend.json not found. Run 'npx blockend init' first."));
    }
    return;
  }

  let config: configPayloadType;
  try {
    const configFile = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(configFile) as configPayloadType;
  } catch {
    if (json) {
      process.stdout.write(
        JSON.stringify({ success: false, error: "Failed to parse configuration matrix." }) + "\n"
      );
    } else {
      outro(pc.red("✖ Failed to parse blockend.json layout configuration."));
    }
    return;
  }

  const envKey = String(config.environment);
  const s = spinner();

  if (!json) {
    s.start("Syncing registry metadata blocks...");
  }

  let registry: RegistryManifest;
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    registry = (await response.json()) as RegistryManifest;
    if (!json) s.stop(pc.green("✔ Synced available block registries."));
  } catch {
    if (json) {
      process.stdout.write(
        JSON.stringify({ success: false, error: "Network sync failure." }) + "\n"
      );
    } else {
      s.stop(pc.red("✖ Failed to fetch the component registry from GitHub network paths."));
    }
    return;
  }

  let blockMap: Record<string, BlockManifest> = {};
  if (registry.blocks && typeof registry.blocks === "object" && !Array.isArray(registry.blocks)) {
    blockMap = registry.blocks as Record<string, BlockManifest>;
  } else {
    blockMap = registry as Record<string, BlockManifest>;
  }

  // Filter components matching the system environment adapter signature
  const blocksForEnv = Object.entries(blockMap)
    .filter(([_, block]) => {
      if (!block) return false;
      const hasAdapter = block.adapters?.[envKey] !== undefined;
      const hasEnvironment = block.environments?.[envKey] !== undefined;
      return hasAdapter || hasEnvironment;
    })
    .map(([key, block]) => {
      const context = block.adapters?.[envKey] ?? block.environments?.[envKey];
      return {
        name: key,
        description: block.description,
        variants: Object.keys(context?.variants || {})
      };
    });

  if (json) {
    process.stdout.write(
      JSON.stringify({ success: true, environment: envKey, blocks: blocksForEnv }) + "\n"
    );
  } else {
    console.log(`\nAvailable backend blocks for ${pc.magenta(envKey)}:`);
    if (blocksForEnv.length === 0) {
      console.log(pc.dim("  No blocks found for this framework."));
    } else {
      blocksForEnv.forEach((b) => {
        console.log(`\n  ${pc.cyan(b.name)}`);
        console.log(`    ${pc.dim(b.description)}`);
        console.log(`    Storage Variants: ${b.variants.map((v) => pc.yellow(v)).join(", ")}`);
      });
      console.log();
    }
  }
}
