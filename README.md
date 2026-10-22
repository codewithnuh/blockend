# Blockend

Blockend copies backend source files into your project. You choose a block, and the CLI writes its code into your repository. The code is yours: read it, change it, commit it, or remove it.

The CLI supports Express, Fastify, Next.js App Router, and Hono. The `add` command requires TypeScript.

## Quick start

```bash
npx blockend-cli init
npx blockend-cli add request-validator
```

`init` creates `blockend.json` with your framework, blocks directory, package manager, and import style. `add` writes the selected block.

```ts
import express from "express";
import { z } from "zod";
import { expressValidator } from "@/blocks/request-validator/adapters/express";

const app = express();
app.use(express.json());

const validate = expressValidator({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email()
  })
});

app.post("/users", validate, (req, res) => {
  const { body } = validate.validated(req);
  res.status(201).json({ user: body });
});

app.listen(3000);
```

If your `blockend.json` uses a different alias, import from that path instead. With no alias, use the relative path under `paths.blocks`.

## Blocks

| Block                                                                                          | What it does                                                               |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`rate-limiter`](https://blockend.noorulhassan.com/docs/02-blocks/01-rate-limiter)             | Fixed-window limits with memory and Redis stores.                          |
| [`error-handler`](https://blockend.noorulhassan.com/docs/02-blocks/02-global-error-handler)    | Classifies errors, hides internal details, and returns one response shape. |
| [`logger`](https://blockend.noorulhassan.com/docs/02-blocks/03-pino-logger)                    | Pino logger with request IDs and async context.                            |
| [`request-validator`](https://blockend.noorulhassan.com/docs/02-blocks/04-request-validator)   | Validates body, query, and params with Zod.                                |
| [`response-formatter`](https://blockend.noorulhassan.com/docs/02-blocks/05-response-formatter) | Success, error, and pagination envelopes.                                  |
| [`env-config`](https://blockend.noorulhassan.com/docs/02-blocks/06-env-config)                 | Validates environment variables with Zod at startup.                       |
| [`health-check`](https://blockend.noorulhassan.com/docs/02-blocks/07-health-check)             | Dependency checks with per-check timeouts and a JSON health report.        |
| [`graceful-shutdown`](https://blockend.noorulhassan.com/docs/02-blocks/08-graceful-shutdown)   | Drains requests and closes resources in priority order.                    |
| [`idempotency`](https://blockend.noorulhassan.com/docs/02-blocks/09-idempotency)               | Deduplicates retries with an atomic store lock.                            |
| [`password-hash`](https://blockend.noorulhassan.com/docs/02-blocks/10-password-hash)           | Argon2id hashing with a server-side pepper and rehash detection.           |
| [`token-service`](https://blockend.noorulhassan.com/docs/02-blocks/11-token-service)           | JWT access tokens and rotating refresh tokens.                             |

## How it works

1. `init` detects your project and writes `blockend.json`.
2. `add` filters the registry by framework, asks for a variant, and checks dependencies.
3. The CLI copies source files into your blocks directory and rewrites imports.
4. The block is recorded in `blockend.json` so `update` can compare versions.

There is no Blockend runtime dependency. Installed blocks use normal packages such as `zod`, `pino`, or `jose`.

## CLI

| Command                   | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| `blockend init`           | Create `blockend.json`.                                            |
| `blockend add <block>`    | Write a block into the project.                                    |
| `blockend add`            | Choose a block interactively.                                      |
| `blockend add --multi`    | Choose several blocks.                                             |
| `blockend list`           | List blocks for your framework.                                    |
| `blockend detect`         | Report framework, language, package manager, and project settings. |
| `blockend diff <block>`   | Preview files without writing.                                     |
| `blockend doctor`         | Check config and project health.                                   |
| `blockend update`         | Compare installed blocks with registry versions.                   |
| `blockend update --apply` | Apply selected updates.                                            |
| `blockend mcp`            | Start the MCP server.                                              |
| `blockend mcp init`       | Write MCP client config.                                           |

See the [CLI reference](https://blockend.noorulhassan.com/docs/cli-reference) for options.

## MCP

Blockend includes an MCP server for Claude Code, Cursor, VS Code, Codex CLI, and Windsurf.

```bash
npx blockend-cli mcp init --client cursor
```

The server exposes block listing, project detection, diff preview, install, update, and doctor tools. Installs run with `--yes`, so preview with the diff tool before writing.

## Local development

Prerequisites:

- Node.js 20 or newer
- pnpm

```bash
git clone https://github.com/codewithnuh/blockend.git
cd blockend
pnpm install
pnpm build
pnpm dev
```

Useful commands:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm validate
```

## Repository layout

```text
blockend/
├── apps/
│   └── web/                  Documentation site
├── blocks/                   Block source code
│   ├── error-handler/
│   ├── env-config/
│   ├── graceful-shutdown/
│   ├── health-check/
│   ├── idempotency/
│   ├── logger/
│   ├── password-hash/
│   ├── rate-limiter/
│   ├── request-validator/
│   ├── response-formatter/
│   └── token-service/
├── packages/
│   └── cli/                  CLI that copies blocks into projects
├── registry/
│   └── index.json            Block metadata and file mappings
├── scripts/
├── turbo.json
└── pnpm-workspace.yaml
```

Each block usually contains:

- `core/` or a core file with framework-agnostic logic
- `adapters/` for Express, Fastify, and Hono
- `variants/` for storage implementations
- tests next to the source

`registry/index.json` maps source files to the paths the CLI writes. Some blocks also provide framework-specific tests and SQL.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding a block. A block should solve a common backend problem, keep its core framework-independent, and include tests for each adapter it ships.

## Docs

- [Documentation](https://blockend.noorulhassan.com/docs)
- [CLI reference](https://blockend.noorulhassan.com/docs/cli-reference)
- [Block reference](https://blockend.noorulhassan.com/docs/blocks-reference)
- [Changelog](packages/cli/CHANGELOG.md)
- [Security policy](SECURITY.md)

## License

MIT. See [LICENSE](LICENSE).
