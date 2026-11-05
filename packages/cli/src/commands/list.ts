/* oxlint-disable no-console */
import path from "path";
import fs from "fs/promises";
import pc from "picocolors";
import { outro, spinner } from "@clack/prompts";
import {
  createGitHubRegistrySource,
  listAvailableBlocks,
  loadRecipeCollection,
  loadRegistry,
  type BlockendConfig,
  type RegistryManifest
} from "../block-install/index.js";
import { resolveProjectTarget, targetErrorMessage } from "../workspace/index.js";

export async function listCommand(
  options: { json?: boolean; recipes?: boolean; cwd?: string } = {}
): Promise<void> {
  const { json = false, recipes: listRecipes = false } = options;
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const source = createGitHubRegistrySource();
  const s = spinner();

  // ── Recipes ─────────────────────────────────────────────────────────────
  // Recipes are project-independent, so this path does not need blockend.json.

  if (listRecipes) {
    if (!json) s.start("Fetching published recipes...");

    try {
      const collection = await loadRecipeCollection(source);
      if (!json) s.stop(pc.green("✔ Synced published recipes."));

      const recipes = collection.recipes.map((recipe) => ({
        slug: recipe.slug,
        title: recipe.title,
        outcome: recipe.outcome,
        includedBlocks: recipe.includedBlocks,
        optionalBlocks: recipe.optionalBlocks
      }));

      if (json) {
        process.stdout.write(JSON.stringify({ success: true, recipes }) + "\n");
      } else {
        console.log(`\nPublished recipes:`);
        if (recipes.length === 0) {
          console.log(pc.dim("  No recipes published yet."));
        } else {
          recipes.forEach((recipe) => {
            console.log(`\n  ${pc.cyan(recipe.slug)} ${pc.dim(`— ${recipe.title}`)}`);
            console.log(`    ${pc.dim(recipe.outcome)}`);
            console.log(
              `    Blocks: ${recipe.includedBlocks.map((block) => pc.yellow(block)).join(", ")}`
            );
            if (recipe.optionalBlocks.length > 0) {
              console.log(
                `    Optional: ${recipe.optionalBlocks.map((block) => pc.yellow(block)).join(", ")}`
              );
            }
          });
          console.log(`\n${pc.dim("  Add one with: blockend add --recipe <slug>")}\n`);
        }
      }
    } catch (error) {
      if (json) {
        process.stdout.write(
          JSON.stringify({ success: false, error: "Failed to fetch recipes from GitHub." }) + "\n"
        );
      } else {
        s.stop(pc.red("✖ Failed to fetch the recipe collection from GitHub."));
        console.error(pc.dim(String(error)));
      }
    }
    return;
  }

  const target = await resolveProjectTarget(cwd, { command: "list", interactive: !json });
  if (target.kind === "cancelled") {
    outro(pc.dim("Operation cancelled."));
    return;
  }
  if (target.kind !== "package") {
    const error = targetErrorMessage(target) ?? "Could not resolve a target project.";
    if (json) {
      process.stdout.write(JSON.stringify({ success: false, error }) + "\n");
    } else {
      outro(pc.red(`✖ ${error}`));
    }
    return;
  }
  const configPath = target.configPath;

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
