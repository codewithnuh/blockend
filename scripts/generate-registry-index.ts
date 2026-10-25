/* oxlint-disable no-console */
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as prettier from "prettier";
import {
  BLOCK_SLUG_PATTERN,
  BlockDeclarationSchema,
  RegistrySchema,
  type RegistryBlock
} from "../packages/registry/src/index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const BLOCKS_DIR = path.join(REPO_ROOT, "blocks");
const CONFIG_PATH = path.join(REPO_ROOT, "registry", "config.json");
const OUTPUT_PATH = path.join(REPO_ROOT, "registry", "index.json");

interface RegistryConfig {
  version: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read ${path.relative(REPO_ROOT, filePath)}: ${message}`);
  }
}

async function readConfig(): Promise<RegistryConfig> {
  const config = await readJson(CONFIG_PATH);

  if (!isRecord(config) || typeof config.version !== "string" || config.version.trim() === "") {
    throw new Error("registry/config.json must contain a non-empty string version.");
  }

  return { version: config.version };
}

function compareBlocks(
  a: { key: string; releasedAt?: string },
  b: { key: string; releasedAt?: string }
): number {
  const dateA = a.releasedAt ?? "9999-99-99";
  const dateB = b.releasedAt ?? "9999-99-99";
  return dateA.localeCompare(dateB) || a.key.localeCompare(b.key);
}

export async function buildRegistryIndex(): Promise<string> {
  const config = await readConfig();
  const entries = await fs.readdir(BLOCKS_DIR, { withFileTypes: true });
  const declarations: Array<{
    key: string;
    releasedAt?: string;
    block: RegistryBlock;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    if (!BLOCK_SLUG_PATTERN.test(entry.name)) {
      throw new Error(`Block directory "${entry.name}" is not a valid registry slug.`);
    }

    const declarationPath = path.join(BLOCKS_DIR, entry.name, "block.json");
    const parsed = BlockDeclarationSchema.safeParse(await readJson(declarationPath));

    if (!parsed.success) {
      throw new Error(
        `Invalid block declaration ${path.relative(REPO_ROOT, declarationPath)}:\n${parsed.error.message}`
      );
    }

    const { $schema: _schema, ...block } = parsed.data;
    declarations.push({
      key: entry.name,
      releasedAt: block.releasedAt,
      block
    });
  }

  if (declarations.length === 0) {
    throw new Error("No block declarations found under blocks/.");
  }

  declarations.sort(compareBlocks);

  const registry = {
    $schema: "./registry-schema.json",
    version: config.version,
    blocks: Object.fromEntries(declarations.map(({ key, block }) => [key, block]))
  };
  const parsedRegistry = RegistrySchema.safeParse(registry);

  if (!parsedRegistry.success) {
    throw new Error(`Generated registry is invalid:\n${parsedRegistry.error.message}`);
  }

  const prettierConfig = await prettier.resolveConfig(OUTPUT_PATH);
  return prettier.format(JSON.stringify(parsedRegistry.data), {
    ...prettierConfig,
    parser: "json"
  });
}

async function main(): Promise<void> {
  const generated = await buildRegistryIndex();

  if (process.argv.includes("--check")) {
    const current = (await fs.readFile(OUTPUT_PATH, "utf8")).replace(/\r\n/g, "\n");

    if (current !== generated) {
      console.error("registry/index.json is out of date. Run pnpm generate:registry-index.");
      process.exitCode = 1;
      return;
    }

    console.log("registry/index.json is up to date.");
    return;
  }

  await fs.writeFile(OUTPUT_PATH, generated, "utf8");
  console.log("Generated registry/index.json");
}

const isMain =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) void main();
