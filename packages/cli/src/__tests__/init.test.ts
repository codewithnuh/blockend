import { describe, it, expect, vi, beforeEach } from "vitest";
import { initCommand } from "../commands/init.js";
import { join } from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import * as prompts from "@clack/prompts";

vi.mock("fs/promises");
vi.mock("fs", () => ({
  existsSync: vi.fn()
}));

// Dynamic Proxy mock for picocolors to seamlessly handle any theme call chains
vi.mock("picocolors", () => {
  const identity = (str: string) => str;
  const handler = {
    get: () => identity
  };
  const proxy = new Proxy({}, handler);
  return {
    default: proxy,
    ...proxy
  };
});

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn()
  }))
}));

const mockDetectProject = vi.fn(() =>
  Promise.resolve({
    framework: "express",
    language: "typescript",
    hasRedis: false,
    aliasMap: {}
  })
);

vi.mock("@blockend/detector", () => ({
  get detectProject() {
    return mockDetectProject;
  }
}));

describe("initCommand - Path Layout & Alias Edge Cases", () => {
  const cwd = process.cwd();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});

    mockDetectProject.mockResolvedValue({
      framework: "express",
      language: "typescript",
      hasRedis: false,
      aliasMap: {}
    });
  });

  // ==========================================
  // EDGE CASE: Path & Alias Edge Cases
  // ==========================================

  it("should cleanly reverse-engineer aliases when choosing a directory inside an absolute custom baseUrl", async () => {
    vi.mocked(existsSync).mockImplementation(
      (p) => p === join(cwd, "tsconfig.json") || p === join(cwd, "src")
    );

    mockDetectProject.mockResolvedValue({
      framework: "next",
      language: "typescript",
      hasRedis: false,
      aliasMap: {}
    });

    const mockTsConfig = JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "~/*": ["src/*"]
        }
      }
    });
    vi.mocked(fs.readFile).mockResolvedValue(mockTsConfig);
    vi.mocked(prompts.text).mockResolvedValueOnce("src/modules/blocks");

    await initCommand();

    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "blockend.json"),
      expect.stringContaining('"blocks": "~/modules/blocks"'),
      "utf-8"
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "blockend.json"),
      expect.stringContaining('"blocks": "./src/modules/blocks"'),
      "utf-8"
    );
  });

  it("should handle custom non-standard alias structures safely (e.g., #/* fallback calculations)", async () => {
    vi.mocked(existsSync).mockImplementation((p) => p === join(cwd, "tsconfig.json"));

    mockDetectProject.mockResolvedValue({
      framework: "fastify",
      language: "typescript",
      hasRedis: false,
      aliasMap: {}
    });

    const mockTsConfig = JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "#*": ["lib/*"]
        }
      }
    });
    vi.mocked(fs.readFile).mockResolvedValue(mockTsConfig);
    vi.mocked(prompts.text).mockResolvedValueOnce("lib/blocks");

    await initCommand();

    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "blockend.json"),
      expect.stringContaining('"blocks": "#blocks"'),
      "utf-8"
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "blockend.json"),
      expect.stringContaining('"blocks": "./lib/blocks"'),
      "utf-8"
    );
  });

  it("should correctly handle paths containing backslashes and normalize them on Windows environments", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(fs.readFile).mockRejectedValue(new Error());

    mockDetectProject.mockResolvedValue({
      framework: "express",
      language: "typescript",
      hasRedis: false,
      aliasMap: {}
    });

    vi.mocked(prompts.text).mockResolvedValueOnce("src\\infrastructure\\blocks");

    await initCommand();

    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "blockend.json"),
      expect.stringContaining('"blocks": "@/blocks"'),
      "utf-8"
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "blockend.json"),
      expect.stringContaining('"blocks": "./src/infrastructure/blocks"'),
      "utf-8"
    );
  });

  // ==========================================
  // FEATURES: Overwrite Handling & Lifecycle Flows
  // ==========================================

  it("should prompt user and cancel execution gracefully if blockend.json exists and they select 'keep'", async () => {
    vi.mocked(existsSync).mockImplementation((p) => p === join(cwd, "blockend.json"));
    vi.mocked(prompts.select).mockResolvedValue("keep");

    await initCommand();

    expect(fs.unlink).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining("preserved"));
  });

  it("should wipe historical config explicitly if blockend.json exists and user clicks 'regenerate'", async () => {
    vi.mocked(existsSync).mockImplementation(
      (p) => p === join(cwd, "blockend.json") || p === join(cwd, "src")
    );
    vi.mocked(fs.readFile).mockRejectedValue(new Error());

    vi.mocked(prompts.select).mockResolvedValueOnce("regenerate");
    vi.mocked(prompts.text).mockResolvedValueOnce("src/blocks");

    await initCommand();

    expect(fs.unlink).toHaveBeenCalledWith(join(cwd, "blockend.json"));
    expect(fs.writeFile).toHaveBeenCalled();
  });
});
