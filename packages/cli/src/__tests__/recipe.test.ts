import { describe, it, expect, vi, beforeEach } from "vitest";
import { addCommand } from "../commands/add.js";
import { join } from "path";
import fs from "fs/promises";
import * as prompts from "@clack/prompts";
import { exec, type ChildProcess } from "child_process";

vi.mock("fs/promises", () => {
  const access = vi.fn();
  const readFile = vi.fn();
  const writeFile = vi.fn();
  const mkdir = vi.fn();
  return {
    default: { access, readFile, writeFile, mkdir },
    access,
    readFile,
    writeFile,
    mkdir
  };
});

vi.mock("child_process", () => ({
  exec: vi.fn()
}));

vi.mock("picocolors", () => {
  const identity = (str: string) => str;
  const handler = { get: () => identity };
  const proxy = new Proxy({}, handler);
  return { default: proxy, ...proxy };
});

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
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

describe("addCommand - recipe mode", () => {
  const cwd = process.cwd();

  const mockConfig = JSON.stringify({
    environment: "express",
    language: "typescript",
    packageManager: "pnpm",
    aliases: { blocks: "@/blocks" },
    paths: { blocks: "./src/blocks" }
  });

  const mockPackageJson = JSON.stringify({
    dependencies: { express: "^4.18.2" },
    devDependencies: {}
  });

  const blockFixture = (slug: string) => ({
    name: slug,
    description: `${slug} block`,
    baseFiles: [{ source: `blocks/${slug}/core.ts`, target: "core.ts" }],
    adapters: {
      express: {
        variants: {
          default: {
            files: [{ source: `blocks/${slug}/adapters/express.ts`, target: "express.ts" }]
          }
        }
      }
    }
  });

  const mockRegistry = {
    version: "1.0.0",
    blocks: {
      "alpha-block": blockFixture("alpha-block"),
      "beta-block": blockFixture("beta-block"),
      "gamma-block": blockFixture("gamma-block")
    }
  };

  const mockRecipes = {
    version: "1.0.0",
    recipes: [
      {
        slug: "test-recipe",
        title: "Test Recipe",
        outcome: "Two blocks in a deliberate order.",
        includedBlocks: ["alpha-block", "beta-block"],
        optionalBlocks: [],
        integrationOrder: ["beta-block", "alpha-block"],
        architecture: { overview: "Ordered blocks.", components: [] },
        assumptions: [],
        configuration: [],
        tradeoffs: [],
        failureBehavior: [],
        commands: [],
        relatedContent: []
      },
      {
        slug: "optional-recipe",
        title: "Optional Recipe",
        outcome: "Two required blocks and one optional block.",
        includedBlocks: ["alpha-block", "beta-block"],
        optionalBlocks: ["gamma-block"],
        integrationOrder: ["beta-block", "alpha-block", "gamma-block"],
        architecture: { overview: "Ordered blocks.", components: [] },
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
    vi.spyOn(console, "error").mockImplementation(() => {});

    const defaultChildProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: (code: number) => void) => {
        if (event === "close") callback(0);
        return {} as unknown as ChildProcess;
      })
    } as unknown as ChildProcess;

    vi.mocked(exec).mockReturnValue(defaultChildProcess);

    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json") || pathStr.endsWith("package.json")) return;
      throw new Error("File not found");
    });

    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) return mockConfig;
      if (pathStr.endsWith("package.json")) return mockPackageJson;
      throw new Error(`not found: ${pathStr}`);
    });

    global.fetch = vi.fn().mockImplementation(async (url: unknown) => {
      const target = String(url);
      if (target.endsWith("registry/index.json")) {
        return { ok: true, json: async () => mockRegistry, text: async () => "" };
      }
      if (target.endsWith("registry/recipes.json")) {
        return {
          ok: true,
          text: async () => JSON.stringify(mockRecipes),
          json: async () => mockRecipes
        };
      }
      return { ok: true, text: async () => "mocked code content", json: async () => ({}) };
    });

    vi.mocked(prompts.confirm).mockResolvedValue(true);
    vi.mocked(prompts.multiselect).mockResolvedValue([]);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  const writtenBlockPaths = () =>
    vi
      .mocked(fs.writeFile)
      .mock.calls.map((call) => String(call[0]).replace(/\\/g, "/"))
      .filter((p) => p.includes("src/blocks"));

  it("installs every included block in the recipe's integration order", async () => {
    await addCommand(undefined, { recipe: "test-recipe" });

    const written = writtenBlockPaths();
    const betaIndex = written.findIndex((p) => p.includes("beta-block"));
    const alphaIndex = written.findIndex((p) => p.includes("alpha-block"));

    expect(betaIndex).toBeGreaterThanOrEqual(0);
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(betaIndex).toBeLessThan(alphaIndex);

    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "src/blocks/beta-block/core.ts"),
      "mocked code content",
      "utf-8"
    );
  });

  it("reports an error for an unknown recipe without writing files", async () => {
    await addCommand(undefined, { recipe: "missing-recipe" });

    expect(writtenBlockPaths()).toHaveLength(0);
    expect(prompts.log.error).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });

  it("installs a selected optional block in the recipe's integration order", async () => {
    vi.mocked(prompts.multiselect).mockResolvedValue(["gamma-block"]);

    await addCommand(undefined, { recipe: "optional-recipe" });

    expect(prompts.multiselect).toHaveBeenCalledWith(expect.objectContaining({ required: false }));

    const written = writtenBlockPaths();
    const betaIndex = written.findIndex((p) => p.includes("beta-block"));
    const alphaIndex = written.findIndex((p) => p.includes("alpha-block"));
    const gammaIndex = written.findIndex((p) => p.includes("gamma-block"));

    expect(gammaIndex).toBeGreaterThanOrEqual(0);
    expect(betaIndex).toBeLessThan(alphaIndex);
    expect(alphaIndex).toBeLessThan(gammaIndex);
  });

  it("skips optional blocks and does not prompt with --yes", async () => {
    await addCommand(undefined, { recipe: "optional-recipe", yes: true });

    expect(prompts.multiselect).not.toHaveBeenCalled();

    const written = writtenBlockPaths();
    expect(written.some((p) => p.includes("gamma-block"))).toBe(false);
    expect(written.some((p) => p.includes("alpha-block"))).toBe(true);
  });

  it("skips optional blocks in --json mode and reports the installed blocks", async () => {
    await addCommand(undefined, { recipe: "optional-recipe", json: true });

    expect(prompts.multiselect).not.toHaveBeenCalled();
    expect(writtenBlockPaths().some((p) => p.includes("gamma-block"))).toBe(false);

    const writeMock = vi.mocked(process.stdout.write);
    const payload = JSON.parse(String(writeMock.mock.calls[writeMock.mock.calls.length - 1]?.[0]));

    expect(payload.recipe).toBe("optional-recipe");
    expect(payload.blocks).toContain("alpha-block");
    expect(payload.blocks).toContain("beta-block");
    expect(payload.blocks).not.toContain("gamma-block");
  });
});
