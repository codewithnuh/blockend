/* oxlint-disable no-console */
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const VALID_FRAMEWORK_KEYS = ["express", "fastify", "hono", "next", "*"];

const AssetMappingSchema = z.object({
  source: z.string().min(1, "source path must not be empty"),
  target: z.string().min(1, "target path must not be empty")
});

const VariantSchema = z.object({
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  files: z
    .array(z.union([z.string().min(1), AssetMappingSchema]))
    .min(1, "variant must have at least one file")
});

const FrameworkMappingSchema = z.object({
  core: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  variants: z
    .record(z.string(), VariantSchema)
    .refine((v) => Object.keys(v).length > 0, "adapters must have at least one variant")
});

const DependencyPattern = /^[a-z@][a-z0-9._/-]*(@[~^>=<]*[0-9]+(\.[0-9]+)*)?$/;

const BlockSchema = z
  .object({
    name: z.string().min(1, "block name must not be empty"),
    description: z.string().min(1, "block description must not be empty"),
    version: z.string().optional(),
    frameworks: z.array(z.enum(VALID_FRAMEWORK_KEYS)).optional(),
    dependencies: z
      .array(z.string().regex(DependencyPattern, "invalid dependency format: {VALUE}"))
      .optional(),
    devDependencies: z
      .array(z.string().regex(DependencyPattern, "invalid devDependency format: {VALUE}"))
      .optional(),
    baseFiles: z.array(AssetMappingSchema).optional(),
    adapters: z
      .record(z.string(), FrameworkMappingSchema)
      .refine(
        (adapters) => Object.keys(adapters).every((k) => VALID_FRAMEWORK_KEYS.includes(k)),
        `adapter keys must be one of: ${VALID_FRAMEWORK_KEYS.join(", ")}`
      )
      .optional(),
    environments: z
      .record(z.string(), FrameworkMappingSchema)
      .refine(
        (envs) => Object.keys(envs).every((k) => VALID_FRAMEWORK_KEYS.includes(k)),
        `environment keys must be one of: ${VALID_FRAMEWORK_KEYS.join(", ")}`
      )
      .optional()
  })
  .refine(
    (block) => block.baseFiles || block.adapters || block.environments,
    "block must define at least one of: baseFiles, adapters, or environments"
  );

const RegistrySchema = z.object({
  $schema: z.string().optional(),
  version: z.string().min(1, "registry version must not be empty"),
  blocks: z.record(z.string().min(1, "block key must not be empty"), BlockSchema)
});

// ─── Validation error class ──────────────────────────────────────────────────

export class ValidationError {
  constructor(block, field, message, suggestion) {
    this.block = block;
    this.field = field;
    this.message = message;
    this.suggestion = suggestion;
  }

  toString() {
    const loc = this.block
      ? `blocks.${this.block}${this.field ? "." + this.field : ""}`
      : this.field;
    let out = `  \x1b[31m✗\x1b[0m ${loc}\n    ${this.message}`;
    if (this.suggestion) {
      out += `\n    \x1b[33m→ ${this.suggestion}\x1b[0m`;
    }
    return out;
  }
}

// ─── Structural validation ───────────────────────────────────────────────────

export function validateStructure(registry) {
  const errors = [];
  const result = RegistrySchema.safeParse(registry);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const fieldPath = issue.path.join(".");
      const value = issue.code === "invalid_type" ? JSON.stringify(issue.received) : undefined;
      const msg = value ? `${issue.message.replace("{VALUE}", value)}` : issue.message;
      errors.push(new ValidationError(null, fieldPath, msg, null));
    }
  }

  return { errors, data: result.success ? result.data : null };
}

// ─── Duplicate block key detection ───────────────────────────────────────────

export function checkDuplicateKeys(registry) {
  const errors = [];
  const keys = Object.keys(registry.blocks ?? {});
  const lowerMap = new Map();

  for (const key of keys) {
    const lower = key.toLowerCase();
    if (lowerMap.has(lower)) {
      errors.push(
        new ValidationError(
          key,
          null,
          `Case-insensitive duplicate of block key "${lowerMap.get(lower)}"`,
          `Rename to avoid ambiguity, or merge duplicate entries`
        )
      );
    } else {
      lowerMap.set(lower, key);
    }
  }

  return errors;
}

// ─── File existence checks ───────────────────────────────────────────────────

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function checkFileExistence(registry, repoRoot = REPO_ROOT) {
  const errors = [];

  for (const [blockKey, block] of Object.entries(registry.blocks ?? {})) {
    if (block.baseFiles) {
      for (let i = 0; i < block.baseFiles.length; i++) {
        const file = block.baseFiles[i];
        const sourcePath = typeof file === "string" ? file : file.source;
        const absPath = path.resolve(repoRoot, sourcePath);
        if (!(await fileExists(absPath))) {
          errors.push(
            new ValidationError(
              blockKey,
              `baseFiles[${i}].source`,
              `File not found on disk: "${sourcePath}"`,
              `Add the file or remove/update the registry entry`
            )
          );
        }
      }
    }

    if (block.adapters) {
      for (const [adapterKey, adapter] of Object.entries(block.adapters)) {
        if (adapter.core) {
          const absPath = path.resolve(repoRoot, adapter.core);
          if (!(await fileExists(absPath))) {
            errors.push(
              new ValidationError(
                blockKey,
                `adapters.${adapterKey}.core`,
                `Core fallback file not found: "${adapter.core}"`,
                `Add the file or remove the core fallback`
              )
            );
          }
        }

        for (const [variantKey, variant] of Object.entries(adapter.variants ?? {})) {
          for (let i = 0; i < variant.files.length; i++) {
            const file = variant.files[i];
            const sourcePath = typeof file === "string" ? file : file.source;
            const absPath = path.resolve(repoRoot, sourcePath);
            if (!(await fileExists(absPath))) {
              errors.push(
                new ValidationError(
                  blockKey,
                  `adapters.${adapterKey}.variants.${variantKey}.files[${i}].source`,
                  `File not found on disk: "${sourcePath}"`,
                  `Add the file or remove/update the registry entry`
                )
              );
            }
          }
        }
      }
    }

    if (block.environments) {
      for (const [envKey, env] of Object.entries(block.environments)) {
        for (const [variantKey, variant] of Object.entries(env.variants ?? {})) {
          for (let i = 0; i < variant.files.length; i++) {
            const file = variant.files[i];
            const sourcePath = typeof file === "string" ? file : file.source;
            const absPath = path.resolve(repoRoot, sourcePath);
            if (!(await fileExists(absPath))) {
              errors.push(
                new ValidationError(
                  blockKey,
                  `environments.${envKey}.variants.${variantKey}.files[${i}].source`,
                  `File not found on disk: "${sourcePath}"`,
                  `Add the file or remove/update the registry entry`
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

// ─── Cross-block dependency conflict detection ───────────────────────────────

function parseDepName(dep) {
  const atIndex = dep.lastIndexOf("@");
  if (atIndex > 0) {
    return { name: dep.slice(0, atIndex), version: dep.slice(atIndex + 1) };
  }
  return { name: dep, version: null };
}

export function checkDependencyConflicts(registry) {
  const errors = [];
  const depMap = new Map();

  for (const [blockKey, block] of Object.entries(registry.blocks ?? {})) {
    const allDeps = [...(block.dependencies ?? []), ...(block.devDependencies ?? [])];

    for (const dep of allDeps) {
      const { name, version } = parseDepName(dep);
      if (!version) continue;

      if (!depMap.has(name)) {
        depMap.set(name, []);
      }
      depMap.get(name).push({ block: blockKey, version });
    }
  }

  for (const [pkg, entries] of depMap) {
    const uniqueVersions = [...new Set(entries.map((e) => e.version))];
    if (uniqueVersions.length > 1) {
      const blocks = entries.map((e) => `${e.block} requires ${e.version}`).join(", ");
      errors.push(
        new ValidationError(
          null,
          `dependencies.${pkg}`,
          `Conflicting version ranges for "${pkg}": ${blocks}`,
          `Align all blocks to a single compatible version range`
        )
      );
    }
  }

  return errors;
}

// ─── Source-target collision detection ────────────────────────────────────────

export function checkSourceTargetCollisions(registry) {
  const errors = [];

  for (const [blockKey, block] of Object.entries(registry.blocks ?? {})) {
    if (block.baseFiles) {
      const baseTargets = new Map();
      for (let i = 0; i < block.baseFiles.length; i++) {
        const file = block.baseFiles[i];
        const target = typeof file === "string" ? path.basename(file) : file.target;
        const source = typeof file === "string" ? file : file.source;
        if (baseTargets.has(target)) {
          const existing = baseTargets.get(target);
          errors.push(
            new ValidationError(
              blockKey,
              `baseFiles[${i}]`,
              `Duplicate target "${target}" — already mapped from "${existing.source}"`,
              `Remove the duplicate entry or use a unique target path`
            )
          );
        } else {
          baseTargets.set(target, { source });
        }
      }
    }

    if (block.adapters) {
      for (const [adapterKey, adapter] of Object.entries(block.adapters)) {
        for (const [variantKey, variant] of Object.entries(adapter.variants ?? {})) {
          const variantTargets = new Map();
          for (let i = 0; i < variant.files.length; i++) {
            const file = variant.files[i];
            const target = typeof file === "string" ? path.basename(file) : file.target;
            const source = typeof file === "string" ? file : file.source;
            if (variantTargets.has(target)) {
              const existing = variantTargets.get(target);
              errors.push(
                new ValidationError(
                  blockKey,
                  `adapters.${adapterKey}.variants.${variantKey}.files[${i}]`,
                  `Duplicate target "${target}" — already mapped from "${existing.source}"`,
                  `Remove the duplicate entry or use a unique target path`
                )
              );
            } else {
              variantTargets.set(target, { source });
            }
          }
        }
      }
    }
  }

  return errors;
}

// ─── Run all validations ─────────────────────────────────────────────────────

export async function validateRegistry(registry, repoRoot = REPO_ROOT) {
  const allErrors = [];

  const { errors: structuralErrors } = validateStructure(registry);
  allErrors.push(...structuralErrors);

  allErrors.push(...checkDuplicateKeys(registry));

  if (registry.blocks && typeof registry.blocks === "object") {
    allErrors.push(...(await checkFileExistence(registry, repoRoot)));
    allErrors.push(...checkDependencyConflicts(registry));
    allErrors.push(...checkSourceTargetCollisions(registry));
  }

  return allErrors;
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

async function main() {
  const registryPath =
    process.env.TEST_REGISTRY_PATH ||
    path.resolve(import.meta.dirname, "..", "registry", "index.json");

  let raw;
  try {
    raw = await fs.readFile(registryPath, "utf-8");
  } catch (err) {
    console.error(`\x1b[31m✗ Failed to read registry: ${registryPath}\x1b[0m`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  let registry;
  try {
    registry = JSON.parse(raw);
  } catch (err) {
    console.error(`\n\x1b[31m✗ Registry is not valid JSON\x1b[0m`);
    console.error(`  ${err.message}`);
    console.error(`\n  \x1b[33m→ Fix the JSON syntax and try again\x1b[0m\n`);
    process.exit(1);
  }

  const allErrors = await validateRegistry(registry);

  if (allErrors.length === 0) {
    const blockCount = Object.keys(registry.blocks ?? {}).length;
    console.log(`\x1b[32m✓ Registry valid — ${blockCount} block(s) verified\x1b[0m\n`);
    process.exit(0);
  }

  console.error(`\n\x1b[31m━━━ Registry Validation Failed ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n`);
  console.error(`  Found \x1b[31m${allErrors.length}\x1b[0m error(s):\n`);
  for (const err of allErrors) {
    console.error(err.toString());
    console.error("");
  }
  console.error(`\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n`);
  process.exit(1);
}

main();
