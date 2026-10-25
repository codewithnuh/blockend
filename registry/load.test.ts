import { describe, expect, it } from "vitest";
import { parseRegistry, RegistryParseError } from "../packages/registry/src/index.js";

const legacyRegistry = {
  demo: {
    name: "Demo",
    description: "Legacy bare block map",
    baseFiles: [{ source: "blocks/demo/core.ts", target: "core.ts" }]
  }
};

describe("parseRegistry", () => {
  it("rejects the legacy bare block map by default", () => {
    expect(() => parseRegistry(legacyRegistry)).toThrow(RegistryParseError);
  });

  it("normalizes the legacy bare block map when explicitly allowed", () => {
    const registry = parseRegistry(legacyRegistry, { allowLegacy: true });

    expect(registry.version).toBe("0.0.0");
    expect(registry.blocks.demo.name).toBe("Demo");
  });
});
