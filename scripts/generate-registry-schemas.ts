/* oxlint-disable no-console */
import { promises as fs } from "node:fs";
import path from "node:path";
import * as prettier from "prettier";
import { RecipeCollectionSchema, RegistrySchema } from "../packages/registry/src/index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

interface SchemaMetadata {
  file: string;
  title: string;
  id: string;
}

interface JsonSchemaCapable {
  toJSONSchema(params: { target: "draft-07" }): Record<string, unknown>;
}

const schemas: Array<{ schema: JsonSchemaCapable; metadata: SchemaMetadata }> = [
  {
    schema: RegistrySchema,
    metadata: {
      file: "registry/registry-schema.json",
      title: "BlockendRegistryManifest",
      id: "https://blockend.noorulhassan.com/registry-schema.json"
    }
  },
  {
    schema: RecipeCollectionSchema,
    metadata: {
      file: "registry/recipe-schema.json",
      title: "BlockendRecipeCollection",
      id: "https://blockend.noorulhassan.com/recipe-schema.json"
    }
  }
];

function buildJsonSchema(
  schema: JsonSchemaCapable,
  metadata: SchemaMetadata
): Record<string, unknown> {
  const { $schema: _ignored, ...generated } = schema.toJSONSchema({ target: "draft-07" });
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: metadata.id,
    title: metadata.title,
    $comment: "Generated from packages/registry/src/schema.ts. Do not edit manually.",
    ...generated
  };
}

async function main(): Promise<void> {
  for (const { schema, metadata } of schemas) {
    const json = buildJsonSchema(schema, metadata);
    const formatted = await prettier.format(JSON.stringify(json), { parser: "json" });
    const outputPath = path.join(REPO_ROOT, metadata.file);
    await fs.writeFile(outputPath, formatted, "utf-8");
    console.log(`Generated ${metadata.file}`);
  }
}

void main();
