# Contributing to Blockend

Thank you for your interest in contributing to **Blockend**. Whether you're fixing a bug, improving documentation, adding a new block, or enhancing the CLI, your contributions are appreciated.

Before getting started, please read this guide to understand the project's architecture, development workflow, and contribution standards.

---

# Project Principles

Blockend is built around a few core principles that every contribution should follow.

## Framework-Agnostic Core

Business logic should remain independent of any specific HTTP framework. Shared functionality belongs in reusable core modules and should not rely on framework-specific APIs.

## Adapter-Based Architecture

Framework integrations should act as thin adapters that connect framework request/response lifecycles to the framework-independent core.

Adapters should avoid containing business logic whenever possible.

## Type Safety

The project uses strict TypeScript settings. New code should be fully typed and avoid `any` unless there is a strong justification.

---

# Development Setup

## Prerequisites

- Node.js 20+
- pnpm 10+

## Clone the Repository

```bash
git clone https://github.com/codewithnuh/blockend.git
cd blockend
```

## Install Dependencies

```bash
pnpm install
```

## Build the Project

```bash
pnpm build
```

## Run Tests

```bash
pnpm test
```

---

# Repository Structure

```text
.
├── packages/
│   ├── cli/
│   └── ...
├── registry/
│   ├── blocks/
│   ├── registry.json
│   └── registry-schema.json
├── .github/
└── ...
```

---

# Adding a New Block

Every new block consists of template files and a registry entry.

## 1. Create Template Files

Place templates under the appropriate directory inside `registry/blocks`.

Example:

```text
registry/
└── blocks/
    └── rate-limiter/
        └── express/
            ├── base.ts.txt
            ├── store-memory.ts.txt
            └── store-redis.ts.txt
```

Template files use the `.txt` extension because they are copied directly into user projects by the CLI.

---

## 2. Register the Block

Add an entry to `registry/registry.json`.

Every entry **must** conform to `registry-schema.json`.

Example:

```json
{
  "name": "Rate Limiter",
  "description": "IP-based rate limiting middleware",
  "environments": {
    "express": {
      "variants": {
        "memory": {
          "files": ["blocks/rate-limiter/express/store-memory.ts.txt"]
        }
      }
    }
  }
}
```

Do not modify the registry structure without updating the schema accordingly.

---

## Registry Architecture

Blockend currently supports **two registry layouts** for compatibility, but **all new contributions must use the modern adapter-based architecture.**

### ✅ Preferred (Modern)

New blocks should use the `adapters` field and separate framework integrations from the framework-agnostic core.

Example:

```json
{
  "name": "Rate Limiter",
  "description": "IP-based rate limiting middleware",
  "baseFiles": [
    {
      "source": "blocks/rate-limiter/core.ts.txt",
      "target": "core.ts"
    }
  ],
  "adapters": {
    "express": {
      "variants": {
        "memory": {
          "files": [
            {
              "source": "blocks/rate-limiter/adapters/express/memory.ts.txt",
              "target": "express/rate-limiter.ts"
            }
          ]
        }
      }
    }
  }
}
```

This architecture keeps business logic framework-agnostic while allowing each framework to provide a thin adapter layer.

### ⚠️ Legacy Layout

Older blocks may still use the `environments` field and layouts such as:

```text
blocks/
└── rate-limiter/
    └── express/
        ├── base.ts.txt
        ├── store-memory.ts.txt
        └── store-redis.ts.txt
```

or registry entries using:

```json
{
  "environments": {
    "express": {
      ...
    }
  }
}
```

These layouts remain supported **for backwards compatibility only**.

**Do not use this pattern for new blocks.** Existing legacy blocks may be migrated incrementally over time.

### Migration Guidelines

When contributing a new block:

- Use `baseFiles` for framework-independent core logic.
- Use `adapters` instead of `environments`.
- Keep adapters lightweight and free of business logic.
- Do not introduce new blocks using the legacy `rate-limiter/express/...` directory structure.
- Ensure all registry entries validate against `registry-schema.json`.

# Testing

All changes should include appropriate tests whenever practical.

Run the complete test suite before opening a pull request.

```bash
pnpm test
```

If your changes affect the CLI, verify the relevant commands manually.

Examples:

```bash
blockend init

blockend add <block>
```

---

# Coding Guidelines

- Follow the existing project structure and naming conventions.
- Keep functions focused and easy to understand.
- Avoid unnecessary dependencies.
- Prefer composition over duplication.
- Keep framework-specific logic inside adapters.
- Write clear commit messages.

---

# Pull Requests

Before submitting a pull request, ensure that:

- Your branch is up to date.
- All tests pass.
- New functionality includes tests where appropriate.
- Documentation has been updated if necessary.
- Registry changes conform to `registry-schema.json`.

Please complete the pull request template when opening a PR.

---

# Reporting Issues

When opening an issue, include:

- A clear description of the problem.
- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- Environment information (Node.js version, operating system, package manager, etc.).

---

# Questions

If you're unsure about an implementation or architectural decision, feel free to open a discussion or draft pull request before investing significant development time.

We appreciate every contribution that helps improve Blockend.
