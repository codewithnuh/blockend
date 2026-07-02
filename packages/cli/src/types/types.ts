/**
 * The full context of a user's project, detected by @blockend/detector.
 * This is the single source of truth read by all downstream packages.
 */
export interface ProjectContext {
  /** Absolute path to the project root (where package.json lives) */
  root: string;

  /** Whether the project uses TypeScript or plain JavaScript */
  language: "typescript" | "javascript";

  /** The detected Node.js-compatible runtime */
  runtime: "node" | "bun" | "deno";

  /** The detected HTTP framework, or 'none' if not found */
  framework: "express" | "fastify" | "hono" | "next" | "none";

  /** The package manager detected from lockfiles */
  packageManager: "npm" | "pnpm" | "yarn" | "bun";

  /** Whether ioredis or redis is in the project's dependencies */
  hasRedis: boolean;

  /** Whether @prisma/client is in the project's dependencies */
  hasPrisma: boolean;

  /** Whether drizzle-orm is in the project's dependencies */
  hasDrizzle: boolean;

  /** Parsed tsconfig paths/aliases, or empty object if none */
  aliasMap: Record<string, string>;

  /** The directory where source files live */
  srcDir: string;

  /** Path where Blockend should write block files */
  blocksDir: string;
}

/**
 * The manifest file (block.json) that every block must have.
 */
export interface BlockManifest {
  name: string;
  version: string;
  description: string;
  dependencies: string[];
  devDependencies: string[];
  optionalDependencies: Record<string, string>;
  files: string[];
  adapters: Array<"express" | "fastify" | "hono">;
  tags: string[];
}

/**
 * A single file fetched from the registry, before transformation.
 */
export interface RegistryFile {
  path: string;
  content: string;
}

/**
 * A file after transformation, ready to be written to the user's project.
 */
export interface TransformedFile {
  outputPath: string;
  content: string;
}

/**
 * The blockend.json config file written to the user's project root.
 */
export interface BlockendConfig {
  $schema: string;
  framework: ProjectContext["framework"];
  language: ProjectContext["language"];
  blocksDir: string;
  aliases: Record<string, string>;
  installed: Array<{
    name: string;
    version: string;
    installedAt: string;
  }>;
}
