import { describe, it, expect, vi, beforeEach } from "vitest";
import { diffCommand } from "../commands/diff.js";
import fs from "fs/promises";
import { existsSync } from "fs";
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

vi.mock("fs", () => ({
  existsSync: vi.fn()
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

describe("diffCommand - Preview Generated Files", () => {
  const mockConfig = JSON.stringify({
    environment: "express",
    language: "typescript",
    aliases: { blocks: "@/blocks" },
    paths: { blocks: "./src/blocks" }
  });

  const mockRegistry = {
    "pino-logger": {
      name: "Pino Logger",
      description: "Structured logging framework",
      baseFiles: [{ source: "blocks/pino-logger/core.ts.txt", target: "core.ts" }],
      adapters: {
        express: {
          devDependencies: ["@types/express"],
          variants: {
            default: {
              dependencies: ["pino"],
              files: [
                { source: "blocks/pino-logger/adapters/express.ts.txt", target: "express.ts" }
              ]
            }
          }
        }
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(existsSync).mockReturnValue(false);

    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) return;
      throw new Error("File not found");
    });

    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) return mockConfig;
      throw new Error(`not found: ${pathStr}`);
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRegistry,
      text: async () => "import { pino } from 'pino';\nexport const logger = pino();"
    } as unknown as Response);
  });

  it("should return file list with status 'new' when no existing files exist", async () => {
    const result = await diffCommand("pino-logger");

    expect(result.files).toHaveLength(2);
    expect(result.files.every((f: { status: string }) => f.status === "new")).toBe(true);
    expect(result.files.map((f: { name: string }) => f.name)).toContain("core.ts");
    expect(result.files.map((f: { name: string }) => f.name)).toContain("express.ts");
  });

  it("should return file list with status 'modified' when existing files differ", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) return;
      if (pathStr.endsWith("core.ts") || pathStr.endsWith("express.ts")) return;
      throw new Error("File not found");
    });

    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) return mockConfig;
      if (pathStr.endsWith("core.ts") || pathStr.endsWith("express.ts")) {
        return "old content";
      }
      throw new Error(`not found: ${pathStr}`);
    });

    const result = await diffCommand("pino-logger");

    expect(result.files).toHaveLength(2);
    expect(result.files.every((f: { status: string }) => f.status === "modified")).toBe(true);
  });

  it("should return error when block is not found in registry", async () => {
    const result = await diffCommand("nonexistent-block");

    expect(result.error).toBeDefined();
    expect(result.error).toContain("not found");
  });

  it("should return error when blockend.json is missing", async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error("not found"));

    const result = await diffCommand("pino-logger");

    expect(result.error).toBeDefined();
    expect(result.error).toContain("blockend.json");
  });

  it("should not write any files to disk", async () => {
    await diffCommand("pino-logger");

    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it("should return empty files array for block with no files", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        "empty-block": {
          name: "Empty",
          description: "Empty block",
          adapters: {
            express: {
              variants: {
                default: { dependencies: [], files: [] }
              }
            }
          }
        }
      }),
      text: async () => ""
    } as unknown as Response);

    const result = await diffCommand("empty-block");

    expect(result.files).toHaveLength(0);
  });
});
