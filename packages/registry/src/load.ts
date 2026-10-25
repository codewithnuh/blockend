import { promises as fs } from "node:fs";
import {
  RecipeCollectionSchema,
  RegistrySchema,
  type RecipeCollection,
  type Registry
} from "./schema.js";

export class RegistryParseError extends Error {
  constructor(
    message: string,
    readonly issues?: unknown
  ) {
    super(message);
    this.name = "RegistryParseError";
  }
}

function formatIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Older CLI releases accepted a bare block map at the top level. Keep that
 * compatibility at the network boundary, but normalize it into the canonical
 * `{ version, blocks }` shape before anything downstream sees it.
 */
function isLegacyRegistry(input: unknown): input is Record<string, unknown> {
  if (!isRecord(input)) return false;
  const blocks = input.blocks;
  if (!isRecord(blocks)) {
    return typeof input.version !== "string";
  }
  return "name" in blocks || "description" in blocks;
}

export interface ParseRegistryOptions {
  /** Accept the pre-v2 bare block map shape used by older CLI clients. */
  allowLegacy?: boolean;
}

export function parseRegistry(input: unknown, options: ParseRegistryOptions = {}): Registry {
  let result = RegistrySchema.safeParse(input);

  if (!result.success && options.allowLegacy && isLegacyRegistry(input)) {
    result = RegistrySchema.safeParse({ version: "0.0.0", blocks: input });
  }

  if (!result.success) {
    throw new RegistryParseError(
      `Invalid registry:\n${formatIssues(result.error.issues)}`,
      result.error.issues
    );
  }
  return result.data;
}

export function parseRecipeCollection(input: unknown): RecipeCollection {
  const result = RecipeCollectionSchema.safeParse(input);
  if (!result.success) {
    throw new RegistryParseError(
      `Invalid recipe collection:\n${formatIssues(result.error.issues)}`,
      result.error.issues
    );
  }
  return result.data;
}

export async function loadRegistryFile(filePath: string): Promise<Registry> {
  const raw = await fs.readFile(filePath, "utf-8");
  try {
    return parseRegistry(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new RegistryParseError(`Registry at ${filePath} is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

export async function loadRecipeCollectionFile(filePath: string): Promise<RecipeCollection> {
  const raw = await fs.readFile(filePath, "utf-8");
  try {
    return parseRecipeCollection(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new RegistryParseError(
        `Recipe collection at ${filePath} is not valid JSON: ${error.message}`
      );
    }
    throw error;
  }
}
