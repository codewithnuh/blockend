# Blockend CLI

> **shadcn/ui for your backend.**

Generate production-ready TypeScript backend blocks — rate limiting, validation, logging, error handling, configuration, health checks, and more — directly into your project from the terminal.

**You own the code.**

Blockend detects your framework, then copies audited, fully typed infrastructure source files directly into your repository. No runtime wrapper. No black box in `node_modules`. No lock-in.

---

## Quick Start

In any TypeScript backend project:

```bash
npx blockend-cli init
npx blockend-cli add rate-limiter
```

`init` detects your framework and creates a `blockend.json` configuration.

`add` copies the selected block into your project.

For example:

```text
src/
└── blocks/
    └── rate-limiter/
        ├── core.ts
        ├── express.ts
        └── ...
```

Open the files. Read them. Edit them. Commit them.

They're yours.

Blockend does not run inside your application and does not lock your project into a runtime dependency.

---

## Why Blockend?

Backend infrastructure is repetitive, but it still needs to be reliable, typed, and easy to customize.

Blockend gives you production-ready infrastructure as source code:

- Rate limiting
- Request validation
- Error handling
- Structured logging
- API response formatting
- Environment configuration
- Health checks
- Password hashing

Instead of installing another backend framework or runtime abstraction, Blockend generates the implementation directly into your repository.

---

## Installation

You don't need to install Blockend globally.

Run it directly with your package manager:

```bash
npx blockend-cli init
```

Or:

```bash
pnpm dlx blockend-cli init
```

```bash
yarn dlx blockend-cli init
```

```bash
bunx blockend-cli init
```

---

# Commands

## `init`

Detect your framework and initialize Blockend.

```bash
npx blockend-cli init
```

This creates:

```text
blockend.json
```

Blockend uses your project structure and detected framework to determine how blocks should be generated.

### Skip prompts

```bash
npx blockend-cli init --yes
```

or:

```bash
npx blockend-cli init -y
```

### JSON output

```bash
npx blockend-cli init --json
```

---

## `add`

Generate a specific backend block into your project.

```bash
npx blockend-cli add rate-limiter
```

Other examples:

```bash
npx blockend-cli add request-validator
```

```bash
npx blockend-cli add error-handler
```

```bash
npx blockend-cli add logger
```

### Interactive mode

Run `add` without specifying a block:

```bash
npx blockend-cli add
```

Blockend will display compatible blocks and let you choose one interactively.

### Add multiple blocks

```bash
npx blockend-cli add --multi
```

or:

```bash
npx blockend-cli add -m
```

### Skip confirmation

```bash
npx blockend-cli add rate-limiter --yes
```

or:

```bash
npx blockend-cli add rate-limiter -y
```

### JSON output

```bash
npx blockend-cli add rate-limiter --json
```

This is useful for automation and CI environments.

---

## `list`

List all available backend blocks.

```bash
npx blockend-cli list
```

Example:

```text
Available Blocks

rate-limiter
request-validator
error-handler
logger
response-formatter
env-config
health-check
password-hash
```

### JSON output

```bash
npx blockend-cli list --json
```

---

## `detect`

Detect information about your current project.

```bash
npx blockend-cli detect
```

Blockend can inspect:

- Framework
- Package manager
- TypeScript configuration
- Project structure
- Workspace configuration
- Runtime environment
- Relevant project directories

### JSON output

```bash
npx blockend-cli detect --json
```

---

## `diff`

Preview the files that a block would generate without modifying your project.

```bash
npx blockend-cli diff rate-limiter
```

This lets you inspect changes before adding a block.

### JSON output

```bash
npx blockend-cli diff rate-limiter --json
```

---

## `doctor`

Diagnose Blockend configuration and project issues.

```bash
npx blockend-cli doctor
```

Blockend checks your project for problems such as:

- Missing `blockend.json`
- Unsupported or undetected frameworks
- Invalid configuration
- Missing dependencies
- Invalid generated block layouts
- Project integration issues

### JSON output

```bash
npx blockend-cli doctor --json
```

---

## `update`

Check installed blocks for newer versions.

```bash
npx blockend-cli update
```

Blockend compares your installed blocks with newer available versions and shows their differences.

### Apply updates

```bash
npx blockend-cli update --apply
```

Blockend will let you select which blocks to update.

### JSON output

```bash
npx blockend-cli update --json
```

### Disable diff output

```bash
npx blockend-cli update --no-diff
```

---

# MCP Integration

Blockend ships with an MCP server so AI assistants can use vetted, framework-native backend blocks instead of generating infrastructure from scratch.

Supported clients include:

- Claude
- Cursor
- Codex
- VS Code
- Windsurf

## Configure MCP

Run:

```bash
npx blockend-cli mcp init
```

Or target a specific client:

```bash
npx blockend-cli mcp init --client claude
```

Supported client profiles:

```text
claude
codex
cursor
vscode
windsurf
```

### Preview configuration

```bash
npx blockend-cli mcp init --dry-run
```

### Force configuration

```bash
npx blockend-cli mcp init --force
```

### Skip confirmation

```bash
npx blockend-cli mcp init --yes
```

### Start the MCP server

```bash
npx blockend-cli mcp
```

Running `mcp` without a subcommand starts the Blockend MCP server.

---

# Available Blocks

| Block                | What it solves                                             |
| -------------------- | ---------------------------------------------------------- |
| `rate-limiter`       | Token bucket rate limiting with pluggable storage adapters |
| `request-validator`  | Zod-based input validation with framework adapters         |
| `error-handler`      | Centralized error pipeline with typed errors               |
| `logger`             | Structured request logging with async context propagation  |
| `response-formatter` | Standard API response shapes for success/error payloads    |
| `env-config`         | Type-safe environment validation with Zod schemas          |
| `health-check`       | Liveness/readiness probes for app and dependency health    |
| `password-hash`      | Argon2id password hashing with PHC-string output           |

---

# Supported Frameworks

Blockend currently supports:

- **Next.js**
- **Express**
- **Fastify**
- **Hono**

Each block ships with typed, framework-native adapters where appropriate.

More frameworks are coming soon.

---

# Example: Rate Limiter

Initialize Blockend:

```bash
npx blockend-cli init
```

Add the rate limiter:

```bash
npx blockend-cli add rate-limiter
```

You may get a structure similar to:

```text
src/
└── blocks/
    └── rate-limiter/
        ├── core.ts
        ├── express.ts
        ├── fastify.ts
        └── ...
```

The core implementation contains the framework-agnostic rate-limiting logic, while framework adapters integrate it with your application.

For example:

```ts
import { rateLimiter } from "./blocks/rate-limiter/express.js";
```

The implementation lives inside your repository.

You can modify it however you need.

---

# Source Ownership

Blockend follows a simple principle:

> **Generate it. Own it.**

Blockend does not hide your infrastructure behind a runtime package.

Instead of:

```ts
import { rateLimiter } from "blockend";
```

your application gets source code:

```ts
import { rateLimiter } from "./blocks/rate-limiter/express.js";
```

You can:

- Read the implementation
- Change the implementation
- Add your own features
- Remove code you don't need
- Commit it to Git
- Review it in pull requests
- Customize it for your architecture

---

# Automatic Dependencies

Blockend detects your package manager automatically.

Supported package managers include:

- npm
- pnpm
- yarn
- bun

When a block requires dependencies, Blockend installs the required packages using the detected package manager.

For example, a block using Zod can automatically install its required dependency.

You don't need to manually figure out which packages are required.

---

# TypeScript First

Blockend is designed for TypeScript backend projects.

Generated blocks are:

- Fully typed
- Framework-aware
- Production-oriented
- Designed for direct source ownership
- Compatible with strict TypeScript configurations

---

# Configuration

After running:

```bash
npx blockend-cli init
```

Blockend creates a project configuration file:

```text
blockend.json
```

A configuration may look like:

```json
{
  "framework": "express",
  "language": "typescript",
  "blocksDir": "src/blocks"
}
```

The exact configuration is determined from your project during initialization.

---

# CLI Overview

```text
blockend
│
├── init
│   ├── --yes
│   └── --json
│
├── add [block]
│   ├── --yes
│   ├── --json
│   └── --multi
│
├── list
│   └── --json
│
├── detect
│   └── --json
│
├── diff <block>
│   └── --json
│
├── doctor
│   └── --json
│
├── update
│   ├── --json
│   ├── --diff
│   └── --apply
│
└── mcp
    └── init
        ├── --client
        ├── --force
        ├── --dry-run
        └── --yes
```

---

# Typical Workflow

### 1. Initialize

```bash
npx blockend-cli init
```

### 2. Check your project

```bash
npx blockend-cli detect
```

### 3. Browse available blocks

```bash
npx blockend-cli list
```

### 4. Preview a block

```bash
npx blockend-cli diff rate-limiter
```

### 5. Add the block

```bash
npx blockend-cli add rate-limiter
```

### 6. Check your project

```bash
npx blockend-cli doctor
```

### 7. Keep blocks updated

```bash
npx blockend-cli update
```

### 8. Connect your AI assistant

```bash
npx blockend-cli mcp init
```

---

# Roadmap

The following blocks and capabilities are planned:

- JWT authentication
- CORS
- Security headers
- Idempotency
- Webhooks
- Additional framework adapters
- More storage adapters
- More AI/MCP integrations

---

# Documentation

Full documentation:

[https://blockend.noorulhassan.com/docs](https://blockend.noorulhassan.com/docs)

---

# Repository

Source code, issues, block implementations, and contribution guides:

[https://github.com/codewithnuh/blockend](https://github.com/codewithnuh/blockend)

If Blockend saves you from rewriting backend boilerplate, consider giving the project a star.

---

# Contributing

Contributions are welcome.

You can contribute by:

- Adding new backend blocks
- Improving existing blocks
- Adding framework adapters
- Improving documentation
- Reporting bugs
- Suggesting new infrastructure primitives
- Improving the CLI
- Improving MCP integrations

See the repository for contribution guidelines.

---

# License

MIT © CodeWithNuh

See the full license:

[https://github.com/codewithnuh/blockend/blob/master/LICENSE](https://github.com/codewithnuh/blockend/blob/master/LICENSE)
