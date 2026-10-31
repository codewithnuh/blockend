import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCommand } from "../commands/list.js";

vi.mock("picocolors", () => {
  const identity = (str: string) => str;
  const handler = { get: () => identity };
  const proxy = new Proxy({}, handler);
  return { default: proxy, ...proxy };
});

vi.mock("@clack/prompts", () => ({
  outro: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn()
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe("listCommand - recipes", () => {
  const mockRecipes = {
    version: "1.0.0",
    recipes: [
      {
        slug: "test-recipe",
        title: "Test Recipe",
        outcome: "A curated stack.",
        includedBlocks: ["alpha-block", "beta-block"],
        optionalBlocks: ["gamma-block"],
        integrationOrder: ["alpha-block", "beta-block", "gamma-block"],
        architecture: { overview: "x", components: [] },
        assumptions: [],
        configuration: [],
        tradeoffs: [],
        failureBehavior: [],
        commands: [],
        relatedContent: []
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockRecipes)
    } as unknown as Response);
  });

  it("emits the published recipes as JSON", async () => {
    await listCommand({ recipes: true, json: true });

    const write = vi.mocked(process.stdout.write);
    const payload = JSON.parse(String(write.mock.calls[write.mock.calls.length - 1]?.[0]));

    expect(payload.success).toBe(true);
    expect(payload.recipes).toHaveLength(1);
    expect(payload.recipes[0].slug).toBe("test-recipe");
    expect(payload.recipes[0].includedBlocks).toEqual(["alpha-block", "beta-block"]);
    expect(payload.recipes[0].optionalBlocks).toEqual(["gamma-block"]);
  });

  it("reports a failure when the recipe collection cannot be fetched", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => ""
    } as unknown as Response);

    await listCommand({ recipes: true, json: true });

    const write = vi.mocked(process.stdout.write);
    const payload = JSON.parse(String(write.mock.calls[write.mock.calls.length - 1]?.[0]));

    expect(payload.success).toBe(false);
    expect(payload.recipes).toBeUndefined();
  });
});
