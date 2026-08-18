---
name: blockend-docs-writer
description: >
  Use this skill whenever Noor wants to write, improve, or regenerate documentation for a Blockend block.
  Trigger on: "write docs for X block", "document the health-check block", "generate docs", "improve the docs
  for X", "write the fumadocs page for X", "my block needs documentation", or any request to produce MDX
  documentation for a block that lives in the blocks/ directory. This skill reads actual source files from
  the blocks/ directory, understands the block's architecture end-to-end, and produces 10/10 Fumadocs-quality
  MDX documentation — complete with CLI/Manual install tabs, architecture diagrams, full API reference,
  configuration tables, real usage examples, and DX-first writing. Always use this skill for any block
  documentation task — do not attempt to write Fumadocs MDX from scratch without it.
---

# blockend-docs-writer

Produces production-grade Fumadocs MDX documentation for Blockend blocks by reading actual source files
from the `blocks/` directory. The output is a complete `.mdx` page ready to drop into the Fumadocs
`content/docs/` tree — not a template, not a stub.

---

## Core Philosophy

Documentation is a product. It ships alongside the block. Bad docs kill adoption of good code.

Every page must answer four questions a developer asks in order:

1. **What is this?** — One paragraph, no jargon, immediate value prop.
2. **How do I install it?** — Fastest path to running code. CLI first, manual second.
3. **How do I configure it?** — Every option, every type, every default. No hunting.
4. **How does it work?** — Architecture, data flow, failure modes. Enough to debug confidently.

If the docs don't answer all four, they're not done.

---

## Step-by-Step Process

### Step 1: Locate and Read Block Sources

The user will name a block (e.g., `health-check`, `rate-limiter`, `logger`). Before writing a single word:

```bash
# List the block's file tree
ls -R blocks/<block-name>/

# Read every source file — types, core, adapters, index
cat blocks/<block-name>/types/index.ts
cat blocks/<block-name>/core/*.ts
cat blocks/<block-name>/adapters/*.ts
cat blocks/<block-name>/index.ts
```

Read **all** files. Do not skip adapters or types. The types file is the source of truth for the API
reference. The core files reveal the architecture and failure modes. The adapters reveal usage patterns.

If the user provides a path or there is a different directory structure, adapt accordingly. The goal is
to read every `.ts` file in the block before writing.

### Step 2: Extract Documentation Facts

From the source files, extract:

| What to extract                             | Where to find it                             |
| ------------------------------------------- | -------------------------------------------- |
| All exported types and interfaces           | `types/index.ts`                             |
| All exported functions and their signatures | `index.ts`, `adapters/*.ts`                  |
| Required vs optional config fields          | Constructor options type                     |
| Default values                              | Default parameter values or fallback logic   |
| Error conditions                            | `throw` statements, validation logic         |
| Timeout and concurrency behavior            | Core runner files                            |
| HTTP status codes returned                  | Adapter files                                |
| What "success" vs "failure" looks like      | Status calculator, report builder            |
| Related blocks mentioned in comments        | Any `@see`, `@related`, or import references |

Do not invent behavior. If a default value is not explicit in source, note it as "see source."

### Step 3: Write the MDX Page

Produce a single `.mdx` file following the structure below. Use the Fumadocs component set.
Every section must be populated from what you read — no placeholders, no "TBD."

---

## MDX Page Structure

### Frontmatter

```mdx
---
title: <Block Name>
description: <One sentence — what it does and what problem it solves>
---
```

The description is the meta tag. It appears in search results and link previews. Make it count.

### Opening Section

```mdx
The **<Block Name>** block <what it does in one concrete sentence>.

Instead of <the painful alternative>, <what this block lets you do>.

---
```

No bullet lists in the opener. Prose only. Two sentences max. Every word earns its place.

### Features Section

```mdx
## Features

- <Feature derived from source — e.g., "Concurrent execution for fast health checks">
- <Feature>
- ...
```

Only list features visible in the source. Do not invent. Each bullet is a real capability with a
one-line description. Cap at 8 bullets.

### File Structure Section

````mdx
## File Structure

```text
<block-name>
├── adapters
│   ├── express.ts
│   ├── fastify.ts
│   └── hono.ts
├── core
│   ├── <file>.ts
│   └── ...
├── types
│   └── index.ts
└── index.ts
```
````

- **adapters/** — <one-line description>
- **core/** — <one-line description>
- **types/** — <one-line description>

````

### Installation Section

This is the most important DX section. Use Fumadocs `<Tabs>` for CLI vs Manual.

```mdx
## Installation

<Tabs items={['CLI', 'Manual']}>
  <Tab value="CLI">
    ```bash
    pnpm dlx blockend-cli add <block-name>
    ```

    <Steps>
      <Step>
        ### Detect Project
        Blockend detects your project configuration and determines the correct output location.
      </Step>
      <Step>
        ### Install Dependencies
        Required packages are installed automatically.
      </Step>
      <Step>
        ### Generate Files
        The <block-name> block is generated inside your configured blocks directory.
      </Step>
    </Steps>
  </Tab>
  <Tab value="Manual">
    Copy the files below into your project's blocks directory.

    ### Peer Dependencies

    | Package | Required for |
    | ------- | ------------ |
    | `<pkg>` | <adapter>    |

    ### `blocks/<block-name>/types/index.ts`

    <description of what this file contains>

    <SourceCode file="<block-name>/types/index.ts" />

    ### `blocks/<block-name>/core/<file>.ts`

    <one-line description>

    <SourceCode file="<block-name>/core/<file>.ts" />

    <!-- repeat for each core file and adapter -->
  </Tab>
</Tabs>
````

Rules for the Manual tab:

- Every file in the block gets its own `###` heading.
- Each heading is the full relative path from `blocks/`.
- Each file gets a one-sentence description of what it does before the `<SourceCode>` component.
- Order: types → core files (alphabetical) → adapters (alphabetical).

### Configuration Section

```mdx
## Configuration

### <MainOptionsType>

| Option    | Type     | Default                   | Description        |
| --------- | -------- | ------------------------- | ------------------ |
| `<field>` | `<type>` | `<default or "Required">` | <what it controls> |

### <NestedType if applicable>

| Name      | Type     | Required | Description   |
| --------- | -------- | -------- | ------------- |
| `<field>` | `<type>` | Yes / No | <description> |
```

Rules:

- Every option from the types file appears here. No omissions.
- "Required" in the Default column means the field has no default and must be provided.
- Types should match TypeScript exactly — `string`, `number`, `boolean`, `() => Promise<void>`, etc.
- If a type is a custom type, link to it: `` `StatusCalculator` `` → explains what it is in the description.

### Architecture Section

````mdx
## Architecture

```text
<ASCII flow diagram derived from the actual call graph in source>
```
````

<One paragraph explaining the flow in plain English. Cover: when validation runs, what triggers
execution, how concurrency works, how errors are collected, and what the output looks like.>

````

The ASCII diagram must reflect actual source behavior. Trace the call graph from entry point to output:
- `createHealth()` → `validateConfig()` → `health.run()` → `runChecks()` → `runCheck()` → `calculateStatus()` → `buildReport()` → adapter

### When to Use / When Not to Use

```mdx
## When to Use

* <concrete scenario from the block's design intent>
* <another scenario>

## When Not to Use

* <anti-pattern or overkill scenario>
* <another>
````

These come from the block's design constraints visible in source (e.g., config validation on startup
implies "when you want fail-fast guarantees").

### Usage Section

````mdx
## Usage

One `###` subsection per adapter/framework found in the adapters directory. Plus subsections for any
extension points (custom calculators, custom builders, etc.) visible in the types.

Each subsection has:

1. A minimal working code example (not toy — real service names, real dependency names)
2. A comment explaining the key behavior being demonstrated

### Express

```ts
import express from "express";
import { createHealth } from "@/blocks/health-check";
import { registerExpressHealthRoute } from "@/blocks/health-check/adapters/express";

const health = createHealth({
  checks: [
    {
      name: "database",
      critical: true,
      timeoutMs: 5000,
      async run() {
        await db.ping(); // throws on failure — that's all the block needs
      }
    }
  ]
});

const app = express();
registerExpressHealthRoute(app, health);
// GET /health → HealthReport JSON
```
````

<!-- Fastify, Hono, Custom Calculator, Custom Report Builder — same pattern -->

````

### API Reference Section

```mdx
## API Reference

One `####` heading per exported function or class. Signature in a code block, then a param table,
then a returns/throws callout.

#### createHealth

```ts
function createHealth(options: CreateHealthOptions): Health;
````

| Parameter | Type                  | Required | Description                |
| --------- | --------------------- | -------- | -------------------------- |
| `options` | `CreateHealthOptions` | Yes      | Health check configuration |

**Returns** — `Health` object with a `run()` method.

**Throws** — `Error` on invalid configuration: empty checks array, duplicate names, missing `run` function.

#### health.run

```ts
async function run(): Promise<HealthReport>;
```

Executes all checks concurrently. Returns a `HealthReport`.

<!-- All exported interfaces and types as #### headings with their full TypeScript definition in a code block -->

#### HealthReport

```ts
interface HealthReport {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string; // ISO 8601
  uptime: number; // seconds since process start
  checks: HealthCheckResult[];
}
```

````

### Examples Section

```mdx
## Examples

### Basic Usage

Minimal real example — one critical dependency, wired to a framework.

### Production Usage with Multiple Checks

A realistic production config: one critical DB check, one non-critical cache check, one external API check
with a longer timeout, one resource check (disk, memory). Show all four patterns.

### Testing

Show how to unit-test the block:
- Mocking a passing check
- Mocking a failing critical check
- Asserting on `report.status`
````

### Related Blocks Section

```mdx
## Related Blocks

- **Logger** — <one sentence on how they compose>
- **Response Formatter** — <one sentence>
```

Only include blocks that are actually referenced in source imports or comments. Do not invent.

### FAQ Section

Derive questions from:

- Error handling behavior visible in source (sanitized errors, timeout behavior)
- HTTP status codes returned by adapters
- Extension points in the types
- Common misuse patterns implied by validation logic

```mdx
## FAQ

**<Question derived from source behavior>**

<Answer grounded in source. No speculation.>
```

---

## Fumadocs Component Reference

Use only these components. Do not invent custom components.

| Component            | Import / Usage                          | When to use                                 |
| -------------------- | --------------------------------------- | ------------------------------------------- |
| `<Tabs>` + `<Tab>`   | `<Tabs items={['CLI', 'Manual']}>`      | CLI vs Manual install                       |
| `<Steps>` + `<Step>` | `<Steps><Step>...</Step></Steps>`       | Ordered install steps                       |
| `<Callout>`          | `<Callout type="warn">`                 | Important warnings or gotchas               |
| `<SourceCode>`       | `<SourceCode file="path/to/file.ts" />` | Embedding source files in Manual tab        |
| `<TypeTable>`        | optional — use markdown tables instead  | Type definitions (markdown tables are fine) |

Import all Fumadocs components at the top of the MDX file:

```mdx
import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { Callout } from "fumadocs-ui/components/callout";
```

---

## Writing Standards

### Prose Rules

- **No filler openers.** Never start a section with "In this section, we will..." or "This document covers..."
- **Active voice only.** "The block runs checks concurrently" — not "Checks are run concurrently by the block."
- **Present tense.** "Returns a HealthReport" — not "Will return."
- **No adverbs on obvious things.** "Simply call `health.run()`" — delete "simply."
- **Concrete nouns.** "database", "redis", "external API" — not "dependency" or "service."
- **Short sentences in explanations.** Long sentences in prose sections are fine. Short sentences in descriptions.

### Code Example Rules

- All examples use TypeScript.
- All identifiers are realistic: `db`, `redis`, `pgClient`, `emailQueue` — never `myCheck`, `testFn`, `foo`.
- All examples are self-contained and would run with minimal setup.
- Every example has a comment on the non-obvious line explaining _why_, not _what_.
- Examples progress in complexity: minimal → production → testing.

### Table Rules

- Every option in the types file appears in a table. Zero omissions.
- Required fields: "Required" in the Default column, not blank.
- Optional fields with a default: show the actual default value.
- Optional fields with no default: "—" in the Default column.

---

## Quality Checklist

Before outputting the final MDX, verify:

- [ ] All source files were read — types, core, adapters, index.
- [ ] Every exported type and function has an API Reference entry.
- [ ] Every config option is in a table with correct type and default.
- [ ] The architecture diagram matches the actual call graph in source.
- [ ] The CLI tab shows the `pnpm dlx blockend-cli add` command.
- [ ] The Manual tab covers every file in the block.
- [ ] At least one usage example per adapter.
- [ ] Extension points (custom calculators, custom builders) have examples if present in types.
- [ ] FAQ answers are grounded in source behavior, not guesses.
- [ ] No placeholder text remains in the output.
- [ ] All imports at the top of the MDX file are correct Fumadocs imports.
- [ ] HTTP status codes in adapter behavior match what the source actually returns.

---

## Output

Produce the final MDX as a file artifact the user can copy directly into their Fumadocs `content/docs/`
directory. File name should be `<block-name>.mdx`.

Do not produce a summary of what you wrote. Do not produce an explanation after the MDX. The MDX is the output.
If the user wants changes, they will ask.
