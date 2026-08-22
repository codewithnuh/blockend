import { describe, it, expect } from "vitest";
import {
  rewriteFileImports,
  parseDepSpec,
  semverSatisfies,
  getVersionConflicts,
  getMissingDependencies
} from "../commands/add.js";

// ── Import rewriting: external package preservation ───────────────────────────

describe("rewriteFileImports - External Package Preservation", () => {
  const blocksRoot = "/project/src/blocks";
  const writtenFilePath = "/project/src/blocks/rate-limit/adapters/express.ts";

  it("should NOT rewrite external npm package imports", () => {
    const input = `import type { Request, Response } from "express";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toBe(`import type { Request, Response } from "express";`);
  });

  it("should NOT rewrite vitest imports", () => {
    const input = `import { describe, it, expect } from "vitest";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toBe(`import { describe, it, expect } from "vitest";`);
  });

  it("should NOT rewrite pino imports", () => {
    const input = `import { pino } from "pino";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toBe(`import { pino } from "pino";`);
  });

  it("should NOT rewrite ioredis imports", () => {
    const input = `import Redis from "ioredis";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toBe(`import Redis from "ioredis";`);
  });

  it("should NOT rewrite scoped npm packages like @types/express", () => {
    const input = `import type { Request, Response } from "@types/express";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toBe(`import type { Request, Response } from "@types/express";`);
  });

  it("should NOT rewrite @modelcontextprotocol/sdk imports", () => {
    const input = `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toBe(`import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";`);
  });

  it("should rewrite relative imports correctly", () => {
    const input = `import { evaluateRateLimit } from "../core/core";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toBe(`import { evaluateRateLimit } from "../core/core.js";`);
  });

  it("should rewrite relative imports with .ts extension", () => {
    const input = `import { x } from "./utils/helper.ts";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toBe(`import { x } from "./utils/helper.js";`);
  });

  it("should remove .js extensions in bundler mode for relative imports", () => {
    const input = `import { x } from "./core.js";`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "remove");
    expect(result).toBe(`import { x } from "./core";`);
  });

  it("should resolve directory/index.ts imports for NodeNext", () => {
    const input = `import { HealthStatus } from "./types";`;
    const downloadedFiles = new Set(["types/index.ts", "core.ts"]);
    const result = rewriteFileImports(
      input,
      writtenFilePath,
      blocksRoot,
      undefined,
      "rewrite",
      downloadedFiles
    );
    expect(result).toBe(`import { HealthStatus } from "./types/index.js";`);
  });

  it("should handle mixed relative and external imports in one file", () => {
    const input = `
import type { Request } from "express";
import { evaluateRateLimit } from "../core/core";
import { pino } from "pino";
import { getClientIp } from "../utils/ip";
`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "rewrite");
    expect(result).toContain(`from "express"`);
    expect(result).toContain(`from "pino"`);
    expect(result).toContain(`from "../core/core.js"`);
    expect(result).toContain(`from "../utils/ip.js"`);
  });
});

describe("rewriteFileImports - does not touch external packages in remove mode", () => {
  const blocksRoot = "/project/src/blocks";
  const writtenFilePath = "/project/src/blocks/logger/core.ts";

  it("should remove .js from relative imports but leave external packages alone", () => {
    const input = `
import express from "express";
import { x } from "./utils.js";
import { y } from "../core/helper.js";
`;
    const result = rewriteFileImports(input, writtenFilePath, blocksRoot, undefined, "remove");
    expect(result).toContain(`from "express"`);
    expect(result).toContain(`from "./utils"`);
    expect(result).toContain(`from "../core/helper"`);
  });
});

// ── parseDepSpec ─────────────────────────────────────────────────────────────

describe("parseDepSpec", () => {
  it("should parse bare dependency name", () => {
    expect(parseDepSpec("vitest")).toEqual({ name: "vitest", versionRange: null });
  });

  it("should parse caret version range", () => {
    expect(parseDepSpec("vitest@^4.0.0")).toEqual({ name: "vitest", versionRange: "^4.0.0" });
  });

  it("should parse tilde version range", () => {
    expect(parseDepSpec("express@~4.18.0")).toEqual({ name: "express", versionRange: "~4.18.0" });
  });

  it("should parse gte version range", () => {
    expect(parseDepSpec("pino@>=9.0.0")).toEqual({ name: "pino", versionRange: ">=9.0.0" });
  });

  it("should parse exact version", () => {
    expect(parseDepSpec("zod@3.22.0")).toEqual({ name: "zod", versionRange: "3.22.0" });
  });

  it("should handle scoped packages", () => {
    expect(parseDepSpec("@types/express@^4.17.0")).toEqual({
      name: "@types/express",
      versionRange: "^4.17.0"
    });
  });

  it("should handle scoped package without version", () => {
    expect(parseDepSpec("@hono/node-server")).toEqual({
      name: "@hono/node-server",
      versionRange: null
    });
  });
});

// ── semverSatisfies ──────────────────────────────────────────────────────────

describe("semverSatisfies", () => {
  it("should satisfy caret range with compatible version", () => {
    expect(semverSatisfies("3.2.7", "^3.0.0")).toBe(true);
  });

  it("should satisfy caret range with higher minor", () => {
    expect(semverSatisfies("3.5.0", "^3.0.0")).toBe(true);
  });

  it("should NOT satisfy caret range with different major", () => {
    expect(semverSatisfies("2.9.0", "^3.0.0")).toBe(false);
  });

  it("should NOT satisfy caret range with next major", () => {
    expect(semverSatisfies("4.0.0", "^3.0.0")).toBe(false);
  });

  it("should satisfy tilde range with patch-level match", () => {
    expect(semverSatisfies("4.18.5", "~4.18.0")).toBe(true);
  });

  it("should NOT satisfy tilde range with different minor", () => {
    expect(semverSatisfies("4.19.0", "~4.18.0")).toBe(false);
  });

  it("should satisfy gte range", () => {
    expect(semverSatisfies("5.0.0", ">=4.0.0")).toBe(true);
  });

  it("should satisfy exact version", () => {
    expect(semverSatisfies("3.22.0", "3.22.0")).toBe(true);
  });

  it("should NOT satisfy different exact version", () => {
    expect(semverSatisfies("3.22.1", "3.22.0")).toBe(false);
  });
});

// ── getVersionConflicts ──────────────────────────────────────────────────────

describe("getVersionConflicts", () => {
  it("should detect version conflict when installed version is too old", () => {
    const conflicts = getVersionConflicts(["vitest@^4.0.0"], { vitest: "3.0.0" });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain("vitest");
    expect(conflicts[0]).toContain("^4.0.0");
    expect(conflicts[0]).toContain("3.0.0");
  });

  it("should detect no conflict when version is compatible", () => {
    const conflicts = getVersionConflicts(["vitest@^3.0.0"], { vitest: "3.2.7" });
    expect(conflicts).toHaveLength(0);
  });

  it("should not flag deps that have no version range", () => {
    const conflicts = getVersionConflicts(["vitest"], { vitest: "3.0.0" });
    expect(conflicts).toHaveLength(0);
  });

  it("should not flag deps that are not installed", () => {
    const conflicts = getVersionConflicts(["vitest@^4.0.0"], {});
    expect(conflicts).toHaveLength(0);
  });

  it("should detect multiple conflicts", () => {
    const conflicts = getVersionConflicts(["vitest@^4.0.0", "express@^4.18.0"], {
      vitest: "2.0.0",
      express: "3.0.0"
    });
    expect(conflicts).toHaveLength(2);
  });
});

// ── getMissingDependencies ───────────────────────────────────────────────────

describe("getMissingDependencies", () => {
  it("should return dep when not installed at all", () => {
    const missing = getMissingDependencies(["vitest@^4.0.0"], {});
    expect(missing).toEqual(["vitest@^4.0.0"]);
  });

  it("should return dep when installed version is incompatible", () => {
    const missing = getMissingDependencies(["vitest@^4.0.0"], { vitest: "3.0.0" });
    expect(missing).toEqual(["vitest@^4.0.0"]);
  });

  it("should skip dep when installed version satisfies range", () => {
    const missing = getMissingDependencies(["vitest@^3.0.0"], { vitest: "3.2.7" });
    expect(missing).toEqual([]);
  });

  it("should return @latest when no version range and forceLatest is true", () => {
    const missing = getMissingDependencies(["vitest"], { vitest: "3.0.0" }, true);
    expect(missing).toEqual(["vitest@latest"]);
  });

  it("should skip dep when no version range and forceLatest is false", () => {
    const missing = getMissingDependencies(["vitest"], { vitest: "3.0.0" }, false);
    expect(missing).toEqual([]);
  });

  it("should handle scoped packages correctly", () => {
    const missing = getMissingDependencies(["@types/express@^4.17.0"], {
      "@types/express": "4.14.0"
    });
    expect(missing).toEqual(["@types/express@^4.17.0"]);
  });

  it("should not return duplicate deps", () => {
    const missing = getMissingDependencies(["vitest@^3.0.0", "vitest@^3.0.0"], {});
    expect(missing).toEqual(["vitest@^3.0.0"]);
  });

  it("should handle mixed missing and present deps", () => {
    const missing = getMissingDependencies(["express@^4.18.0", "vitest@^3.0.0", "pino@^9.0.0"], {
      express: "4.18.2"
    });
    expect(missing).toContain("vitest@^3.0.0");
    expect(missing).toContain("pino@^9.0.0");
    expect(missing).not.toContain("express@^4.18.0");
  });
});
