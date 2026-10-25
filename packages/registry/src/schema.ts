import { z } from "zod";

/**
 * Registry schema and inferred types.
 *
 * This file is the single source of truth for the shape of
 * `blocks/<slug>/block.json`, `registry/index.json`, `registry/recipes.json`,
 * and every TypeScript consumer of that data. The checked-in JSON Schema files
 * are generated from these schemas by `pnpm generate:registry-schemas`.
 */

export const FRAMEWORK_KEYS = ["express", "fastify", "hono", "next", "*"] as const;
export const FRAMEWORK_NAMES = ["express", "fastify", "hono", "next"] as const;

export const BLOCK_SLUG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const DEPENDENCY_PATTERN = /^[a-z@][a-z0-9._/-]*(@[~^>=<]*[0-9]+(\.[0-9]+)*)?$/;
export const RELEASED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const FrameworkKeySchema = z.enum(FRAMEWORK_KEYS);
export const FrameworkNameSchema = z.enum(FRAMEWORK_NAMES);

export type FrameworkKey = z.infer<typeof FrameworkKeySchema>;
export type FrameworkName = z.infer<typeof FrameworkNameSchema>;

const nonEmptyString = z.string().min(1, "must not be empty");

function isValidCalendarDate(value: string): boolean {
  if (!RELEASED_AT_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export const AssetMappingSchema = z
  .object({
    source: z
      .string()
      .min(1, "source path must not be empty")
      .describe("Repo-relative source path."),
    target: z
      .string()
      .min(1, "target path must not be empty")
      .describe("Block-folder-relative destination path.")
  })
  .strict();

export const AssetReferenceSchema = z.union([z.string().min(1), AssetMappingSchema]);

export const VariantSchema = z
  .object({
    dependencies: z
      .array(z.string())
      .describe("Variant-specific production dependencies.")
      .optional(),
    devDependencies: z
      .array(z.string())
      .describe("Variant-specific development dependencies.")
      .optional(),
    files: z.array(AssetReferenceSchema).describe("Files copied for this variant.")
  })
  .strict();

export const FrameworkMappingSchema = z
  .object({
    core: z.string().describe("Optional fallback template.").optional(),
    dependencies: z
      .array(z.string())
      .describe("Dependencies for this framework mapping.")
      .optional(),
    devDependencies: z
      .array(z.string())
      .describe("Development dependencies for this framework mapping.")
      .optional(),
    variants: z.record(z.string(), VariantSchema).describe("Storage or implementation variants.")
  })
  .strict();

function blockSlugArray(label: string) {
  return z
    .array(
      z
        .string()
        .regex(BLOCK_SLUG_PATTERN, `${label} entries must be valid registry slugs`)
        .min(1, `${label} entries must not be empty`)
    )
    .meta({ uniqueItems: true })
    .optional();
}

export const BlockSchema = z
  .object({
    name: z.string().min(1, "block name must not be empty").describe("Human-readable block name."),
    description: z
      .string()
      .min(1, "block description must not be empty")
      .describe("Short description of the block."),
    version: z
      .string()
      .describe('Semantic version of this block (e.g. "1.0.0"). Used for update tracking.')
      .optional(),
    frameworks: z
      .array(FrameworkKeySchema)
      .meta({ uniqueItems: true })
      .refine(
        (frameworks) => new Set(frameworks).size === frameworks.length,
        "frameworks must not contain duplicates"
      )
      .describe(
        'Explicit framework support list. Named keys mean the block only supports that environment; "*" means framework-agnostic.'
      )
      .optional(),
    releasedAt: z
      .string()
      .regex(RELEASED_AT_PATTERN, "releasedAt must be a valid ISO date (YYYY-MM-DD)")
      .refine(isValidCalendarDate, "releasedAt must be a valid ISO date (YYYY-MM-DD)")
      .describe("ISO calendar date (YYYY-MM-DD) when this block was first released.")
      .optional(),
    runtimes: z
      .record(z.enum(["node"]), z.string().min(1, "runtime version range must not be empty"))
      .describe('Supported runtime engine ranges, e.g. {"node": ">=20"}.')
      .optional(),
    requires: blockSlugArray("requires").describe(
      "Registry slugs that must be installed alongside this block."
    ),
    related: blockSlugArray("related").describe("Registry slugs that pair well with this block."),
    conflicts: blockSlugArray("conflicts").describe(
      "Registry slugs that must not be installed together with this block."
    ),
    dependencies: z
      .array(z.string().regex(DEPENDENCY_PATTERN, "invalid dependency format"))
      .describe("Production dependencies, optionally with version ranges.")
      .optional(),
    devDependencies: z
      .array(z.string().regex(DEPENDENCY_PATTERN, "invalid devDependency format"))
      .describe("Development dependencies, optionally with version ranges.")
      .optional(),
    baseFiles: z
      .array(AssetMappingSchema)
      .describe("Files copied for every install of this block.")
      .optional(),
    adapters: z
      .partialRecord(FrameworkKeySchema, FrameworkMappingSchema)
      .describe("Framework adapter mappings.")
      .optional(),
    environments: z
      .partialRecord(FrameworkKeySchema, FrameworkMappingSchema)
      .describe("Legacy framework mappings.")
      .optional()
  })
  .strict()
  .refine(
    (block) => block.baseFiles || block.adapters || block.environments,
    "block must define at least one of: baseFiles, adapters, or environments"
  );

/**
 * A block declaration lives next to the block source as `blocks/<slug>/block.json`.
 * It carries the same block shape plus an optional `$schema` reference for editors.
 * `safeExtend` preserves BlockSchema's object-level topology check.
 */
export const BlockDeclarationSchema = BlockSchema.safeExtend({
  $schema: z.string().optional().describe("JSON Schema reference for editor support.")
});

export const RegistrySchema = z
  .object({
    $schema: z.string().optional(),
    version: z
      .string()
      .min(1, "registry version must not be empty")
      .describe("Semantic version of the registry schema layout."),
    blocks: z
      .record(z.string().min(1, "block key must not be empty"), BlockSchema)
      .describe("Dictionary lookup table of all available ingestible component blocks.")
  })
  .strict();

export type Registry = z.infer<typeof RegistrySchema>;
export type RegistryBlock = z.infer<typeof BlockSchema>;
export type BlockDeclaration = z.infer<typeof BlockDeclarationSchema>;
export type AssetMapping = z.infer<typeof AssetMappingSchema>;
export type AssetReference = z.infer<typeof AssetReferenceSchema>;
export type VariantConfig = z.infer<typeof VariantSchema>;
export type FrameworkMapping = z.infer<typeof FrameworkMappingSchema>;

/**
 * Compatibility aliases used by the CLI's block-install module. Keeping them
 * here means callers can use the domain name that fits their layer without
 * defining a second copy of the shape.
 */
export type RegistryManifest = Registry;
export type BlockManifest = RegistryBlock;
export type AdapterConfig = VariantConfig;
export type EnvironmentConfig = FrameworkMapping;

const blockSlug = z.string().regex(BLOCK_SLUG_PATTERN, "must be a valid registry block slug");
const uniqueBlockSlugs = z
  .array(blockSlug)
  .meta({ uniqueItems: true })
  .refine(
    (slugs) => new Set(slugs).size === slugs.length,
    "must not contain duplicate block slugs"
  );
const requiredBlockSlugs = z
  .array(blockSlug)
  .min(1)
  .meta({ uniqueItems: true })
  .refine(
    (slugs) => new Set(slugs).size === slugs.length,
    "must not contain duplicate block slugs"
  );

export const RecipeSchema = z
  .object({
    slug: blockSlug.describe("Stable URL-safe recipe identifier."),
    title: nonEmptyString,
    outcome: nonEmptyString.describe("What a developer will have after following the recipe."),
    includedBlocks: requiredBlockSlugs,
    optionalBlocks: uniqueBlockSlugs,
    integrationOrder: uniqueBlockSlugs.describe(
      "A complete ordering of included and optional blocks, respecting registry requirements."
    ),
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
    alternatives: z
      .array(
        z
          .object({
            title: nonEmptyString,
            description: nonEmptyString
          })
          .strict()
      )
      .optional(),
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

export const RecipeCollectionSchema = z
  .object({
    $schema: z.string().optional(),
    version: nonEmptyString.describe("Version of the recipe collection format."),
    recipes: z
      .array(RecipeSchema)
      .describe("Production-ready backend recipes published by Blockend.")
  })
  .strict();

export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeCollection = z.infer<typeof RecipeCollectionSchema>;
