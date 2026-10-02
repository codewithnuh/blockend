/* oxlint-disable no-console */
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const BlockSlugPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const nonEmptyString = z.string().min(1, "must not be empty");
const blockSlug = z.string().regex(BlockSlugPattern, "must be a valid registry block slug");
const uniqueBlockSlugs = z
  .array(blockSlug)
  .refine(
    (slugs) => new Set(slugs).size === slugs.length,
    "must not contain duplicate block slugs"
  );
const requiredBlockSlugs = z
  .array(blockSlug)
  .min(1)
  .refine(
    (slugs) => new Set(slugs).size === slugs.length,
    "must not contain duplicate block slugs"
  );

const RecipeSchema = z
  .object({
    slug: blockSlug,
    title: nonEmptyString,
    outcome: nonEmptyString,
    includedBlocks: requiredBlockSlugs,
    optionalBlocks: uniqueBlockSlugs,
    integrationOrder: uniqueBlockSlugs,
    architecture: z
      .object({
        overview: nonEmptyString,
        components: z.array(
          z
            .object({
              name: nonEmptyString,
              description: nonEmptyString,
              block: blockSlug.optional()
            })
            .strict()
        )
      })
      .strict(),
    assumptions: z.array(nonEmptyString),
    configuration: z.array(
      z
        .object({
          name: nonEmptyString,
          description: nonEmptyString,
          required: z.boolean(),
          default: z.string().optional()
        })
        .strict()
    ),
    tradeoffs: z.array(
      z
        .object({
          choice: nonEmptyString,
          tradeoff: nonEmptyString
        })
        .strict()
    ),
    failureBehavior: z.array(
      z
        .object({
          scenario: nonEmptyString,
          behavior: nonEmptyString
        })
        .strict()
    ),
    commands: z.array(
      z
        .object({
          label: nonEmptyString,
          command: nonEmptyString
        })
        .strict()
    ),
    relatedContent: z.array(
      z
        .object({
          title: nonEmptyString,
          href: z.string().regex(/^(https:\/\/|\/)/, "must be an HTTPS URL or site-relative path")
        })
        .strict()
    )
  })
  .strict();

const RecipeCollectionSchema = z
  .object({
    $schema: z.string().optional(),
    version: nonEmptyString,
    recipes: z.array(RecipeSchema)
  })
  .strict();

class ValidationError {
  constructor(recipe, field, message) {
    this.recipe = recipe;
    this.field = field;
    this.message = message;
  }

  toString() {
    const location = this.recipe
      ? `recipes.${this.recipe}${this.field ? `.${this.field}` : ""}`
      : this.field;
    return `  ✗ ${location}\n    ${this.message}`;
  }
}

export function validateStructure(collection) {
  const result = RecipeCollectionSchema.safeParse(collection);
  if (result.success) return { data: result.data, errors: [] };

  return {
    data: null,
    errors: result.error.issues.map(
      (issue) => new ValidationError(null, issue.path.join("."), issue.message)
    )
  };
}

export function checkRecipeRelationships(collection, registry) {
  const errors = [];
  const blocks = registry.blocks ?? {};
  const blockSlugs = new Set(Object.keys(blocks));
  const recipeSlugs = new Set();

  for (const recipe of collection.recipes ?? []) {
    if (recipeSlugs.has(recipe.slug)) {
      errors.push(
        new ValidationError(recipe.slug, "slug", `Duplicate recipe slug "${recipe.slug}"`)
      );
    }
    recipeSlugs.add(recipe.slug);

    const included = new Set(recipe.includedBlocks ?? []);
    const optional = new Set(recipe.optionalBlocks ?? []);
    const allBlocks = new Set([...included, ...optional]);
    const order = recipe.integrationOrder ?? [];
    const orderIndex = new Map(order.map((slug, index) => [slug, index]));
    const reportedConflictPairs = new Set();

    for (const slug of optional) {
      if (included.has(slug)) {
        errors.push(
          new ValidationError(
            recipe.slug,
            "optionalBlocks",
            `Block "${slug}" is both included and optional`
          )
        );
      }
    }

    for (const slug of allBlocks) {
      if (!blockSlugs.has(slug)) {
        errors.push(
          new ValidationError(recipe.slug, "includedBlocks", `Unknown registry block "${slug}"`)
        );
      }
    }

    for (const slug of order) {
      if (!allBlocks.has(slug)) {
        errors.push(
          new ValidationError(
            recipe.slug,
            "integrationOrder",
            `Block "${slug}" is not included or optional`
          )
        );
      }
    }

    for (const slug of allBlocks) {
      if (!orderIndex.has(slug)) {
        errors.push(
          new ValidationError(
            recipe.slug,
            "integrationOrder",
            `Block "${slug}" is missing from integration order`
          )
        );
      }
    }

    for (const slug of allBlocks) {
      const block = blocks[slug];
      if (!block) continue;

      for (const conflictingSlug of block.conflicts ?? []) {
        if (!allBlocks.has(conflictingSlug)) continue;

        const conflictPair = [slug, conflictingSlug].sort().join("\0");
        if (reportedConflictPairs.has(conflictPair)) continue;

        reportedConflictPairs.add(conflictPair);
        errors.push(
          new ValidationError(
            recipe.slug,
            "includedBlocks",
            `Conflicting blocks "${slug}" and "${conflictingSlug}" cannot be included together`
          )
        );
      }

      for (const requiredSlug of block.requires ?? []) {
        if (!included.has(requiredSlug)) {
          errors.push(
            new ValidationError(
              recipe.slug,
              "includedBlocks",
              `Block "${slug}" requires "${requiredSlug}" as an included block`
            )
          );
          continue;
        }

        if (
          orderIndex.has(slug) &&
          orderIndex.has(requiredSlug) &&
          orderIndex.get(requiredSlug) > orderIndex.get(slug)
        ) {
          errors.push(
            new ValidationError(
              recipe.slug,
              "integrationOrder",
              `Block "${requiredSlug}" must come before "${slug}" because "${slug}" requires it`
            )
          );
        }
      }
    }

    for (const [index, component] of (recipe.architecture?.components ?? []).entries()) {
      if (component.block && !blockSlugs.has(component.block)) {
        errors.push(
          new ValidationError(
            recipe.slug,
            `architecture.components[${index}].block`,
            `Unknown registry block "${component.block}"`
          )
        );
      }
      if (component.block && !allBlocks.has(component.block)) {
        errors.push(
          new ValidationError(
            recipe.slug,
            `architecture.components[${index}].block`,
            `Block "${component.block}" is not included or optional in this recipe`
          )
        );
      }
    }
  }

  return errors;
}

export function validateRecipes(collection, registry) {
  const { data, errors } = validateStructure(collection);
  if (!data) return errors;
  return checkRecipeRelationships(data, registry);
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch (error) {
    throw new Error(`Could not read ${label} at ${filePath}: ${error.message}`);
  }
}

async function main() {
  const recipesPath =
    process.env.TEST_RECIPES_PATH ?? path.join(REPO_ROOT, "registry", "recipes.json");
  const registryPath =
    process.env.TEST_REGISTRY_PATH ?? path.join(REPO_ROOT, "registry", "index.json");

  let collection;
  let registry;
  try {
    [collection, registry] = await Promise.all([
      readJson(recipesPath, "recipe collection"),
      readJson(registryPath, "block registry")
    ]);
  } catch (error) {
    console.error(`\n✗ Recipe validation failed\n  ${error.message}\n`);
    process.exit(1);
  }

  const errors = validateRecipes(collection, registry);
  if (errors.length === 0) {
    console.log(`✓ Recipes valid — ${collection.recipes.length} recipe(s) verified\n`);
    return;
  }

  console.error(`\nRecipe validation failed — ${errors.length} error(s):\n`);
  for (const error of errors) console.error(`${error.toString()}\n`);
  process.exitCode = 1;
}

const invokedScript = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedScript === import.meta.url) main();
