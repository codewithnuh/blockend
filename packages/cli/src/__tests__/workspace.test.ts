import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import {
  detectWorkspace,
  findWorkspaceRoot,
  listWorkspacePackages,
  parsePnpmWorkspacePackages,
  readWorkspacePatterns
} from "../workspace/detect.js";

const tempDirs: string[] = [];

async function createProject(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blockend-workspace-"));
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

describe("parsePnpmWorkspacePackages", () => {
  it("reads only the packages list, stripping quotes and comments", () => {
    const content = [
      "packages:",
      '  - "apps/*"',
      "  - 'packages/*'",
      "  # a comment",
      "  - blocks",
      "allowBuilds:",
      "  core-js: true"
    ].join("\n");

    expect(parsePnpmWorkspacePackages(content)).toEqual(["apps/*", "packages/*", "blocks"]);
  });

  it("keeps negation patterns", () => {
    const content = ["packages:", '  - "apps/*"', '  - "!**/test/**"'].join("\n");

    expect(parsePnpmWorkspacePackages(content)).toEqual(["apps/*", "!**/test/**"]);
  });

  it("reads an inline flow array", () => {
    expect(parsePnpmWorkspacePackages("packages: ['apps/*', \"packages/*\"]")).toEqual([
      "apps/*",
      "packages/*"
    ]);
  });

  it("reads a flush block sequence with no indentation", () => {
    const content = ["packages:", "- 'apps/*'", "- packages/*"].join("\n");

    expect(parsePnpmWorkspacePackages(content)).toEqual(["apps/*", "packages/*"]);
  });
});

describe("findWorkspaceRoot", () => {
  it("finds the root from a nested package and recognises pnpm", async () => {
    const root = await createProject({
      "pnpm-workspace.yaml": 'packages:\n  - "apps/*"\n',
      "package.json": JSON.stringify({ name: "root", private: true }),
      "apps/api/package.json": JSON.stringify({ name: "api" })
    });

    expect(await findWorkspaceRoot(join(root, "apps", "api"))).toBe(root);

    const { manager, patterns } = await readWorkspacePatterns(root);
    expect(manager).toBe("pnpm");
    expect(patterns).toEqual(["apps/*"]);
  });

  it("recognises npm and yarn workspaces from package.json", async () => {
    const npmRoot = await createProject({
      "package.json": JSON.stringify({ name: "root", workspaces: ["apps/*"] })
    });
    expect((await readWorkspacePatterns(npmRoot)).manager).toBe("npm");

    const yarnRoot = await createProject({
      "package.json": JSON.stringify({
        name: "root",
        packageManager: "yarn@4.0.0",
        workspaces: { packages: ["packages/*"] }
      })
    });
    expect((await readWorkspacePatterns(yarnRoot)).manager).toBe("yarn");
  });

  it("recognises lerna and nx roots", async () => {
    const lernaRoot = await createProject({
      "lerna.json": JSON.stringify({ packages: ["modules/*"] }),
      "package.json": JSON.stringify({ name: "root" })
    });
    expect(await readWorkspacePatterns(lernaRoot)).toEqual({
      manager: "lerna",
      patterns: ["modules/*"]
    });

    const nxRoot = await createProject({
      "nx.json": JSON.stringify({}),
      "package.json": JSON.stringify({ name: "root", workspaces: ["apps/*"] })
    });
    expect((await readWorkspacePatterns(nxRoot)).manager).toBe("nx");
  });

  it("returns null for a single-package project", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ name: "solo" })
    });

    expect(await findWorkspaceRoot(root)).toBeNull();
    expect(await detectWorkspace(root)).toBeNull();
  });
});

describe("listWorkspacePackages", () => {
  it("resolves globs to packages and flags which have a config", async () => {
    const root = await createProject({
      "pnpm-workspace.yaml": 'packages:\n  - "apps/*"\n  - "packages/*"\n',
      "package.json": JSON.stringify({ name: "root" }),
      "apps/api/package.json": JSON.stringify({ name: "api" }),
      "apps/api/blockend.json": "{}",
      "apps/web/package.json": JSON.stringify({ name: "web" }),
      "packages/core/package.json": JSON.stringify({ name: "core" }),
      "apps/not-a-package/readme.md": "no package.json here"
    });

    const packages = await listWorkspacePackages(root, ["apps/*", "packages/*"]);
    const byDir = Object.fromEntries(packages.map((pkg) => [pkg.dir, pkg]));

    expect(Object.keys(byDir).sort()).toEqual(["apps/api", "apps/web", "packages/core"]);
    expect(byDir["apps/api"].hasConfig).toBe(true);
    expect(byDir["apps/api"].name).toBe("api");
    expect(byDir["apps/web"].hasConfig).toBe(false);
  });

  it("detects the whole workspace with manager, root, and packages", async () => {
    const root = await createProject({
      "pnpm-workspace.yaml": 'packages:\n  - "apps/*"\n',
      "package.json": JSON.stringify({ name: "root" }),
      "apps/api/package.json": JSON.stringify({ name: "api" })
    });

    const workspace = await detectWorkspace(join(root, "apps"));

    expect(workspace?.manager).toBe("pnpm");
    expect(workspace?.root).toBe(root);
    expect(workspace?.packages.map((pkg) => pkg.dir)).toEqual(["apps/api"]);
  });

  it("discovers Nx projects from their project.json settings", async () => {
    const root = await createProject({
      "nx.json": JSON.stringify({}),
      "package.json": JSON.stringify({ name: "root" }),
      "apps/api/project.json": JSON.stringify({ name: "api" }),
      "apps/web/project.json": JSON.stringify({ name: "web" })
    });

    const workspace = await detectWorkspace(root);

    expect(workspace?.manager).toBe("nx");
    expect(workspace?.packages.map((pkg) => pkg.dir)).toEqual(["apps/api", "apps/web"]);
    expect(workspace?.packages.map((pkg) => pkg.name)).toEqual(["api", "web"]);
  });
});
