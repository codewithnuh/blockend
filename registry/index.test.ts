import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { writeFile, mkdir, rm } from "node:fs/promises";

const exec = promisify(execFile);
const SCRIPT = path.resolve(import.meta.dirname, "..", "scripts", "validate-registry.mjs");
const TMP_DIR = path.resolve(import.meta.dirname, "..", ".tmp-test-registry");

interface MutableBlock {
  name: string;
  description: string;
  version?: string;
  frameworks?: string[];
  releasedAt?: string;
  runtimes?: Record<string, string>;
  requires?: string[];
  related?: string[];
  conflicts?: string[];
  dependencies?: string[];
  devDependencies?: string[];
  baseFiles?: Array<string | { source: string; target: string }>;
  adapters?: Record<string, Record<string, unknown>>;
  environments?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

interface MutableRegistry {
  version?: string;
  blocks?: Record<string, MutableBlock>;
  [key: string]: unknown;
}

async function runScript(
  registryObj: Record<string, unknown>
): Promise<{ code: number; stdout: string; stderr: string }> {
  await mkdir(TMP_DIR, { recursive: true });
  const regPath = path.join(TMP_DIR, "index.json");
  await writeFile(regPath, JSON.stringify(registryObj, null, 2), "utf-8");

  try {
    const result = await exec("node", [SCRIPT], {
      env: { ...process.env, TEST_REGISTRY_PATH: regPath },
      timeout: 10_000
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (err: unknown) {
    const execErr = err as { code?: number; stdout?: string; stderr?: string };
    return {
      code: execErr.code ?? 1,
      stdout: execErr.stdout ?? "",
      stderr: execErr.stderr ?? ""
    };
  } finally {
    await rm(TMP_DIR, { recursive: true, force: true });
  }
}

function makeValidRegistry(): MutableRegistry {
  return {
    version: "1.0.0",
    blocks: {
      "test-block": {
        name: "Test Block",
        description: "A test block for validation",
        version: "1.0.0",
        baseFiles: [{ source: "blocks/env-config/index.ts", target: "index.ts" }]
      }
    }
  };
}

describe("registry validation", () => {
  describe("release and compatibility metadata", () => {
    function makeRelatedRegistry(): MutableRegistry {
      const base = makeValidRegistry();
      base.blocks!["other-block"] = {
        name: "Other Block",
        description: "Second block for relationship tests",
        baseFiles: [{ source: "blocks/env-config/index.ts", target: "other.ts" }]
      };
      return base;
    }

    it("passes with valid release and relationship metadata", async () => {
      const reg = makeRelatedRegistry();
      reg.blocks!["test-block"].releasedAt = "2026-01-15";
      reg.blocks!["test-block"].runtimes = { node: ">=20" };
      reg.blocks!["test-block"].related = ["other-block"];
      reg.blocks!["test-block"].requires = ["other-block"];
      reg.blocks!["other-block"].conflicts = [];
      const result = await runScript(reg);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Registry valid");
    });

    it("fails when releasedAt is not a valid ISO date", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].releasedAt = "not-a-date";
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("releasedAt");
      expect(result.stderr).toContain("valid ISO date");
    });

    it("fails when releasedAt is not a real calendar date", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].releasedAt = "2026-02-30";
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("valid ISO date");
    });

    it("fails when runtimes uses an unsupported engine", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].runtimes = { deno: ">=2.0.0" };
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("runtimes");
    });

    it("fails when related references an unknown slug", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].related = ["missing-block"];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Unknown block reference");
      expect(result.stderr).toContain("missing-block");
      expect(result.stderr).toContain("blocks.test-block.related[0]");
    });

    it("fails when requires references an unknown slug", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].requires = ["nope-block"];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Unknown block reference");
      expect(result.stderr).toContain("nope-block");
    });

    it("fails when conflicts references an unknown slug", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].conflicts = ["ghost-block"];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Unknown block reference");
      expect(result.stderr).toContain("ghost-block");
    });

    it("fails when a block references itself", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].related = ["test-block"];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("cannot reference itself");
    });

    it("fails when requires forms a cycle", async () => {
      const reg = makeRelatedRegistry();
      reg.blocks!["test-block"].requires = ["other-block"];
      reg.blocks!["other-block"].requires = ["test-block"];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Circular requires chain");
    });

    it("fails when a relationship slug is not a valid slug format", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].related = ["Not_A_Slug"];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("valid registry slugs");
    });
  });

  describe("structural validation", () => {
    it("passes for a valid registry", async () => {
      const result = await runScript(makeValidRegistry());
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Registry valid");
    });

    it("fails when version is missing", async () => {
      const reg = makeValidRegistry();
      delete reg.version;
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Validation Failed");
    });

    it("fails when blocks is missing", async () => {
      const reg = { version: "1.0.0" };
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Validation Failed");
    });

    it("fails when block name is empty", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].name = "";
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("block name must not be empty");
    });

    it("fails when block description is empty", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].description = "";
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("block description must not be empty");
    });

    it("fails when block has no baseFiles, adapters, or environments", async () => {
      const reg = makeValidRegistry();
      delete reg.blocks!["test-block"].baseFiles;
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("must define at least one of");
    });

    it("fails when adapter has no variants", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].adapters = {
        express: { dependencies: [], variants: {} }
      };
      delete reg.blocks!["test-block"].baseFiles;
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("must have at least one variant");
    });
  });

  describe("duplicate detection", () => {
    it("fails on case-insensitive duplicate block keys", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["Test-Block"] = { ...reg.blocks!["test-block"] };
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Case-insensitive duplicate");
    });
  });

  describe("file existence", () => {
    it("fails when a baseFile source does not exist on disk", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].baseFiles = [
        { source: "blocks/nonexistent/file.ts", target: "file.ts" }
      ];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("File not found on disk");
      expect(result.stderr).toContain("blocks/nonexistent/file.ts");
    });

    it("fails when an adapter variant file does not exist on disk", async () => {
      const reg = makeValidRegistry();
      delete reg.blocks!["test-block"].baseFiles;
      reg.blocks!["test-block"].adapters = {
        express: {
          variants: {
            default: {
              files: [{ source: "blocks/nonexistent/adapter.ts", target: "adapter.ts" }]
            }
          }
        }
      };
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("File not found on disk");
      expect(result.stderr).toContain("blocks/nonexistent/adapter.ts");
    });
  });

  describe("dependency conflicts", () => {
    it("fails when the same package has conflicting version ranges", async () => {
      const reg = {
        version: "1.0.0",
        blocks: {
          "block-a": {
            name: "Block A",
            description: "First block",
            dependencies: ["zod@^4.0.0"],
            baseFiles: [{ source: "blocks/env-config/index.ts", target: "index.ts" }]
          },
          "block-b": {
            name: "Block B",
            description: "Second block",
            dependencies: ["zod@^3.0.0"],
            baseFiles: [{ source: "blocks/env-config/index.ts", target: "index.ts" }]
          }
        }
      };
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Conflicting version ranges for "zod"');
    });

    it("passes when all blocks use the same version range", async () => {
      const reg = {
        version: "1.0.0",
        blocks: {
          "block-a": {
            name: "Block A",
            description: "First block",
            dependencies: ["zod@^4.4.3"],
            baseFiles: [{ source: "blocks/env-config/index.ts", target: "index.ts" }]
          },
          "block-b": {
            name: "Block B",
            description: "Second block",
            dependencies: ["zod@^4.4.3"],
            baseFiles: [{ source: "blocks/env-config/index.ts", target: "index.ts" }]
          }
        }
      };
      const result = await runScript(reg);
      expect(result.code).toBe(0);
    });
  });

  describe("source-target collisions", () => {
    it("fails when baseFiles have duplicate targets", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].baseFiles = [
        { source: "blocks/env-config/index.ts", target: "output.ts" },
        { source: "blocks/env-config/index.test.ts", target: "output.ts" }
      ];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Duplicate target "output.ts"');
    });

    it("fails when variant files have duplicate targets", async () => {
      const reg = makeValidRegistry();
      delete reg.blocks!["test-block"].baseFiles;
      reg.blocks!["test-block"].adapters = {
        express: {
          variants: {
            default: {
              files: [
                { source: "blocks/env-config/index.ts", target: "output.ts" },
                { source: "blocks/env-config/index.test.ts", target: "output.ts" }
              ]
            }
          }
        }
      };
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Duplicate target "output.ts"');
    });
  });

  describe("actionable error output", () => {
    it("includes field path in error output", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].name = "";
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("blocks.test-block.name");
    });

    it("includes suggestion in error output", async () => {
      const reg = makeValidRegistry();
      reg.blocks!["test-block"].baseFiles = [
        { source: "blocks/nonexistent/file.ts", target: "file.ts" }
      ];
      const result = await runScript(reg);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Add the file or remove/update the registry entry");
    });
  });
});
