/* oxlint-disable no-console */
import path from "node:path";
import {
  loadRecipeCollectionFile,
  loadRegistryFile,
  validateRecipes,
  type RecipeCollection,
  type Registry
} from "../packages/registry/src/index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

async function main(): Promise<void> {
  const recipesPath =
    process.env.TEST_RECIPES_PATH ?? path.join(REPO_ROOT, "registry", "recipes.json");
  const registryPath =
    process.env.TEST_REGISTRY_PATH ?? path.join(REPO_ROOT, "registry", "index.json");

  let collection: RecipeCollection;
  let registry: Registry;
  try {
    [collection, registry] = await Promise.all([
      loadRecipeCollectionFile(recipesPath),
      loadRegistryFile(registryPath)
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✖ Recipe validation failed\n  ${message}\n`);
    process.exitCode = 1;
    return;
  }

  const errors = validateRecipes(collection, registry);
  if (errors.length === 0) {
    console.log(`✓ Recipes valid - ${collection.recipes.length} recipe(s) verified\n`);
    return;
  }

  console.error(`\nRecipe validation failed - ${errors.length} error(s):\n`);
  for (const error of errors) console.error(`${error.toString()}\n`);
  process.exitCode = 1;
}

void main();
