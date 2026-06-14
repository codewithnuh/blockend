<div align="center">

```
██████╗ ██╗      ██████╗  ██████╗██╗  ██╗███████╗███╗   ██╗██████╗
██╔══██╗██║     ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝████╗  ██║██╔══██╗
██████╔╝██║     ██║   ██║██║     █████╔╝ █████╗  ██╔██╗ ██║██║  ██║
██╔══██╗██║     ██║   ██║██║     ██╔═██╗ ██╔══╝  ██║╚██╗██║██║  ██║
██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗███████╗██║ ╚████║██████╔╝
╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═════╝
```

**shadcn/ui for backend engineers.**

Copy production-ready backend blocks into your project. No runtime dependency. No black box. Just your code.

[![npm](https://img.shields.io/npm/v/blockend?color=0ea5e9&label=blockend)](https://npmjs.com/package/blockend)
[![license](https://img.shields.io/github/license/codewithnuh/blockend?color=0ea5e9)](./LICENSE)
[![blocks](https://img.shields.io/badge/blocks-1-0ea5e9)](#available-blocks)

</div>

---

## The Problem

Every Node.js backend starts the same way.

You need a rate limiter. You `npm install` something, wrap it in middleware, and move on. Three months later you hit a bug in the library. You open the source. It is 2,000 lines of code you have never read, written in a way you would not have chosen, doing things you do not need. You are now debugging someone else's abstractions at 2am.

Or you build it yourself — again — from scratch — again — copying patterns from your last project, adjusting for this framework, this ORM, this Redis client.

There is a better way.

---

## What Blockend Does

Blockend copies battle-tested backend code **directly into your project**. You own it. You read it. You change it.

```bash
npx blockend add rate-limiter
```

That is all. Blockend detects your framework, your language, your aliases, your dependencies — and writes clean, typed, production-ready code into your project, adapted to your setup. No wrapper. No config object. No version to keep updated.

It is your code now.

---

## How It Works

```
                    your project
                         │
npx blockend add         │
   rate-limiter          ▼
        │        ┌───────────────┐
        │        │   detector    │  reads package.json, tsconfig,
        │        │               │  lockfiles, directory structure
        │        └───────┬───────┘
        │                │  ProjectContext
        ▼                ▼
  ┌──────────┐   ┌───────────────┐
  │ registry │   │  transformer  │  rewrites imports, filters
  │ (github) │──▶│               │  adapters, resolves paths
  └──────────┘   └───────┬───────┘
                         │  TransformedFile[]
                         ▼
               src/lib/blocks/rate-limiter/
                 ├── index.ts
                 ├── types.ts
                 ├── algorithms/
                 │   └── token-bucket.ts
                 └── adapters/
                     └── memory.ts   ← redis adapter skipped,
                                       no ioredis detected
```

The registry is static files on GitHub. The CLI is a transform pipeline. Nothing runs in production except your code.

---

## Demo

```
$ npx blockend init

  blockend init

  ┌ Detected configuration ─────────────────────
  │
  │  Framework:       fastify
  │  Language:        typescript
  │  Package manager: pnpm
  │  Source dir:      /project/src
  │  Blocks dir:      /project/src/lib/blocks
  │  Redis:           not found
  │  Prisma:          detected
  │
  └──────────────────────────────────────────────

  ✔ Does this look correct? Yes

  ✓ blockend.json created. Run blockend add <block> to get started.
```

```
$ npx blockend add rate-limiter

  blockend add

  ✔ Fetched rate-limiter v1.0.0

  ┌ Files to be written ──────────────────────────
  │
  │  src/lib/blocks/rate-limiter/index.ts
  │  src/lib/blocks/rate-limiter/types.ts
  │  src/lib/blocks/rate-limiter/algorithms/token-bucket.ts
  │  src/lib/blocks/rate-limiter/adapters/memory.ts
  │
  └───────────────────────────────────────────────

  ✔ Continue? Yes

  ┌ Result ───────────────────────────────────────
  │  Written: 4 files
  └───────────────────────────────────────────────

  ✓ rate-limiter added successfully
```

Then in your app:

```typescript
import { tokenBucket } from "./lib/blocks/rate-limiter";
import { MemoryStore } from "./lib/blocks/rate-limiter/adapters/memory";

const store = new MemoryStore();

app.addHook("preHandler", async (req, reply) => {
  const result = await tokenBucket(req.ip, store, 100, 60);

  reply.header("RateLimit-Limit", result.limit);
  reply.header("RateLimit-Remaining", result.remaining);
  reply.header("RateLimit-Reset", result.resetAt);

  if (!result.allowed) {
    return reply.status(429).send({ error: "Too many requests" });
  }
});
```

---

## Why Not Just Use a Library?

|                             | Library | Blockend    |
| --------------------------- | ------- | ----------- |
| Runtime dependency          | Yes     | **No**      |
| You read the code           | Rarely  | **Always**  |
| Adapts to your project      | No      | **Yes**     |
| Can modify internals        | Painful | **Trivial** |
| Breaks on major versions    | Yes     | **Never**   |
| Works offline after install | No      | **Yes**     |
| Auditable in your repo      | No      | **Yes**     |

This is not anti-library. Libraries are the right choice for complex, high-churn dependencies. But rate limiters, error handlers, loggers, pagination utilities — these are patterns, not products. They are short enough to read, stable enough to own, and specific enough that a generic solution always makes you work around it.

---

## Intelligence Built In

Blockend does not blindly copy files. Before writing anything it analyzes your project:

**Framework detection** reads your `package.json` dependencies. Fastify project? You get the Fastify adapter. Express? Express adapter. No framework? Core logic only.

**Language detection** reads your `tsconfig.json`. TypeScript project gets `.ts` files with full type annotations. JavaScript project gets `.js` files with JSDoc.

**Import rewriting** reads your `compilerOptions.paths`. If your project uses `@/` as a path alias, every import in the copied block is rewritten to match. No manual fixing.

**Adapter filtering** reads your installed dependencies. No `ioredis` in your project? The Redis adapter is skipped and you get the in-memory adapter instead — with a comment telling you exactly how to switch when you add Redis.

**Package manager detection** reads your lockfiles. `pnpm-lock.yaml` present? Dependencies are installed with `pnpm add`. No guessing.

---

## Available Blocks

| Block               | Description                                                  | Status       |
| ------------------- | ------------------------------------------------------------ | ------------ |
| `rate-limiter`      | Token bucket rate limiting with Redis and in-memory adapters | ✅ Available |
| `error-handler`     | Structured error classes with Express/Fastify middleware     | 🔜 Coming    |
| `logger`            | Structured JSON logging via pino with request context        | 🔜 Coming    |
| `request-validator` | Zod-based input validation with typed errors                 | 🔜 Coming    |
| `env-config`        | Type-safe environment variable parsing, fails at startup     | 🔜 Coming    |
| `async-handler`     | Eliminates try/catch boilerplate in route handlers           | 🔜 Coming    |
| `pagination`        | Cursor and offset pagination helpers for any ORM             | 🔜 Coming    |
| `idempotency`       | Deduplication for payment and mutation endpoints             | 🔜 Coming    |

---

## Quick Start

```bash
# In your existing Node.js project
npx blockend init
npx blockend add rate-limiter
```

That is the full install. No global package needed. No configuration file to maintain. Run it once per block, per project.

---

## Commands

```bash
blockend init               # detect your project, write blockend.json
blockend list               # browse available blocks
blockend add <block>        # copy a block into your project
blockend add <block> --smart  # copy + get AI-powered integration hints
```

### The `--smart` Flag

Pass `--smart` to get context-aware integration instructions. Blockend reads your entry file (e.g. `src/index.ts`) and tells you exactly where to add the middleware registration, what to import, and the minimum wiring to get it working.

```bash
ANTHROPIC_API_KEY=sk-... npx blockend add rate-limiter --smart
```

```
  ┌ How to use this block ────────────────────────────────
  │
  │  Add this import at line 3 of src/index.ts:
  │    import { tokenBucket } from './lib/blocks/rate-limiter'
  │    import { MemoryStore } from './lib/blocks/rate-limiter/adapters/memory'
  │
  │  Register the hook after line 12 (after your existing plugins):
  │    const store = new MemoryStore()
  │    app.addHook('preHandler', async (req, reply) => { ... })
  │
  └────────────────────────────────────────────────────────
```

---

## Project Structure After Install

```
your-project/
├── src/
│   ├── lib/
│   │   └── blocks/               ← blockend writes here
│   │       └── rate-limiter/
│   │           ├── index.ts
│   │           ├── types.ts
│   │           ├── algorithms/
│   │           │   └── token-bucket.ts
│   │           └── adapters/
│   │               └── memory.ts
│   └── index.ts
├── blockend.json                 ← tracks what you've installed
└── package.json
```

`blockend.json` is a lockfile for your blocks. It records what version you installed and when, so you can audit changes in code review.

---

## The `blockend.json` File

```json
{
  "$schema": "https://blockend.dev/schema.json",
  "framework": "fastify",
  "language": "typescript",
  "blocksDir": "src/lib/blocks",
  "aliases": {
    "@/": "./src/"
  },
  "installed": [
    {
      "name": "rate-limiter",
      "version": "1.0.0",
      "installedAt": "2025-03-14T09:00:00.000Z"
    }
  ]
}
```

Commit this file. It is your record of what blocks your project uses and at what version.

---

## Contributing a Block

A block is a directory with a `block.json` manifest and source files. That is it.

```
blocks/
└── your-block/
    ├── block.json     ← name, version, files, adapters, deps
    └── src/
        ├── index.ts   ← re-exports everything
        ├── types.ts   ← all shared interfaces
        └── ...
```

**Rules for a block to be accepted:**

- Zero runtime dependencies unless absolutely unavoidable
- Every exported function has a JSDoc comment explaining what it does
- Every file has a single responsibility
- An in-memory adapter must exist for anything that touches external infrastructure
- Tests live in `blocks/your-block/tests/`
- The block must be used in at least one real production project before submission

Open an issue with your block idea before building. Ideas that duplicate existing blocks or require too many dependencies will be declined early, saving everyone time.

---

## Monorepo Structure

```
blockend/
├── apps/
│   ├── cli/          # the npx blockend tool
│   └── web/          # blockend.dev (coming)
├── packages/
│   ├── core/         # shared TypeScript types
│   ├── detector/     # project analysis engine
│   └── transformer/  # import rewriting + adapter filtering
└── blocks/           # the block registry
```

---

## Philosophy

**Blocks are patterns, not products.** A rate limiter is 80 lines of code. An error handler is 60. A logger wrapper is 40. These do not need to be distributed as packages with their own release cycles, changelogs, and breaking version histories. They need to be readable, ownable, and specific to your project.

**Ownership beats convenience.** The npm ecosystem has a dependency problem. Not in the "left-pad" sense — in the sense that most developers cannot describe what the packages in their `node_modules` actually do. Blockend trades a little convenience at install time for full ownership at runtime. You can read every line. You can change every line.

**Adapt to the project, not the other way around.** Every other solution to this problem asks you to configure it to match your project. Blockend reads your project first and adapts to you.

---

## Inspiration

Blockend is directly inspired by [shadcn/ui](https://ui.shadcn.com). The copy-paste model for UI components changed how frontend engineers think about component ownership. The same model applies to backend infrastructure code, and it is long overdue.

---

## License

MIT — [LICENSE](./LICENSE)

---

<div align="center">

Built by [Noor ul Hassan](https://github.com/codewithnuh) · [blockend.dev](https://blockend.dev) · [@codewithnuh](https://youtube.com/@codewithnuh)

**Star the repo if this resonates. The more blocks, the more useful it gets.**

</div>
