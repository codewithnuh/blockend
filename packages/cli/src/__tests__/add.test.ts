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

describe("addCommand - Execution Matrix", () => {
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

  const mockRegistry = {
    "pino-logger": {
      name: "Pino Logger",
      description: "Structured logging framework with modern adapters schema",
      baseFiles: [{ source: "blocks/pino-logger/core.ts.txt", target: "core.ts" }],
      adapters: {
        express: {
          devDependencies: ["@types/express", "@types/node"],
          variants: {
            default: {
              dependencies: ["pino", "pino-pretty"],
              files: [
                { source: "blocks/pino-logger/adapters/express.ts.txt", target: "express.ts" }
              ]
            }
          }
        }
      }
    },
    "rate-limit": {
      name: "Rate Limiter",
      description: "IP-based rate limiting using legacy environments configuration",
      environments: {
        express: {
          core: "blocks/rate-limiter/express/base.ts.txt",
          devDependencies: ["@types/express"],
          variants: {
            redis: {
              dependencies: ["ioredis"],
              files: ["blocks/rate-limiter/express/store-redis.ts.txt"]
            }
          }
        }
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "exit").mockImplementation((() => {}) as unknown as (
      code?: string | number | null
    ) => never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRegistry,
      text: async () => "mocked code content"
    } as unknown as Response);

    vi.mocked(prompts.confirm).mockResolvedValue(true);
  });

  it("should successfully parse modern adapters schema layouts and resolve base and adapter destinations", async () => {
    await addCommand("pino-logger");

    // Validates baseFiles array extraction
    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "src/blocks/pino-logger/core.ts"),
      "mocked code content",
      "utf-8"
    );

    // Validates structured adapters array extraction
    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "src/blocks/pino-logger/express.ts"),
      "mocked code content",
      "utf-8"
    );
  });

  it("should parse legacy schema layouts and resolve production destination paths securely", async () => {
    await addCommand("rate-limit");

    expect(fs.writeFile).toHaveBeenCalledWith(
      join(cwd, "src/blocks/rate-limit/base.ts.txt"),
      "mocked code content",
      "utf-8"
    );
  });

  it("should trigger distinct installation scripts for missing dependencies and devDependencies", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (
        pathStr.endsWith("pnpm-lock.yaml") ||
        pathStr.endsWith("blockend.json") ||
        pathStr.endsWith("package.json")
      ) {
        return;
      }
      throw new Error("File not found");
    });

    await addCommand("rate-limit");

    expect(exec).toHaveBeenCalledWith("pnpm add ioredis", expect.any(Object));
    expect(exec).toHaveBeenCalledWith("pnpm add -D @types/express", expect.any(Object));
  });

  it("should cancel process without overwriting if file collisions exist and confirm prompt returns false", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (
        pathStr.endsWith("base.ts.txt") ||
        pathStr.endsWith("store-redis.ts.txt") ||
        pathStr.endsWith("blockend.json") ||
        pathStr.endsWith("package.json")
      ) {
        return;
      }
      throw new Error("File not found");
    });

    vi.mocked(prompts.confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await addCommand("rate-limit");

    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining("preserved"));
  });
});
