import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  applyBlock,
  createStaticRegistrySource,
  listAvailableBlocks,
  planBlock,
  previewBlock,
  type BlockendConfig,
  type RegistryManifest
} from "../block-install/index.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "blockend-block-install-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function config(overrides: Partial<BlockendConfig> = {}): BlockendConfig {
  return {
    $schema: "https://blockend.noorulhassan.com/schema.json",
    environment: "express",
    language: "typescript",
    packageManager: "npm",
    importRewriteStrategy: "rewrite",
    includeRedis: false,
    aliases: {},
    paths: { blocks: "./src/blocks" },
    installed: [],
    ...overrides
  };
}

const demoRegistry: RegistryManifest = {
  version: "1.0.0",
  blocks: {
    demo: {
      name: "Demo",
      description: "Demo block",
      version: "1.2.0",
      baseFiles: [
        { source: "blocks/demo/core.ts", target: "core.ts" },
        { source: "blocks/demo/types/index.ts", target: "types/index.ts" }
      ],
      dependencies: ["demo-core@^1.0.0"],
      adapters: {
        express: {
          dependencies: ["express@^5.0.0"],
          variants: {
            default: {
              devDependencies: ["@types/express@^5.0.0"],
              files: [
                {
                  source: "blocks/demo/adapters/express.ts",
                  target: "adapters/express.ts"
                }
              ]
            }
          }
        }
      }
    }
  }
};

const demoFiles = {
  "blocks/demo/core.ts": 'import { thing } from "./types";\nexport const core = thing;',
  "blocks/demo/types/index.ts": "export const thing = 1;",
  "blocks/demo/adapters/express.ts": 'import { core } from "../core";\nexport const adapter = core;'
};

describe("block install - planning", () => {
  it("resolves legacy environments and merges block, adapter, and variant dependencies", async () => {
    const registry: RegistryManifest = {
      blocks: {
        "rate-limit": {
          name: "Rate Limiter",
          description: "Rate limiting",
          environments: {
            express: {
              core: "blocks/rate-limiter/express/base.ts",
              devDependencies: ["@types/express"],
              variants: {
                memory: {
                  files: ["blocks/rate-limiter/express/memory.ts"]
                },
                redis: {
                  dependencies: ["ioredis"],
                  files: ["blocks/rate-limiter/express/redis.ts"]
                }
              }
            }
          }
        }
      }
    };

    const result = await planBlock(registry, "rate-limit", "express", { variant: "redis" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.variant).toBe("redis");
    expect(result.plan.variantKeys).toEqual(["memory", "redis"]);
    expect(result.plan.files).toEqual([
      { source: "blocks/rate-limiter/express/base.ts", target: "base.ts" },
      { source: "blocks/rate-limiter/express/redis.ts", target: "redis.ts" }
    ]);
    expect(result.plan.dependencies).toEqual(["ioredis"]);
    expect(result.plan.devDependencies).toEqual(["@types/express"]);
  });

  it("infers redis from disk when no variant is recorded", async () => {
    const dir = await makeTempDir();
    await mkdir(path.join(dir, "variants"), { recursive: true });
    await writeFile(path.join(dir, "variants", "redis-store.ts"), "marker", "utf-8");

    const registry: RegistryManifest = {
      blocks: {
        "rate-limit": {
          name: "Rate Limiter",
          description: "Rate limiting",
          adapters: {
            express: {
              variants: {
                memory: { files: [] },
                redis: { files: ["blocks/rate-limiter/redis.ts"] }
              }
            }
          }
        }
      }
    };

    const result = await planBlock(registry, "rate-limit", "express", { targetFolder: dir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.variant).toBe("redis");
  });

  it("returns no-adapter for a block whose frameworks list promises support but has no context", async () => {
    const registry: RegistryManifest = {
      blocks: {
        "token-service": {
          name: "Token Service",
          description: "Tokens",
          frameworks: ["*"],
          adapters: {
            express: { variants: { default: { files: [] } } }
          }
        }
      }
    };

    const result = await planBlock(registry, "token-service", "next");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("no-adapter");
    expect(result.error.message).toContain("no adapter or environment entry");
  });

  it("does not advertise blocks that cannot produce a plan for the environment", async () => {
    const registry: RegistryManifest = {
      blocks: {
        "express-only": {
          name: "Express Only",
          description: "Express",
          adapters: { express: { variants: { default: { files: [] } } } }
        },
        universal: {
          name: "Universal",
          description: "Universal",
          frameworks: ["*"],
          adapters: { "*": { variants: { default: { files: [] } } } }
        },
        "token-service": {
          name: "Token Service",
          description: "Tokens",
          frameworks: ["*"],
          adapters: { express: { variants: { default: { files: [] } } } }
        },
        "legacy-wildcard": {
          name: "Legacy Wildcard",
          description: "Legacy",
          environments: { "*": { variants: { memory: { files: [] } } } }
        },
        "no-variants": {
          name: "Empty",
          description: "Empty",
          adapters: { next: { variants: {} } }
        }
      }
    };

    const express = await listAvailableBlocks(registry, "express");
    expect(express.map((block) => block.name)).toEqual([
      "express-only",
      "universal",
      "token-service"
    ]);

    const next = await listAvailableBlocks(registry, "next");
    expect(next.map((block) => block.name)).toEqual(["universal"]);
  });
});

describe("block install - preview and apply", () => {
  it("previews new, modified, and unchanged files without writing", async () => {
    const dir = await makeTempDir();
    const targetFolder = path.join(dir, "demo");
    await mkdir(path.join(targetFolder, "adapters"), { recursive: true });
    await writeFile(path.join(targetFolder, "core.ts"), "old local", "utf-8");
    await writeFile(path.join(targetFolder, "adapters", "express.ts"), "remote", "utf-8");

    const source = createStaticRegistrySource(demoRegistry, {
      ...demoFiles,
      "blocks/demo/core.ts": "remote core",
      "blocks/demo/adapters/express.ts": "remote"
    });
    const planResult = await planBlock(demoRegistry, "demo", "express");
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const previews = await previewBlock(planResult.plan, { source, targetFolder });

    expect(previews.map((file) => [file.name, file.status])).toEqual([
      ["core.ts", "modified"],
      ["types/index.ts", "new"],
      ["adapters/express.ts", "unchanged"]
    ]);
    expect(await readFile(path.join(targetFolder, "core.ts"), "utf-8")).toBe("old local");
  });

  it("applies a plan, rewrites imports, and records the installed block", async () => {
    const root = await makeTempDir();
    const blocksRoot = path.join(root, "src", "blocks");
    const configPath = path.join(root, "blockend.json");
    await writeFile(configPath, JSON.stringify(config(), null, 2), "utf-8");

    const source = createStaticRegistrySource(demoRegistry, demoFiles);
    const planResult = await planBlock(demoRegistry, "demo", "express");
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const applied = await applyBlock(planResult.plan, {
      source,
      blocksRoot,
      rewriteStrategy: "rewrite",
      configPath
    });

    const targetFolder = path.join(blocksRoot, "demo");

    expect(await readFile(path.join(targetFolder, "core.ts"), "utf-8")).toBe(
      'import { thing } from "./types/index.js";\nexport const core = thing;'
    );
    expect(await readFile(path.join(targetFolder, "adapters", "express.ts"), "utf-8")).toBe(
      'import { core } from "../core.js";\nexport const adapter = core;'
    );

    expect(applied.record).toMatchObject({
      name: "demo",
      version: "1.2.0",
      variant: "default",
      files: ["core.ts", "types/index.ts", "adapters/express.ts"]
    });
    expect(applied.record.contentHash).not.toBe("0");

    const savedConfig = JSON.parse(await readFile(configPath, "utf-8")) as BlockendConfig;
    expect(savedConfig.installed).toEqual([applied.record]);
  });
});
