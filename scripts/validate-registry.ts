/* oxlint-disable no-console */
import path from "node:path";
import {
  loadRegistryFile,
  validateRegistry,
  type Registry
} from "../packages/registry/src/index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

async function main(): Promise<void> {
  const registryPath =
    process.env.TEST_REGISTRY_PATH ?? path.join(REPO_ROOT, "registry", "index.json");

  let registry: Registry;
  try {
    registry = await loadRegistryFile(registryPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n✖ Registry validation failed\n  ${message}\n`);
    process.exitCode = 1;
    return;
  }

  const errors = await validateRegistry(registry, { repoRoot: REPO_ROOT });

  if (errors.length === 0) {
    console.log(
      `\x1b[32m✓ Registry valid - ${Object.keys(registry.blocks).length} block(s) verified\x1b[0m\n`
    );
    return;
  }

  console.error(`\n\x1b[31mRegistry Validation Failed\x1b[0m\n`);
  console.error(`  Found \x1b[31m${errors.length}\x1b[0m error(s):\n`);
  for (const error of errors) {
    console.error(error.toString());
    console.error("");
  }
  process.exitCode = 1;
}

void main();
