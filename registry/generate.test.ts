import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegistryIndex } from "../scripts/generate-registry-index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const REGISTRY_INDEX_PATH = path.join(REPO_ROOT, "registry", "index.json");

describe("registry index generation", () => {
  it("keeps registry/index.json in sync with the block declarations", async () => {
    const generated = await buildRegistryIndex();
    const checkedIn = (await readFile(REGISTRY_INDEX_PATH, "utf8")).replace(/\r\n/g, "\n");

    expect(checkedIn).toBe(generated);
  });
});
