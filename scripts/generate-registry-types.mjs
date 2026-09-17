/* oxlint-disable no-console */
import { promises as fs } from "fs";
import path from "path";

const REGISTRY_PATH = path.resolve(import.meta.dirname, "..", "registry", "index.json");
const OUTPUT_PATH = path.resolve(import.meta.dirname, "..", "registry", "generated.d.ts");

function toTypeScriptValue(obj, indent = 2) {
  const pad = " ".repeat(indent);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const items = obj.map((item) => `${pad}  ${toTypeScriptValue(item, indent + 2)}`);
    return `[\n${items.join(",\n")}\n${pad}]`;
  }
  if (obj !== null && typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    const entries = keys.map((k) => {
      const safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `"${k}"`;
      return `${pad}  ${safe}: ${toTypeScriptValue(obj[k], indent + 2)}`;
    });
    return `{\n${entries.join(",\n")}\n${pad}}`;
  }
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (obj === null) return "null";
  return JSON.stringify(obj);
}

async function main() {
  const raw = await fs.readFile(REGISTRY_PATH, "utf-8");
  const registry = JSON.parse(raw);
  const blockKeys = Object.keys(registry.blocks ?? {});

  const blockKeyUnion = blockKeys.map((k) => JSON.stringify(k)).join(" | ");

  const lines = [
    "// Auto-generated from registry/index.json — do not edit manually.",
    "// Run: pnpm generate:registry-types",
    "",
    `export type BlockKey = ${blockKeyUnion};`,
    "",
    "export type RegistryData = " + toTypeScriptValue(registry) + ";",
    "",
    `export declare const REGISTRY: RegistryData;`,
    ""
  ];

  await fs.writeFile(OUTPUT_PATH, lines.join("\n"), "utf-8");
  console.log(`✓ Generated ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Failed to generate registry types:", err.message);
  process.exit(1);
});
