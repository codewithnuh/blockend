/* oxlint-disable no-console */
import fs from "fs/promises";
import pc from "picocolors";
import { outro, spinner } from "@clack/prompts";
import {
  createGitHubRegistrySource,
  findUp,
  listAvailableBlocks,
  loadRegistry,
  type BlockendConfig,
  type RegistryManifest
} from "../block-install/index.js";

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

  let config: BlockendConfig;
  try {
    const configFile = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(configFile) as BlockendConfig;
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
  const source = createGitHubRegistrySource();
  const s = spinner();

  if (!json) {
    s.start("Syncing registry metadata blocks...");
  }

  let registry: RegistryManifest;
  try {
    registry = await loadRegistry(source);
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

  const available = await listAvailableBlocks(registry, envKey);
  const blocksForEnv = available.map((block) => ({
    name: block.name,
    description: block.description,
    variants: block.variants
  }));

  if (json) {
    process.stdout.write(
      JSON.stringify({ success: true, environment: envKey, blocks: blocksForEnv }) + "\n"
    );
  } else {
    console.log(`\nAvailable backend blocks for ${pc.magenta(envKey)}:`);
    if (blocksForEnv.length === 0) {
      console.log(pc.dim("  No blocks found for this framework."));
    } else {
      blocksForEnv.forEach((block) => {
        console.log(`\n  ${pc.cyan(block.name)}`);
        console.log(`    ${pc.dim(block.description)}`);
        console.log(
          `    Storage Variants: ${block.variants.map((variant) => pc.yellow(variant)).join(", ")}`
        );
      });
      console.log();
    }
  }
}
