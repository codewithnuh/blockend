# Blockend CLI

The Blockend CLI writes backend source blocks into a TypeScript project. It detects your framework, copies the selected files, installs missing packages, and records installed versions for updates.

## Quick start

From your project root:

```bash
npx blockend-cli init
npx blockend-cli add rate-limiter
```

`init` creates `blockend.json`. `add` writes the block under the configured blocks directory.

You can also run the CLI with other package runners:

```bash
pnpm dlx blockend-cli init
yarn dlx blockend-cli init
bunx blockend-cli init
```

## Requirements

- Node.js 20 or newer
- A TypeScript project for `add`
- Express, Fastify, Next.js App Router, or Hono
- Network access to GitHub for registry commands

The `add` command rejects JavaScript projects.

## Commands

### `init`

```bash
npx blockend-cli init [--yes] [--json]
```

Detects the framework, language, package manager, Redis, and import alias, then writes `blockend.json`.

`--yes` accepts detected defaults and overwrites an existing config without prompting. If no framework is detected, it uses Express.

### `add`

```bash
npx blockend-cli add [block] [options]
```

| Option    | Alias | Description                                                  |
| --------- | ----- | ------------------------------------------------------------ |
| `[block]` |       | Registry key, such as `rate-limiter` or `logger`.            |
| `--yes`   | `-y`  | Skip prompts, install dependencies, and overwrite conflicts. |
| `--json`  |       | Write machine-readable output.                               |
| `--multi` | `-m`  | Select multiple blocks.                                      |

Without a block name, the CLI opens a selector. For blocks with storage options, it asks for a variant. In interactive mode, `includeRedis: true` selects the Redis variant when one exists. With `--yes`, it selects memory when available, otherwise the first variant.

`add --yes` without a block name is an error.

Dependency installation runs `pnpm add` when `packageManager` is `pnpm`, and `npm install` for every other value. Yarn and bun projects should decline the install prompt and add the listed packages themselves.

### `list`

```bash
npx blockend-cli list [--json]
```

Lists blocks compatible with the framework in `blockend.json`.

### `detect`

```bash
npx blockend-cli detect [--json]
```

Reports framework, language, package manager, source directory, import rewrite strategy, and detected Redis, Prisma, and Drizzle usage. It does not require `blockend.json`.

### `diff`

```bash
npx blockend-cli diff <block> [--json]
```

Shows which files a block would add, modify, or leave unchanged. It does not write to disk.

### `doctor`

```bash
npx blockend-cli doctor [--json]
```

Checks `package.json`, `blockend.json`, `tsconfig.json`, lockfiles, framework detection, and the configured blocks directory. Text mode exits with code 1 on errors. JSON mode returns `success`, `warnings`, and `errors`.

### `update`

```bash
npx blockend-cli update [--json] [--diff] [--apply]
```

Compares installed blocks in `blockend.json` with registry versions. `--apply` prompts for blocks to update, confirms before writing, downloads new files, rewrites imports, and updates the installed metadata. In JSON mode, `--apply` updates every available block without prompting.

### `mcp`

```bash
npx blockend-cli mcp
npx blockend-cli mcp init [options]
```

Starts the MCP server or writes a client config. `mcp init` supports `--client`, `--dry-run`, `--force`, and `--yes`.

Supported clients: `claude`, `codex`, `cursor`, `vscode`, and `windsurf`.

## Config

A generated config looks like this:

```json
{
  "$schema": "https://blockend.noorulhassan.com/schema.json",
  "environment": "express",
  "language": "typescript",
  "packageManager": "pnpm",
  "importRewriteStrategy": "remove",
  "includeRedis": false,
  "aliases": {
    "blocks": "@/blocks"
  },
  "paths": {
    "blocks": "./src/blocks"
  }
}
```

`add` appends an `installed` array with block names, versions, install times, file lists, and content hashes.

## Generated structure

The rate limiter with the Express adapter and memory store is written as:

```text
src/
└── blocks/
    └── rate-limiter/
        ├── adapters/
        │   ├── express.ts
        │   └── express.test.ts
        ├── core/
        │   └── core.ts
        ├── utils/
        │   ├── ip.ts
        │   └── ip.test.ts
        └── variants/
            ├── memory-store.ts
            └── memory-store.test.ts
```

Import the adapter by its actual path:

```ts
import { expressRateLimit } from "@/blocks/rate-limiter/adapters/express";
import { MemoryStore } from "@/blocks/rate-limiter/variants/memory-store";
```

There is no root `index.ts` for the rate limiter. Importing from `@/blocks/rate-limiter` will fail.

## Import paths

Blocks are copied into `paths.blocks`. If `aliases.blocks` exists, imports use it, for example `@/blocks/logger/core`. If it does not, imports stay relative.

Blocks with a root `index.ts` can be imported from the block folder, for example:

```ts
import { createErrorBoundary } from "@/blocks/error-handler";
```

Blocks without one need a file path, for example:

```ts
import { createHealth } from "@/blocks/health-check/core/create-health";
```

Each block's documentation page lists the correct paths.

## License

MIT. See the repository [LICENSE](../../LICENSE).
