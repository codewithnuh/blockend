import { parseRecipeCollection, type Recipe, type RecipeCollection } from "@blockend/registry";
import type { RegistrySource } from "./types.js";

/** Registry-relative path of the published recipe collection. */
export const RECIPE_COLLECTION_PATH = "registry/recipes.json";

/**
 * Fetch and parse the published recipe collection through the same registry
 * seam the block manifest uses, so commands never touch the network directly.
 */
export async function loadRecipeCollection(source: RegistrySource): Promise<RecipeCollection> {
  const raw = await source.fetchFile(RECIPE_COLLECTION_PATH);
  try {
    return parseRecipeCollection(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Recipe collection is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

export function findRecipe(collection: RecipeCollection, slug: string): Recipe | undefined {
  return collection.recipes.find((recipe) => recipe.slug === slug);
}

/**
 * The blocks a recipe install covers, in the order they should be applied.
 * Included blocks are always present; optional blocks only when the caller
 * selected them. Order comes from the recipe's integrationOrder so the CLI and
 * the published recipe agree on one sequence.
 */
export function orderRecipeBlocks(recipe: Recipe, selectedOptional: string[] = []): string[] {
  const selected = new Set([...recipe.includedBlocks, ...selectedOptional]);
  return recipe.integrationOrder.filter((slug) => selected.has(slug));
}
