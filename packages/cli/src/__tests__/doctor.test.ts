import { describe, it, expect, vi, beforeEach } from "vitest";
import { doctorCommand } from "../commands/doctor.js";
import fs from "fs/promises";
import { existsSync } from "fs";

vi.mock("fs/promises");
vi.mock("fs", () => ({
  existsSync: vi.fn()
}));

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn(() => false),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn()
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

const mockDetectProject = vi.fn();
vi.mock("../detectors/index.js", () => ({
  get detectProject() {
    return mockDetectProject;
  }
}));

describe("doctorCommand - Configuration & Project Health", () => {
  const cwd = process.cwd();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "exit").mockImplementation((() => {}) as unknown as (
      code?: string | number | null
    ) => never);
    vi.spyOn(console, "log").mockImplementation(() => {});

    mockDetectProject.mockResolvedValue({
      root: cwd,
      framework: "express",
      language: "typescript",
      runtime: "node",
      packageManager: "pnpm",
      hasRedis: false,
      hasPrisma: false,
      hasDrizzle: false,
      aliasMap: {},
      srcDir: "src",
      blocksDir: "src/lib/blocks",
      importRewriteStrategy: "remove"
    });

    vi.mocked(existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (
        pathStr.endsWith("package.json") ||
        pathStr.endsWith("blockend.json") ||
        pathStr.endsWith("tsconfig.json") ||
        pathStr.endsWith("pnpm-lock.yaml") ||
        pathStr.includes("src/blocks") ||
        pathStr.includes("src\\blocks")
      ) {
        return true;
      }
      return false;
    });

    // Mock fs.access for findUp (used by doctor.ts)
    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (
        pathStr.endsWith("blockend.json") ||
        pathStr.endsWith("package.json") ||
        pathStr.endsWith("tsconfig.json")
      ) {
        return;
      }
      throw new Error("File not found");
    });

    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) {
        return JSON.stringify({
          environment: "express",
          language: "typescript",
          packageManager: "pnpm",
          importRewriteStrategy: "remove",
          paths: { blocks: "./src/blocks" }
        });
      }
      if (pathStr.endsWith("package.json")) {
        return JSON.stringify({
          name: "test-project",
          dependencies: { express: "^4.18.2" },
          devDependencies: {}
        });
      }
      throw new Error(`File not found: ${pathStr}`);
    });
  });

  it("should report all checks passing for a valid project configuration", async () => {
    const result = await doctorCommand();

    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    // All checks should have status "ok"
    expect(result.checks.every((c: { status: string }) => c.status === "ok")).toBe(true);
  });

  it("should report error when blockend.json is missing", async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json")) return false;
      if (pathStr.endsWith("package.json") || pathStr.endsWith("pnpm-lock.yaml")) return true;
      return false;
    });

    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("package.json") || pathStr.endsWith("tsconfig.json")) return;
      throw new Error("File not found");
    });

    const result = await doctorCommand();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e: { name: string }) => e.name === "blockend.json")).toBe(true);
  });

  it("should report error when package.json is missing", async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("package.json")) return false;
      if (pathStr.endsWith("blockend.json") || pathStr.endsWith("pnpm-lock.yaml")) return true;
      return false;
    });

    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json") || pathStr.endsWith("tsconfig.json")) return;
      throw new Error("File not found");
    });

    const result = await doctorCommand();

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e: { name: string }) => e.name === "package.json")).toBe(true);
  });

  it("should report warning when tsconfig.json is missing in a TypeScript project", async () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("tsconfig.json")) return false;
      if (
        pathStr.endsWith("package.json") ||
        pathStr.endsWith("blockend.json") ||
        pathStr.endsWith("pnpm-lock.yaml")
      )
        return true;
      return false;
    });

    vi.mocked(fs.access).mockImplementation(async (p) => {
      const pathStr = String(p);
      if (pathStr.endsWith("blockend.json") || pathStr.endsWith("package.json")) return;
      throw new Error("File not found");
    });

    const result = await doctorCommand();

    expect(result.warnings.some((w: { name: string }) => w.name === "tsconfig.json")).toBe(true);
  });

  it("should detect framework as unknown when no framework is found", async () => {
    mockDetectProject.mockResolvedValue({
      root: cwd,
      framework: "none",
      language: "typescript",
      runtime: "node",
      packageManager: "npm",
      hasRedis: false,
      hasPrisma: false,
      hasDrizzle: false,
      aliasMap: {},
      srcDir: "src",
      blocksDir: "src/lib/blocks",
      importRewriteStrategy: "remove"
    });

    const result = await doctorCommand();

    expect(result.warnings.some((w: { message: string }) => w.message.includes("framework"))).toBe(
      true
    );
  });

  it("should exit with non-zero code when errors are found", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
    mockDetectProject.mockRejectedValue(new Error("No project"));

    await doctorCommand();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should report checks as structured objects with name, status, and message", async () => {
    const result = await doctorCommand();

    for (const check of result.checks) {
      expect(check).toHaveProperty("name");
      expect(check).toHaveProperty("status");
      expect(check).toHaveProperty("message");
      expect(["ok", "warning", "error"]).toContain(check.status);
    }
  });

  it("should handle empty project directory gracefully", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockDetectProject.mockRejectedValue(new Error("No project found"));

    const result = await doctorCommand();

    expect(result.errors.length).toBeGreaterThan(0);
  });
});
