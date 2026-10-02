import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";

const exec = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "validate-recipes.mjs");
const TMP_DIR = path.join(REPO_ROOT, ".tmp-test-recipes");

interface MutableRecipe {
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
  recipes: MutableRecipe[];
}

interface RecipeRegistry {
  blocks: Record<string, { requires?: string[]; conflicts?: string[] }>;
}

async function runValidator(
  collection: RecipeCollection,
  registry: RecipeRegistry
): Promise<{ code: number; stdout: string; stderr: string }> {
  await mkdir(TMP_DIR, { recursive: true });
  const recipesPath = path.join(TMP_DIR, "recipes.json");
  const registryPath = path.join(TMP_DIR, "registry.json");
  await Promise.all([
    writeFile(recipesPath, JSON.stringify(collection, null, 2), "utf-8"),
    writeFile(registryPath, JSON.stringify(registry, null, 2), "utf-8")
  ]);

  try {
    const result = await exec("node", [SCRIPT], {
      env: {
        ...process.env,
        TEST_RECIPES_PATH: recipesPath,
        TEST_REGISTRY_PATH: registryPath
      },
      timeout: 10_000
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error: unknown) {
    const execError = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: execError.code ?? 1,
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? ""
    };
  } finally {
    await rm(TMP_DIR, { recursive: true, force: true });
  }
}

function makeValidCollection(): RecipeCollection {
  return {
    version: "1.0.0",
    recipes: [
      {
        slug: "sample-api",
        title: "Sample API",
        outcome: "A small API with its base service and dependent middleware.",
        includedBlocks: ["base-block", "dependent-block"],
        optionalBlocks: ["optional-block"],
        integrationOrder: ["base-block", "dependent-block", "optional-block"],
        architecture: {
          overview: "The base service is initialized before its middleware.",
          components: [
            { name: "Base service", description: "Provides shared services.", block: "base-block" }
          ]
        },
        assumptions: [],
        configuration: [],
        tradeoffs: [],
        alternatives: [],
        failureBehavior: [],
        commands: [],
        relatedContent: []
      }
    ]
  };
}

function makeRegistry(): RecipeRegistry {
  return {
    blocks: {
      "base-block": {},
      "dependent-block": { requires: ["base-block"] },
      "optional-block": {},
      "conflict-block": { conflicts: ["base-block"] }
    }
  };
}

describe("recipe validation", () => {
  it("accepts a valid non-empty recipe collection", async () => {
    const result = await runValidator(makeValidCollection(), makeRegistry());

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("1 recipe(s) verified");
  });

  it("accepts valid recipe alternatives", async () => {
    const collection = makeValidCollection();
    collection.recipes[0].alternatives = [
      {
        title: "Use a managed platform",
        description: "Delegate service operation to a managed backend platform."
      }
    ];
    const result = await runValidator(collection, makeRegistry());

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("1 recipe(s) verified");
  });

  it("rejects malformed recipe alternatives", async () => {
    const collection = makeValidCollection();
    collection.recipes[0].alternatives = [{ title: "", description: "A non-empty description." }];
    const result = await runValidator(collection, makeRegistry());

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("alternatives.0.title");
  });

  it("rejects invalid recipe fields", async () => {
    const collection = makeValidCollection();
    collection.recipes[0].title = "";
    const result = await runValidator(collection, makeRegistry());

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("recipes.0.title");
  });

  it("rejects references to unknown registry blocks", async () => {
    const collection = makeValidCollection();
    collection.recipes[0].includedBlocks = ["missing-block"];
    collection.recipes[0].integrationOrder = ["missing-block"];
    const result = await runValidator(collection, makeRegistry());

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown registry block "missing-block"');
  });

  it("rejects recipes that include conflicting blocks", async () => {
    const collection = makeValidCollection();
    collection.recipes[0].includedBlocks = ["base-block", "conflict-block"];
    collection.recipes[0].optionalBlocks = [];
    collection.recipes[0].integrationOrder = ["base-block", "conflict-block"];
    const result = await runValidator(collection, makeRegistry());

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("cannot be included together");
  });

  it("rejects an integration order that violates block requirements", async () => {
    const collection = makeValidCollection();
    collection.recipes[0].integrationOrder = ["dependent-block", "base-block", "optional-block"];
    const result = await runValidator(collection, makeRegistry());

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('"base-block" must come before "dependent-block"');
  });
});
