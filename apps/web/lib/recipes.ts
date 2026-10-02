import fs from "fs/promises";
import path from "path";

export interface Recipe {
  slug: string;
  title: string;
  outcome: string;
  includedBlocks: string[];
  optionalBlocks: string[];
  integrationOrder: string[];
  architecture: {
    overview: string;
    components: Array<{ name: string; description: string; block?: string }>;
  };
  assumptions: string[];
  configuration: Array<{
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }>;
  tradeoffs: Array<{ choice: string; tradeoff: string }>;
  alternatives?: Array<{ title: string; description: string }>;
  failureBehavior: Array<{ scenario: string; behavior: string }>;
  commands: Array<{ label: string; command: string }>;
  relatedContent: Array<{ title: string; href: string }>;
}

interface RecipeCollection {
  version: string;
  recipes: Recipe[];
}

export async function loadRecipes(): Promise<Recipe[]> {
  try {
    const recipesPath = path.resolve(process.cwd(), "../../registry/recipes.json");
    const raw = await fs.readFile(recipesPath, "utf-8");
    const collection = JSON.parse(raw) as RecipeCollection;
    if (!Array.isArray(collection.recipes)) {
      throw new Error('Recipe collection must contain a "recipes" array');
    }
    return collection.recipes;
  } catch (error) {
    console.error("Recipe load failed:", error);
    return [];
  }
}

export async function getRecipe(slug: string): Promise<Recipe | undefined> {
  const recipes = await loadRecipes();
  return recipes.find((recipe) => recipe.slug === slug);
}
