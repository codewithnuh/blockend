import { describe, expect, it } from "vitest";
import {
  validateRecipes,
  type RecipeCollection,
  type Registry
} from "../packages/registry/src/index.js";

interface RecipeRegistry {
  blocks: Record<string, { requires?: string[]; conflicts?: string[] }>;
}

async function runValidator(
  collection: RecipeCollection,
  registry: RecipeRegistry
): Promise<{ code: number; stdout: string; stderr: string }> {
  const errors = validateRecipes(collection, registry as unknown as Registry);
  if (errors.length === 0) {
    return {
      code: 0,
      stdout: `${collection.recipes.length} recipe(s) verified`,
      stderr: ""
    };
  }
  return {
    code: 1,
    stdout: "",
    stderr: `Recipe validation failed\n${errors.map((error) => error.toString()).join("\n")}`
  };
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
