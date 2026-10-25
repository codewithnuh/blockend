import path from "path";
import { loadRecipeCollectionFile, type Recipe } from "@blockend/registry";

export async function loadRecipes(): Promise<Recipe[]> {
  const recipesPath = path.resolve(process.cwd(), "../../registry/recipes.json");
  const collection = await loadRecipeCollectionFile(recipesPath);
  return collection.recipes;
}

export async function getRecipe(slug: string): Promise<Recipe | undefined> {
  const recipes = await loadRecipes();
  return recipes.find((recipe) => recipe.slug === slug);
}
