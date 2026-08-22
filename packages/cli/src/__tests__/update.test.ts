import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateCommand } from "../commands/update.js";
import fs from "fs/promises";
import * as prompts from "@clack/prompts";

vi.mock("fs/promises", () => {
  const access = vi.fn();
  const readFile = vi.fn();
  const writeFile = vi.fn();
  const mkdir = vi.fn();
  const readdir = vi.fn();
  return {
    default: { access, readFile, writeFile, mkdir, readdir },
    access,
    readFile,
    writeFile,
    mkdir,
    readdir
  };
});

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
  multiselect: vi.fn(),
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

describe("updateCommand - Version Tracking", () => {
  const mockRegistry = {
    "pino-logger": {
      name: "Pino Logger",
      description: "Structured logging",
      version: "1.1.0",
      baseFiles: [{ source: "blocks/pino-logger/core.ts", target: "core.ts" }],
      adapters: {
        express: {
          variants: {
            default: {
              files: [{ source: "blocks/pino-logger/adapters/express.ts", target: "express.ts" }]
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
    vi.spyOn(process, "exit").mockImplementation((() => {}) as unknown as (
      code?: string | number | null
    ) => never);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRegistry,
      text: async () => "remote content v1.1.0"
    } as unknown as Response);
  });

  it("should report no blocks when blockend.json has empty installed array", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) return;
      throw new Error("not found");
    });
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) {
        return JSON.stringify({
          environment: "express",
          language: "typescript",
          aliases: { blocks: "@/blocks" },
          paths: { blocks: "./src/blocks" },
          installed: []
        });
      }
      throw new Error("not found");
    });

    const result = await updateCommand({ diff: false });

    expect(result.blocks).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("should detect update available when versions differ", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) return;
      throw new Error("not found");
    });
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) {
        return JSON.stringify({
          environment: "express",
          language: "typescript",
          aliases: { blocks: "@/blocks" },
          paths: { blocks: "./src/blocks" },
          installed: [
            {
              name: "pino-logger",
              version: "1.0.0",
              installedAt: "2024-01-01",
              files: ["core.ts"],
              contentHash: "abc"
            }
          ]
        });
      }
      throw new Error("not found");
    });

    const result = await updateCommand({ diff: false });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].name).toBe("pino-logger");
    expect(result.blocks[0].localVersion).toBe("1.0.0");
    expect(result.blocks[0].remoteVersion).toBe("1.1.0");
    expect(result.blocks[0].status).toBe("update-available");
  });

  it("should report up-to-date when versions match", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) return;
      throw new Error("not found");
    });
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) {
        return JSON.stringify({
          environment: "express",
          language: "typescript",
          aliases: { blocks: "@/blocks" },
          paths: { blocks: "./src/blocks" },
          installed: [
            {
              name: "pino-logger",
              version: "1.1.0",
              installedAt: "2024-01-01",
              files: ["core.ts"],
              contentHash: "abc"
            }
          ]
        });
      }
      throw new Error("not found");
    });

    const result = await updateCommand({ diff: false });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].status).toBe("up-to-date");
  });

  it("should return error when blockend.json is missing", async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error("not found"));

    const result = await updateCommand();

    expect(result.error).toBeDefined();
    expect(result.error).toContain("blockend.json");
  });

  it("should never write files in read-only mode", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) return;
      throw new Error("not found");
    });
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) {
        return JSON.stringify({
          environment: "express",
          language: "typescript",
          aliases: { blocks: "@/blocks" },
          paths: { blocks: "./src/blocks" },
          installed: []
        });
      }
      throw new Error("not found");
    });

    await updateCommand();

    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("should show diff when update is available", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) return;
      if (String(p).endsWith("core.ts")) return;
      throw new Error("not found");
    });
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) {
        return JSON.stringify({
          environment: "express",
          language: "typescript",
          aliases: { blocks: "@/blocks" },
          paths: { blocks: "./src/blocks" },
          installed: [
            {
              name: "pino-logger",
              version: "1.0.0",
              installedAt: "2024-01-01",
              files: ["core.ts"],
              contentHash: "abc"
            }
          ]
        });
      }
      if (pathStr.endsWith("core.ts")) return "old local content";
      throw new Error("not found");
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRegistry,
      text: async () => "new remote content"
    } as unknown as Response);

    const result = await updateCommand({ diff: true });

    expect(result.diffs).toBeDefined();
    expect(result.diffs!["pino-logger"]).toBeDefined();
    expect(result.diffs!["pino-logger"].some((d) => d.status === "modified")).toBe(true);
  });

  it("should apply updates when --apply is used with multiselect", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) return;
      if (String(p).endsWith("core.ts")) return;
      throw new Error("not found");
    });
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) {
        return JSON.stringify({
          environment: "express",
          language: "typescript",
          aliases: { blocks: "@/blocks" },
          paths: { blocks: "./src/blocks" },
          installed: [
            {
              name: "pino-logger",
              version: "1.0.0",
              installedAt: "2024-01-01",
              files: ["core.ts"],
              contentHash: "abc"
            }
          ]
        });
      }
      if (pathStr.endsWith("core.ts")) return "old local content";
      throw new Error("not found");
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRegistry,
      text: async () => "new remote content"
    } as unknown as Response);

    vi.mocked(prompts.multiselect).mockResolvedValue(["pino-logger"]);
    vi.mocked(prompts.confirm).mockResolvedValue(true);

    const result = await updateCommand({ apply: true, diff: false });

    expect(result.applied).toBeDefined();
    expect(result.applied).toContain("pino-logger");
    expect(fs.writeFile).toHaveBeenCalled();

    // Verify blockend.json was written with updated version (1.1.0)
    const writeFileCalls = vi.mocked(fs.writeFile).mock.calls;
    const blockendWrite = writeFileCalls.find((c) => String(c[0]).endsWith("blockend.json"));
    expect(blockendWrite).toBeDefined();
    const writtenConfig = JSON.parse(String(blockendWrite![1]));
    const updatedRecord = writtenConfig.installed.find(
      (b: { name: string }) => b.name === "pino-logger"
    );
    expect(updatedRecord).toBeDefined();
    expect(updatedRecord.version).toBe("1.1.0");
    expect(updatedRecord.contentHash).not.toBe("abc");
  });

  it("should not apply when multiselect returns empty", async () => {
    vi.mocked(fs.access).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) return;
      throw new Error("not found");
    });
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      if (String(p).endsWith("blockend.json")) {
        return JSON.stringify({
          environment: "express",
          language: "typescript",
          aliases: { blocks: "@/blocks" },
          paths: { blocks: "./src/blocks" },
          installed: [
            {
              name: "pino-logger",
              version: "1.0.0",
              installedAt: "2024-01-01",
              files: ["core.ts"],
              contentHash: "abc"
            }
          ]
        });
      }
      throw new Error("not found");
    });

    vi.mocked(prompts.multiselect).mockResolvedValue([]);

    const result = await updateCommand({ apply: true, diff: false });

    expect(result.applied).toBeUndefined();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
