import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { isCancel, select } from "@clack/prompts";
import { resolveProjectTarget, targetErrorMessage } from "../workspace/target.js";

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  isCancel: vi.fn(() => false)
}));

const tempDirs: string[] = [];

async function createProject(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blockend-target-"));
  tempDirs.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(root, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
  }

  return root;
}

const config = JSON.stringify({ environment: "express", paths: { blocks: "./src/blocks" } });

const workspaceFixture = {
  "pnpm-workspace.yaml": 'packages:\n  - "apps/*"\n',
  "package.json": JSON.stringify({ name: "root" }),
  "apps/api/package.json": JSON.stringify({ name: "api" }),
  "apps/web/package.json": JSON.stringify({ name: "web" })
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isCancel).mockReturnValue(false);
});

describe("resolveProjectTarget", () => {
  it("uses the nearest config in a single-package project", async () => {
    const root = await createProject({
      "package.json": JSON.stringify({ name: "solo" }),
      "blockend.json": config
    });

    const target = await resolveProjectTarget(root, { command: "add", interactive: false });

    expect(target.kind).toBe("package");
    if (target.kind === "package") {
      expect(target.rootDir).toBe(root);
      expect(target.configPath).toBe(join(root, "blockend.json"));
      expect(target.workspace).toBeNull();
    }
  });

  it("reports no-config when a single-package project is uninitialised", async () => {
    const root = await createProject({ "package.json": JSON.stringify({ name: "solo" }) });

    const target = await resolveProjectTarget(root, { command: "add", interactive: false });

    expect(target.kind).toBe("no-config");
    expect(targetErrorMessage(target)).toContain("blockend.json");
  });

  it("targets the containing package when the config lives there", async () => {
    const root = await createProject({
      ...workspaceFixture,
      "apps/api/blockend.json": config
    });

    const target = await resolveProjectTarget(join(root, "apps", "api"), {
      command: "add",
      interactive: false
    });

    expect(target.kind).toBe("package");
    if (target.kind === "package") {
      expect(target.rootDir).toBe(join(root, "apps", "api"));
      expect(target.workspace?.manager).toBe("pnpm");
    }
  });

  it("asks the user to init a package that has no config", async () => {
    const root = await createProject(workspaceFixture);

    const target = await resolveProjectTarget(join(root, "apps", "api"), {
      command: "add",
      interactive: false
    });

    expect(target.kind).toBe("needs-init");
    if (target.kind === "needs-init") {
      expect(target.package.dir).toBe("apps/api");
    }
    expect(targetErrorMessage(target)).toContain("apps/api");
  });

  it("emits --cwd guidance at a workspace root when non-interactive", async () => {
    const root = await createProject(workspaceFixture);

    const target = await resolveProjectTarget(root, { command: "add", interactive: false });

    expect(target.kind).toBe("guidance");
    const message = targetErrorMessage(target) ?? "";
    expect(message).toContain("monorepo root");
    expect(message).toContain("blockend add -c apps/api");
    expect(message).toContain("blockend add -c apps/web");
  });

  it("prompts for a package at the root when interactive", async () => {
    const root = await createProject({
      ...workspaceFixture,
      "apps/api/blockend.json": config
    });
    vi.mocked(select).mockResolvedValue("apps/api");

    const target = await resolveProjectTarget(root, { command: "add", interactive: true });

    expect(select).toHaveBeenCalledOnce();
    expect(target.kind).toBe("package");
    if (target.kind === "package") {
      expect(target.rootDir).toBe(join(root, "apps", "api"));
    }
  });

  it("reports cancellation when the package prompt is dismissed", async () => {
    const root = await createProject(workspaceFixture);
    vi.mocked(isCancel).mockReturnValue(true);
    vi.mocked(select).mockResolvedValue(Symbol("cancel") as never);

    const target = await resolveProjectTarget(root, { command: "add", interactive: true });

    expect(target.kind).toBe("cancelled");
  });

  it("auto-selects the sole package without prompting", async () => {
    const root = await createProject({
      "pnpm-workspace.yaml": 'packages:\n  - "apps/*"\n',
      "package.json": JSON.stringify({ name: "root" }),
      "apps/api/package.json": JSON.stringify({ name: "api" }),
      "apps/api/blockend.json": config
    });

    const target = await resolveProjectTarget(root, { command: "add", interactive: true });

    expect(select).not.toHaveBeenCalled();
    expect(target.kind).toBe("package");
    if (target.kind === "package") {
      expect(target.rootDir).toBe(join(root, "apps", "api"));
    }
  });

  it("initialises a nested workspace package instead of its parent", async () => {
    const root = await createProject({
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n  - "packages/*/plugins/*"\n',
      "package.json": JSON.stringify({ name: "root" }),
      "packages/foo/package.json": JSON.stringify({ name: "foo" }),
      "packages/foo/blockend.json": config,
      "packages/foo/plugins/bar/package.json": JSON.stringify({ name: "bar" })
    });

    const target = await resolveProjectTarget(join(root, "packages", "foo", "plugins", "bar"), {
      command: "init",
      interactive: false
    });

    expect(target.kind).toBe("needs-init");
    if (target.kind === "needs-init") {
      expect(target.package.dir).toBe("packages/foo/plugins/bar");
    }
  });

  it("uses a nested package's own config when it has one", async () => {
    const root = await createProject({
      "pnpm-workspace.yaml": 'packages:\n  - "packages/*"\n  - "packages/*/plugins/*"\n',
      "package.json": JSON.stringify({ name: "root" }),
      "packages/foo/package.json": JSON.stringify({ name: "foo" }),
      "packages/foo/blockend.json": config,
      "packages/foo/plugins/bar/package.json": JSON.stringify({ name: "bar" }),
      "packages/foo/plugins/bar/blockend.json": config
    });

    const target = await resolveProjectTarget(join(root, "packages", "foo", "plugins", "bar"), {
      command: "add",
      interactive: false
    });

    expect(target.kind).toBe("package");
    if (target.kind === "package") {
      expect(target.rootDir).toBe(join(root, "packages", "foo", "plugins", "bar"));
    }
  });

  it("ignores a config above the workspace root", async () => {
    const outer = await createProject({
      "blockend.json": config,
      "mono/pnpm-workspace.yaml": 'packages:\n  - "apps/*"\n',
      "mono/package.json": JSON.stringify({ name: "root" }),
      "mono/apps/api/package.json": JSON.stringify({ name: "api" })
    });

    const target = await resolveProjectTarget(join(outer, "mono", "apps", "api"), {
      command: "init",
      interactive: false
    });

    expect(target.kind).toBe("needs-init");
    if (target.kind === "needs-init") {
      expect(target.package.dir).toBe("apps/api");
    }
  });

  it("targets an Nx project discovered from project.json", async () => {
    const root = await createProject({
      "nx.json": JSON.stringify({}),
      "package.json": JSON.stringify({ name: "root" }),
      "apps/api/project.json": JSON.stringify({ name: "api" })
    });

    const target = await resolveProjectTarget(root, { command: "init", interactive: false });

    expect(target.kind).toBe("needs-init");
    if (target.kind === "needs-init") {
      expect(target.package.dir).toBe("apps/api");
    }
  });
});
