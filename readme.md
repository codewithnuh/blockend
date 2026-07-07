```
██████╗ ██╗      ██████╗  ██████╗██╗  ██╗███████╗███╗   ██╗██████╗
██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝████╗  ██║██╔══██╗
██████╔╝██║     ██║   ██║██║     █████╔╝ █████╗  ██╔██╗ ██║██║  ██║
██╔══██╗██║     ██║   ██║██║     ██╔═██╗ ██╔══╝  ██║╚██╗██║██║  ██║
██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗███████╗██║ ╚████║██████╔╝
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═════╝
```

<div align="center">

_production backend blocks. generated into your project. owned by you._

[![npm](https://img.shields.io/npm/v/blockend-cli?color=0ea5e9&label=blockend-cli)](https://npmjs.com/package/blockend-cli)
[![license](https://img.shields.io/github/license/codewithnuh/blockend?color=0ea5e9)](./LICENSE)
[![blocks](https://img.shields.io/badge/blocks-5-0ea5e9)](#available-blocks)
[![docs](https://img.shields.io/badge/docs-blockend.noorulhassan.com/docs-0ea5e9)](https://blockend.noorulhassan.com)

</div>

## introduction

Blockend generates production-ready backend infrastructure — rate limiting, logging, error handling, validation, response formatting — directly into your project as plain source files you own and modify.

There is no runtime package to install. No API to stay compatible with. No black box to debug inside `node_modules`.

Blockend is a
[CLI tool](https://npmjs.com/package/blockend-cli),
[dependency-free at runtime](https://github.com/codewithnuh/blockend/blob/master/package.json) &
[MCP-enabled](https://blockend.noorulhassan.com/docs/mcp)

## motivation

- Why should rate limiting require learning another package's configuration API?
- Why should your error handler be defined by someone else's opinion of what an error looks like?
- Why should a logging package decide how your request context is shaped?
- Why should you have to read someone else's source when something breaks in production?

By removing the boundary between "dependency" and "your code," Blockend treats backend infrastructure as what it actually is: solved engineering problems that belong in your repository, not in your `node_modules`.

## quick start

```bash
npx blockend-cli init
npx blockend-cli add request-validator
```

The [`init`](https://blockend.noorulhassan.com/docs/cli/init) command sets up your `blocks/` directory. The [`add`](https://blockend.noorulhassan.com/docs/cli/add) command generates the block into it.

```ts
import { expressValidator } from "./blocks/request-validator/express.js";
import { z } from "zod";

const validate = expressValidator({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email()
  })
});

app.post("/users", validate, (req, res) => {
  res.status(201).json({ user: req.body });
});
```

The import above resolves to `./blocks/request-validator/express.ts` — a file sitting in your own repository. Open it, read it, change it. It belongs to you the moment it is generated.

## available blocks

| Block                                                                                    | Description                                                                             |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`rate-limiter`](https://blockend.noorulhassan.com/docs/blocks/rate-limiter)             | Token bucket algorithm with pluggable storage adapters (memory, Redis, Upstash)         |
| [`error-handler`](https://blockend.noorulhassan.com/docs/blocks/error-handler)           | Centralized error pipeline with typed `AppError`, HTTP status mapping, and logging seam |
| [`logger`](https://blockend.noorulhassan.com/docs/blocks/logger)                         | Structured request logging via `pino` with `AsyncLocalStorage` context propagation      |
| [`request-validator`](https://blockend.noorulhassan.com/docs/blocks/request-validator)   | Zod-based input validation with adapters for Express, Fastify, and Hono                 |
| [`response-formatter`](https://blockend.noorulhassan.com/docs/blocks/response-formatter) | Standardized API response envelope with consistent success, error, and metadata shapes  |

## installing

```bash
# add a block to your project
npx blockend-cli add <block-name>

# list all available blocks
npx blockend-cli list

# initialize blockend in an existing project
npx blockend-cli init
```

Blockend detects your package manager (npm, pnpm, yarn, bun) and generates TypeScript by default. JavaScript output is on the roadmap.

## mcp support

Blockend ships an MCP server so AI tools can add and configure blocks through natural language:

```bash
npx blockend-cli mcp init
```

Once connected, you can ask your AI assistant to add blocks, describe what each one generates, or scaffold entire middleware stacks — the MCP server handles the CLI interaction.

## website & docs

- <https://blockend.noorulhassan.com>
- <https://blockend.noorulhassan.com/docs>

## contributing

Want to contribute a block? Read the [contribution guidelines](CONTRIBUTING.md).

The bar for a new block: it must be infrastructure nearly every backend project needs, it must be implementable without deep runtime coupling, and it must be the kind of code a senior engineer would be comfortable reading in a production codebase.

If you have refined a utility across multiple projects and believe it belongs here, open an issue. Describe what it solves, what dependencies it requires, and what the public API looks like.

### local development

```bash
git clone https://github.com/codewithnuh/blockend
cd blockend
pnpm install
pnpm dev
```

The monorepo is structured with `packages/cli`, `packages/core`, `packages/registry`, and `apps/docs`. Each package has its own `README` with development notes.

## haiku

_another package—_  
_who wrote this, why does it break,_  
_where is the source code_

---

<div align="center">

[Documentation](https://blockend.noorulhassan.com/docs) · [npm](https://npmjs.com/package/blockend-cli) · [GitHub](https://github.com/codewithnuh/blockend) · [X](https://x.com/codewithnuh)

If Blockend is useful to you, a star on the repository helps others discover it.

</div>
