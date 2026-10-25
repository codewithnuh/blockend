import { promises as fs } from "node:fs";
import path from "node:path";
import {
  RecipeCollectionSchema,
  RegistrySchema,
  type AssetReference,
  type RecipeCollection,
  type Registry
} from "./schema.js";

const RELATIONSHIP_FIELDS = ["requires", "related", "conflicts"] as const;

export class ValidationError {
  constructor(
    readonly block: string | null,
    readonly field: string | null,
    readonly message: string,
    readonly suggestion?: string
  ) {}

  toString(): string {
    const location = this.block
      ? `blocks.${this.block}${this.field ? `.${this.field}` : ""}`
      : (this.field ?? "");
    let output = `  \x1b[31m✖\x1b[0m ${location}\n    ${this.message}`;
    if (this.suggestion) {
      output += `\n    \x1b[33m→ ${this.suggestion}\x1b[0m`;
    }
    return output;
  }
}

export class RecipeValidationError {
  constructor(
    readonly recipe: string | null,
    readonly field: string | null,
    readonly message: string
  ) {}

  toString(): string {
    const location = this.recipe
      ? `recipes.${this.recipe}${this.field ? `.${this.field}` : ""}`
      : (this.field ?? "");
    return `  \x1b[31m✖\x1b[0m ${location}\n    ${this.message}`;
  }
}

export interface RegistryStructureResult {
  data: Registry | null;
  errors: ValidationError[];
}

export function validateRegistryStructure(registry: unknown): RegistryStructureResult {
  const result = RegistrySchema.safeParse(registry);
  if (result.success) return { data: result.data, errors: [] };

  return {
    data: null,
    errors: result.error.issues.map(
      (issue) => new ValidationError(null, issue.path.join("."), issue.message)
    )
  };
}

export function checkDuplicateKeys(registry: Registry): ValidationError[] {
  const errors: ValidationError[] = [];
  const lowerMap = new Map<string, string>();

  for (const key of Object.keys(registry.blocks)) {
    const lower = key.toLowerCase();
    if (lowerMap.has(lower)) {
      errors.push(
        new ValidationError(
          key,
          null,
          `Case-insensitive duplicate of block key "${lowerMap.get(lower)}"`,
          "Rename to avoid ambiguity, or merge duplicate entries"
        )
      );
    } else {
      lowerMap.set(lower, key);
    }
  }

  return errors;
}

export function checkBlockRelationships(registry: Registry): ValidationError[] {
  const errors: ValidationError[] = [];
  const slugs = new Set(Object.keys(registry.blocks));

  for (const [blockKey, block] of Object.entries(registry.blocks)) {
    for (const field of RELATIONSHIP_FIELDS) {
      const values = block[field];
      if (!values) continue;

      const seen = new Set<string>();
      for (let i = 0; i < values.length; i++) {
        const slug = values[i];

        if (slug === blockKey) {
          errors.push(
            new ValidationError(
              blockKey,
              `${field}[${i}]`,
              `Block cannot reference itself in "${field}"`,
              `Remove "${slug}" from ${field}`
            )
          );
          continue;
        }

        if (!slugs.has(slug)) {
          errors.push(
            new ValidationError(
              blockKey,
              `${field}[${i}]`,
              `Unknown block reference "${slug}" - not a registry slug`,
              `Use an existing slug (${[...slugs].join(", ")}) or add a "${slug}" block`
            )
          );
          continue;
        }

        if (seen.has(slug)) {
          errors.push(
            new ValidationError(
              blockKey,
              `${field}[${i}]`,
              `Duplicate block reference "${slug}" in "${field}"`,
              "Remove the duplicate entry"
            )
          );
        }
        seen.add(slug);
      }
    }
  }

  errors.push(...checkRequiresCycles(registry));
  return errors;
}

function checkRequiresCycles(registry: Registry): ValidationError[] {
  const errors: ValidationError[] = [];
  const blocks = registry.blocks;
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(key: string): void {
    if (visiting.has(key)) {
      const cycleStart = stack.indexOf(key);
      const cycle = [...stack.slice(cycleStart), key].join(" → ");
      errors.push(
        new ValidationError(
          key,
          "requires",
          `Circular requires chain: ${cycle}`,
          "Break the cycle so requires relationships form a DAG"
        )
      );
      return;
    }
    if (visited.has(key)) return;

    visiting.add(key);
    stack.push(key);
    for (const dependency of blocks[key]?.requires ?? []) {
      if (blocks[dependency]) visit(dependency);
    }
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  }

  for (const key of Object.keys(blocks)) {
    visit(key);
  }

  return errors;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assetSource(file: AssetReference): string {
  return typeof file === "string" ? file : file.source;
}

function assetTarget(file: AssetReference): string {
  return typeof file === "string" ? path.basename(file) : file.target;
}

function checkVariantDefinitions(registry: Registry): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [blockKey, block] of Object.entries(registry.blocks)) {
    for (const field of ["adapters", "environments"] as const) {
      const mappings = block[field];
      if (!mappings) continue;

      for (const [mappingKey, mapping] of Object.entries(mappings)) {
        const variants = Object.entries(mapping.variants);
        if (variants.length === 0) {
          errors.push(
            new ValidationError(
              blockKey,
              `${field}.${mappingKey}.variants`,
              "adapters must have at least one variant",
              "Add at least one variant or remove the mapping"
            )
          );
        }

        for (const [variantKey, variant] of variants) {
          if (variant.files.length === 0) {
            errors.push(
              new ValidationError(
                blockKey,
                `${field}.${mappingKey}.variants.${variantKey}.files`,
                "variant must have at least one file",
                "Add a file entry or remove the variant"
              )
            );
          }
        }
      }
    }
  }

  return errors;
}

export async function checkFileExistence(
  registry: Registry,
  repoRoot = process.cwd()
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  for (const [blockKey, block] of Object.entries(registry.blocks)) {
    if (block.baseFiles) {
      for (let i = 0; i < block.baseFiles.length; i++) {
        const file = block.baseFiles[i];
        const sourcePath = assetSource(file);
        const absolutePath = path.resolve(repoRoot, sourcePath);
        if (!(await fileExists(absolutePath))) {
          errors.push(
            new ValidationError(
              blockKey,
              `baseFiles[${i}].source`,
              `File not found on disk: "${sourcePath}"`,
              "Add the file or remove/update the registry entry"
            )
          );
        }
      }
    }

    if (block.adapters) {
      for (const [adapterKey, adapter] of Object.entries(block.adapters)) {
        if (adapter.core) {
          const absolutePath = path.resolve(repoRoot, adapter.core);
          if (!(await fileExists(absolutePath))) {
            errors.push(
              new ValidationError(
                blockKey,
                `adapters.${adapterKey}.core`,
                `Core fallback file not found: "${adapter.core}"`,
                "Add the file or remove the core fallback"
              )
            );
          }
        }

        for (const [variantKey, variant] of Object.entries(adapter.variants ?? {})) {
          for (let i = 0; i < variant.files.length; i++) {
            const sourcePath = assetSource(variant.files[i]);
            const absolutePath = path.resolve(repoRoot, sourcePath);
            if (!(await fileExists(absolutePath))) {
              errors.push(
                new ValidationError(
                  blockKey,
                  `adapters.${adapterKey}.variants.${variantKey}.files[${i}].source`,
                  `File not found on disk: "${sourcePath}"`,
                  "Add the file or remove/update the registry entry"
                )
              );
            }
          }
        }
      }
    }

    if (block.environments) {
      for (const [environmentKey, environment] of Object.entries(block.environments)) {
        for (const [variantKey, variant] of Object.entries(environment.variants ?? {})) {
          for (let i = 0; i < variant.files.length; i++) {
            const sourcePath = assetSource(variant.files[i]);
            const absolutePath = path.resolve(repoRoot, sourcePath);
            if (!(await fileExists(absolutePath))) {
              errors.push(
                new ValidationError(
                  blockKey,
                  `environments.${environmentKey}.variants.${variantKey}.files[${i}].source`,
                  `File not found on disk: "${sourcePath}"`,
                  "Add the file or remove/update the registry entry"
                )
              );
            }
          }
        }
      }
    }
  }

  return errors;
}

function parseDependency(dependency: string): { name: string; version: string | null } {
  const atIndex = dependency.lastIndexOf("@");
  if (atIndex > 0) {
    return { name: dependency.slice(0, atIndex), version: dependency.slice(atIndex + 1) };
  }
  return { name: dependency, version: null };
}

export function checkDependencyConflicts(registry: Registry): ValidationError[] {
  const errors: ValidationError[] = [];
  const dependencyMap = new Map<string, Array<{ block: string; version: string }>>();

  for (const [blockKey, block] of Object.entries(registry.blocks)) {
    const allDependencies = [...(block.dependencies ?? []), ...(block.devDependencies ?? [])];

    for (const dependency of allDependencies) {
      const { name, version } = parseDependency(dependency);
      if (!version) continue;

      const entries = dependencyMap.get(name) ?? [];
      entries.push({ block: blockKey, version });
      dependencyMap.set(name, entries);
    }
  }

  for (const [packageName, entries] of dependencyMap) {
    const uniqueVersions = [...new Set(entries.map((entry) => entry.version))];
    if (uniqueVersions.length > 1) {
      const blocks = entries.map((entry) => `${entry.block} requires ${entry.version}`).join(", ");
      errors.push(
        new ValidationError(
          null,
          `dependencies.${packageName}`,
          `Conflicting version ranges for "${packageName}": ${blocks}`,
          "Align all blocks to a single compatible version range"
        )
      );
    }
  }

  return errors;
}

function checkTargets(
  targets: Map<string, { source: string }>,
  files: AssetReference[],
  field: (index: number) => string,
  blockKey: string,
  errors: ValidationError[]
): void {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const target = assetTarget(file);
    const source = assetSource(file);
    if (targets.has(target)) {
      const existing = targets.get(target);
      errors.push(
        new ValidationError(
          blockKey,
          field(i),
          `Duplicate target "${target}" - already mapped from "${existing?.source}"`,
          "Remove the duplicate entry or use a unique target path"
        )
      );
    } else {
      targets.set(target, { source });
    }
  }
}

export function checkSourceTargetCollisions(registry: Registry): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [blockKey, block] of Object.entries(registry.blocks)) {
    if (block.baseFiles) {
      checkTargets(new Map(), block.baseFiles, (index) => `baseFiles[${index}]`, blockKey, errors);
    }

    if (block.adapters) {
      for (const [adapterKey, adapter] of Object.entries(block.adapters)) {
        for (const [variantKey, variant] of Object.entries(adapter.variants ?? {})) {
          checkTargets(
            new Map(),
            variant.files,
            (index) => `adapters.${adapterKey}.variants.${variantKey}.files[${index}]`,
            blockKey,
            errors
          );
        }
      }
    }

    if (block.environments) {
      for (const [environmentKey, environment] of Object.entries(block.environments)) {
        for (const [variantKey, variant] of Object.entries(environment.variants ?? {})) {
          checkTargets(
            new Map(),
            variant.files,
            (index) => `environments.${environmentKey}.variants.${variantKey}.files[${index}]`,
            blockKey,
            errors
          );
        }
      }
    }
  }

  return errors;
}

export interface ValidateRegistryOptions {
  repoRoot?: string;
}

export async function validateRegistry(
  registry: unknown,
  options: ValidateRegistryOptions = {}
): Promise<ValidationError[]> {
  const { data, errors } = validateRegistryStructure(registry);
  if (!data) return errors;

  return [
    ...errors,
    ...checkDuplicateKeys(data),
    ...checkBlockRelationships(data),
    ...checkVariantDefinitions(data),
    ...(await checkFileExistence(data, options.repoRoot)),
    ...checkDependencyConflicts(data),
    ...checkSourceTargetCollisions(data)
  ];
}

export interface RecipeStructureResult {
  data: RecipeCollection | null;
  errors: RecipeValidationError[];
}

export function validateRecipeStructure(collection: unknown): RecipeStructureResult {
  const result = RecipeCollectionSchema.safeParse(collection);
  if (result.success) return { data: result.data, errors: [] };

  return {
    data: null,
    errors: result.error.issues.map(
      (issue) => new RecipeValidationError(null, issue.path.join("."), issue.message)
    )
  };
}

export function checkRecipeRelationships(
  collection: RecipeCollection,
  registry: Registry
): RecipeValidationError[] {
  const errors: RecipeValidationError[] = [];
  const blocks = registry.blocks;
  const blockSlugs = new Set(Object.keys(blocks));
  const recipeSlugs = new Set<string>();

  for (const recipe of collection.recipes) {
    if (recipeSlugs.has(recipe.slug)) {
      errors.push(
        new RecipeValidationError(recipe.slug, "slug", `Duplicate recipe slug "${recipe.slug}"`)
      );
    }
    recipeSlugs.add(recipe.slug);

    const included = new Set(recipe.includedBlocks);
    const optional = new Set(recipe.optionalBlocks);
    const allBlocks = new Set([...included, ...optional]);
    const order = recipe.integrationOrder;
    const orderIndex = new Map(order.map((slug, index) => [slug, index]));
    const reportedConflictPairs = new Set<string>();

    for (const slug of optional) {
      if (included.has(slug)) {
        errors.push(
          new RecipeValidationError(
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
          new RecipeValidationError(
            recipe.slug,
            "includedBlocks",
            `Unknown registry block "${slug}"`
          )
        );
      }
    }

    for (const slug of order) {
      if (!allBlocks.has(slug)) {
        errors.push(
          new RecipeValidationError(
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
          new RecipeValidationError(
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
          new RecipeValidationError(
            recipe.slug,
            "includedBlocks",
            `Conflicting blocks "${slug}" and "${conflictingSlug}" cannot be included together`
          )
        );
      }

      for (const requiredSlug of block.requires ?? []) {
        if (!included.has(requiredSlug)) {
          errors.push(
            new RecipeValidationError(
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
          (orderIndex.get(requiredSlug) ?? 0) > (orderIndex.get(slug) ?? 0)
        ) {
          errors.push(
            new RecipeValidationError(
              recipe.slug,
              "integrationOrder",
              `Block "${requiredSlug}" must come before "${slug}" because "${slug}" requires it`
            )
          );
        }
      }
    }

    for (const [index, component] of recipe.architecture.components.entries()) {
      if (component.block && !blockSlugs.has(component.block)) {
        errors.push(
          new RecipeValidationError(
            recipe.slug,
            `architecture.components[${index}].block`,
            `Unknown registry block "${component.block}"`
          )
        );
      }
      if (component.block && !allBlocks.has(component.block)) {
        errors.push(
          new RecipeValidationError(
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

export function validateRecipes(collection: unknown, registry: Registry): RecipeValidationError[] {
  const { data, errors } = validateRecipeStructure(collection);
  if (!data) return errors;
  return checkRecipeRelationships(data, registry);
}
