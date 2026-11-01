import { describe, it, expect } from "vitest";
import { orderRecipeBlocks } from "../block-install/recipes.js";
import type { Recipe } from "@blockend/registry";

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    slug: "recipe",
    title: "Recipe",
    outcome: "Outcome.",
    includedBlocks: ["a-block"],
    optionalBlocks: [],
    integrationOrder: ["a-block"],
    architecture: { overview: "Overview.", components: [] },
    assumptions: [],
    configuration: [],
    tradeoffs: [],
    failureBehavior: [],
    commands: [],
    relatedContent: [],
    ...overrides
  };
}

describe("orderRecipeBlocks", () => {
  it("orders included and selected optional blocks by integrationOrder", () => {
    const order = orderRecipeBlocks(
      makeRecipe({
        includedBlocks: ["a-block", "b-block"],
        optionalBlocks: ["c-block"],
        integrationOrder: ["b-block", "c-block", "a-block"]
      }),
      ["c-block"]
    );

    expect(order).toEqual(["b-block", "c-block", "a-block"]);
  });

  it("omits optional blocks that were not selected", () => {
    const order = orderRecipeBlocks(
      makeRecipe({
        includedBlocks: ["a-block", "b-block"],
        optionalBlocks: ["c-block"],
        integrationOrder: ["c-block", "a-block", "b-block"]
      })
    );

    expect(order).toEqual(["a-block", "b-block"]);
  });

  it("appends a selected block missing from integrationOrder instead of dropping it", () => {
    const order = orderRecipeBlocks(
      makeRecipe({
        includedBlocks: ["a-block", "b-block"],
        optionalBlocks: [],
        integrationOrder: ["a-block"]
      })
    );

    expect(order).toEqual(["a-block", "b-block"]);
  });
});
