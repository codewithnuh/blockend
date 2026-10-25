import { describe, expect, it } from "vitest";
import { buildCatalog, type Registry } from "../packages/registry/src/index.js";

const registry: Registry = {
  version: "1.0.0",
  blocks: {
    older: {
      name: "Older",
      description: "Older block",
      releasedAt: "2026-01-01",
      baseFiles: [{ source: "blocks/older/core.ts", target: "core.ts" }]
    },
    newer: {
      name: "Newer",
      description: "Newer block",
      releasedAt: "2026-02-01",
      frameworks: ["*"],
      adapters: {
        express: {
          variants: {
            memory: { files: [{ source: "blocks/newer/express.ts", target: "express.ts" }] }
          }
        }
      }
    }
  }
};

describe("buildCatalog", () => {
  it("derives catalog entries and sorts newest first", () => {
    const catalog = buildCatalog(registry, {
      tagForKey: (key) => (key === "newer" ? "HTTP" : "Block"),
      docHrefForKey: (key) => `/docs/${key}`
    });

    expect(catalog.map((block) => block.key)).toEqual(["newer", "older"]);
    expect(catalog[0]).toMatchObject({
      name: "Newer",
      tag: "HTTP",
      docHref: "/docs/newer",
      command: "blockend-cli add newer",
      frameworkLabel: "express",
      variantCount: 1,
      isAgnostic: true
    });
  });
});
