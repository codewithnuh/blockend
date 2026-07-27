# Blockend AI Documentation Standard

**Version:** 2.0.0

**Applies to:** AI-generated documentation for every Blockend block located under `blocks/` and rendered using Fumadocs.

---

# Purpose

This document defines how AI agents must analyze Blockend source code and generate documentation.

The goal is to produce documentation that is:

- technically accurate
- beginner-friendly
- easy to scan
- copy-and-paste friendly
- consistent across every block
- synchronized with the implementation

Documentation must always be generated from the source code—not assumptions.

If implementation and existing documentation disagree, **the implementation always wins.**

---

# Core Principles

Documentation must answer these questions as quickly as possible:

- What does this block do?
- What problem does it solve?
- When should I use it?
- When should I avoid it?
- How do I install it?
- How do I configure it?
- How do I integrate it?
- What APIs are available?
- How does it work internally?

Documentation should allow users to use a block **without reading its source code.**

---

# Documentation Generation Workflow

Before generating documentation, AI **must complete the following workflow**.

## Step 1 — Locate the Block

Locate the requested block inside:

```text
blocks/<block-name>
```

Abort generation if the block does not exist.

---

## Step 2 — Scan the Entire Block

Recursively scan every file.

Read every source file completely.

Do not document a block after reading only `index.ts`.

Inspect:

- adapters
- core
- stores
- middleware
- helpers
- utilities
- types
- constants
- tests
- examples
- package metadata

---

## Step 3 — Build Internal Understanding

Before writing documentation, determine:

- block purpose
- request lifecycle
- architecture
- exported APIs
- configuration
- adapters
- stores
- runtime dependencies
- peer dependencies
- extension points
- generated files
- public types
- framework support

Documentation must be generated only after understanding how the block works.

---

## Step 4 — Verify Everything

Every statement must be traceable to one of:

1. Source code
2. Metadata
3. Tests
4. Examples

Never invent:

- features
- adapters
- stores
- APIs
- options
- configuration
- examples
- file names
- behaviors

If something cannot be verified, write:

> Not documented in source.

or

> None required.

Never guess.

---

# Source of Truth

Always inspect information in this order.

1. Block implementation
2. Block metadata
3. Public exports
4. Tests
5. Examples
6. Existing documentation (style only)

Implementation always overrides documentation.

---

# Writing Style

Documentation must:

- use clear English
- use present tense
- write in second person
- avoid marketing language
- prefer examples over explanations
- explain concepts before APIs
- be concise

Avoid filler.

Avoid repeating the same information.

---

# Terminology

Always use these terms consistently.

| Preferred                      | Do Not Use       |
| ------------------------------ | ---------------- |
| Block                          | Module           |
| Adapter                        | Plugin           |
| Store                          | Backend          |
| Peer Dependency                | Required Package |
| blockend-cli                   | CLI              |
| Copies files into your project | Installs source  |

Never introduce alternative terminology.

---

# Documentation Tone

Documentation should resemble:

- shadcn/ui
- Next.js
- Prisma
- Tailwind CSS

Write like technical documentation—not a blog post.

Avoid hype.

Explain practical benefits.

---

# Fumadocs Standards

Documentation uses Fumadocs.

Use built-in components whenever they improve readability.

Examples include:

- Tabs
- Steps
- Cards
- Accordion
- Callout
- Code Groups
- Auto TOC

Use Markdown when components provide no additional value.

---

# Source Code Rendering

Never duplicate implementation manually.

Whenever showing a source file, use:

```mdx
<SourceCode file="blocks/rate-limiter/core/core.ts" />
```

Do not paste source code directly into Markdown unless explicitly required.

The SourceCode component keeps documentation synchronized with implementation.

---

# File Structure

Every block page must include a file structure section.

Example:

````md
## File Structure

```text
rate-limiter
├── adapters
├── core
├── stores
├── utils
└── index.ts
```
````

Briefly explain the responsibility of every directory.

---

# Installation

Always begin with the Blockend CLI.

Example:

```bash
pnpm dlx blockend-cli add rate-limiter
```

Then list peer dependencies.

If none exist:

> No additional dependencies required.

---

# Manual File Setup

Every block that copies files must contain a manual installation section.

For every generated file:

- destination path
- why it exists
- SourceCode component

Example:

```mdx
### blocks/rate-limiter/core/core.ts

Core rate limiting engine.

<SourceCode file="blocks/rate-limiter/core/core.ts" />
```

Do not inline copied source code.

---

# Configuration

Document every configuration option.

Use tables.

| Name | Type | Default | Required | Description |
| ---- | ---- | ------- | -------- | ----------- |

If none exist:

> None required.

---

# Architecture

Every block page must explain:

- request flow
- responsibilities
- extension points
- lifecycle

Prefer diagrams.

Example:

```text
Request
   │
   ▼
Adapter
   │
   ▼
Core Engine
   │
   ▼
Store
   │
   ▼
Headers
```

---

# When to Use

Provide practical scenarios.

Avoid generic statements.

---

# When Not to Use

Be honest.

Explain when another approach is better.

---

# Usage

Generate documentation only for adapters that actually exist.

Detect adapters by scanning:

```text
blocks/<block>/adapters
```

If adapters exist:

```text
express.ts
fastify.ts
hono.ts
```

Generate:

```text
### Express

### Fastify

### Hono
```

Each adapter must include:

- imports
- initialization
- configuration
- runnable example

Never combine adapters into one example.

---

# Stores

Detect stores by scanning:

```text
blocks/<block>/stores
```

Generate documentation only for discovered stores.

Examples:

- Memory
- Redis

---

# API Reference

Inspect every public export.

Document:

- functions
- classes
- interfaces
- enums
- constants
- types

Ignore private implementation details.

Use this structure.

```text
#### createRateLimiter
```

Description

Parameters

| Name | Type | Required | Description |

Returns

Throws (if applicable)

Example

---

# Examples

Examples should include:

- basic usage
- production usage
- advanced configuration
- composition with other Blockend blocks
- edge cases

Every example must compile against the current API.

Never invent imports.

Never invent functions.

---

# Related Blocks

Detect relationships from imports and architecture.

Examples:

- Logger
- Response Formatter
- Error Handler

Explain why they work well together.

---

# FAQ

Generate concise FAQs only when answers can be verified from the implementation.

Do not invent questions.

---

# Changelog

Use semantic versions.

Newest first.

If unavailable:

> Initial documentation release.

---

# Required Page Structure

Every documentation page must follow this exact order.

```text
# Block Name

## Overview

## Features

## File Structure

## Installation

## Manual File Setup

## Configuration

## Architecture

## When to Use

## When Not to Use

## Usage

### Adapter 1

### Adapter 2

## API Reference

## Examples

## Related Blocks

## FAQ

## Changelog
```

Do not reorder sections.

Do not omit required sections.

---

# Markdown Rules

- One H1 per page.
- Use H2 for sections.
- Use H3 for adapters.
- Use H4 for API members.
- Use tables whenever appropriate.
- Use fenced code blocks.
- Use `bash` for shell commands.
- Use `typescript` for TypeScript.
- Use `json` for JSON.
- Use normal Markdown unless a Fumadocs component improves readability.

---

# Validation Checklist

Before finishing documentation, verify:

- Block exists.
- Every source file has been inspected.
- Public exports are documented.
- Configuration matches implementation.
- Adapters actually exist.
- Stores actually exist.
- Examples compile.
- Imports are correct.
- Manual file paths are correct.
- SourceCode component paths are correct.
- Related blocks are real.
- No undocumented features were invented.

If verification fails, regenerate the affected section.

---

# AI Output Requirements

Every generated documentation page must:

- be derived entirely from source code
- remain synchronized with implementation
- follow the required section order
- use consistent terminology
- use SourceCode for implementation files
- avoid duplicated information
- explain concepts before APIs
- be immediately usable by beginners
- remain valuable for experienced developers

The objective is to produce documentation that feels like it was written by a single maintainer, regardless of which AI agent generated it.
