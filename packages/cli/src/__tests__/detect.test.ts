import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { deriveBlocksAlias } from "../detectors/alias.js";
import { detectProject } from "../detectors/index.js";

const tempDirs: string[] = [];

async function createProject(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blockend-detect-"));
  tempDirs.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(root, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
  }

  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("detectProject - ProjectContext detection interface", () => {
  it("derives the blocks alias from tsconfig paths for the chosen directory", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({
        name: "fixture",
        dependencies: { next: "^15.0.0" }
      }),
      "tsconfig.json": `{
        // The chosen blocks directory lives under src.
        "compilerOptions": {
          "module": "NodeNext",
          "moduleResolution": "NodeNext",
          "paths": {
            "@/*": ["./src/*"] // Project alias.
          },
        }
      }
      /* A standalone block comment after the config. */`,
      "src/app/page.ts": ""
    });

    const context = await detectProject(root, { blocksDir: "src/blocks" });

    expect(context.framework).toBe("next");
    expect(context.language).toBe("typescript");
    expect(context.srcDir).toBe(join(root, "src"));
    expect(context.blocksDir).toBe(join(root, "src/blocks"));
    expect(context.blocksAlias).toBe("@/blocks");
    expect(context.aliasMap).toEqual({ "@/": "./src/" });
    expect(context.importRewriteStrategy).toBe("rewrite");
  });

  it("reads jsconfig paths without treating the project as TypeScript", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ name: "fixture" }),
      "jsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "~/*": ["src/*"]
          }
        }
      }),
      "src/index.js": ""
    });

    const context = await detectProject(root, { blocksDir: "src/modules/blocks" });

    expect(context.language).toBe("javascript");
    expect(context.blocksAlias).toBe("~/modules/blocks");
    expect(context.aliasMap).toEqual({ "~/": "src/" });
    expect(context.importRewriteStrategy).toBe("remove");
  });

  it("derives aliases from bare glob keys and absolute directories", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ name: "fixture" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "#*": ["lib/*"]
          }
        }
      }),
      "src/index.ts": ""
    });
    const blocksDir = join(root, "lib", "blocks");

    const context = await detectProject(root, { blocksDir });

    expect(context.blocksDir).toBe(blocksDir);
    expect(context.blocksAlias).toBe("#/blocks");
  });

  it("normalizes backslash separators when deriving aliases", () => {
    expect(deriveBlocksAlias({ "@/*": ["src/*"] }, "src\\infrastructure\\blocks")).toBe(
      "@/infrastructure/blocks"
    );
  });

  it("ignores malformed path targets", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ name: "fixture" }),
      "tsconfig.json": `{
        "compilerOptions": {
          "paths": {
            "@/*": null,
            "~/*": ["src/*"]
          }
        }
      }`,
      "src/index.ts": ""
    });

    const context = await detectProject(root, { blocksDir: "src/blocks" });

    expect(context.aliasMap).toEqual({ "~/": "src/" });
    expect(context.blocksAlias).toBe("~/blocks");
  });

  it("uses the default blocks directory when no directory is chosen", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ name: "fixture" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@/*": ["src/*"]
          }
        }
      }),
      "src/index.ts": ""
    });

    const context = await detectProject(root);

    expect(context.blocksDir).toBe(join(root, "src/lib/blocks"));
    expect(context.blocksAlias).toBe("@/lib/blocks");
  });

  it("omits the blocks alias when no path mapping matches", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ name: "fixture" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "#/*": ["lib/*"]
          }
        }
      }),
      "src/index.ts": ""
    });

    const context = await detectProject(root, { blocksDir: "src/blocks" });

    expect(context.blocksAlias).toBeUndefined();
  });
});
