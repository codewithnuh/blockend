import type {
  NavLink,
  TerminalLine,
  BlockChip,
  WorkflowStep,
  FeaturePoint,
  RoadmapBrick,
  PhilosophyCard,
  InitStep,
  SelectOption,
  FooterLink
} from "./types";

// ─── Nav ──────────────────────────────────────────────────────────────────────
export const NAV_LINKS: NavLink[] = [
  { href: "#how", label: "How it works" },
  { href: "#blocks", label: "Blocks" },
  { href: "#roadmap", label: "Roadmap" },
  {
    href: "https://www.npmjs.com/package/blockend-cli",
    label: "npm",
    external: true
  }
];

// ─── Hero terminal script ─────────────────────────────────────────────────────
export const TERMINAL_SCRIPT: TerminalLine[] = [
  { type: "cmd", text: "$ npx blockend-cli init" },
  { type: "out", text: "✓ detected: express · typescript · pnpm" },
  { type: "out", text: "✓ workspace ready\n" },
  { type: "cmd", text: "$ npx blockend-cli add rate-limiter" },
  { type: "out", text: "✓ generated:" },
  {
    type: "tree",
    text: "  src/rate-limiter/\n  ├─ rateLimiter.ts\n  ├─ memory-store.ts\n  └─ types.ts\n"
  },
  { type: "out", text: "block added — zero new dependencies\n" }
];

// ─── Problem section chips ────────────────────────────────────────────────────
export const BLOCK_CHIPS: BlockChip[] = [
  { label: "rate-limiter", available: true },
  { label: "error-handler", available: true },
  { label: "logger", available: true },
  { label: "validator", available: false },
  { label: "pagination", available: false },
  { label: "idempotency", available: false }
];

// ─── How it works ─────────────────────────────────────────────────────────────
export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    step: 1,
    title: "Detect your stack",
    description:
      "Blockend reads your framework, language, and package manager — no config file to fill in.",
    command: "$ npx blockend-cli init"
  },
  {
    step: 2,
    title: "Add a block",
    description:
      "Pick a block and it's generated as real source files in your project, adapted to your setup.",
    command: "$ npx blockend-cli add rate-limiter"
  },
  {
    step: 3,
    title: "Own it forever",
    description:
      "Read it, modify it, debug it, delete it. It's your file now — Blockend has no runtime to maintain.",
    command: "no lock-in. no dependency.",
    commandMuted: true
  }
];

// ─── Rate-limiter feature points ──────────────────────────────────────────────
export const RATE_LIMITER_FEATURES: FeaturePoint[] = [
  {
    text: "Token bucket algorithm, tuned via windowMs and max"
  },
  {
    text: "Storage adapters: in-memory store out of the box, Redis-compatible stores drop in"
  },
  {
    text: "Plain Express middleware — no custom request lifecycle to learn"
  }
];

// ─── Roadmap bricks ───────────────────────────────────────────────────────────
export const ROADMAP_BRICKS: RoadmapBrick[] = [
  {
    label: "rate-limiter",
    description: "Token bucket, pluggable stores",
    status: "ready",
    wide: true
  },
  {
    label: "error-handler",
    description: "Centralized error pipeline",
    status: "ready",
    wide: true
  },
  {
    label: "logger",
    description: "Structured request logging",
    status: "ready",
    wide: true
  },
  {
    label: "request-validator",
    description: "Schema-based input checks",
    status: "planned"
  },
  {
    label: "pagination · idempotency",
    description: "Cursor pagination + idempotency keys, plus plain-JS output for non-TS projects",
    status: "planned",
    wide: true
  }
];

// ─── Philosophy cards ─────────────────────────────────────────────────────────
export const PHILOSOPHY_CARDS: PhilosophyCard[] = [
  {
    title: "Read it",
    body: "No compiled output to trust blindly. The implementation is sitting right there in your editor."
  },
  {
    title: "Debug it",
    body: "Stack traces point into your own files, not three layers deep in node_modules."
  },
  {
    title: "Outgrow it",
    body: "Refactor or rip it out whenever your architecture changes. Nothing else in your stack depends on it."
  }
];

// ─── Init CLI simulation data ─────────────────────────────────────────────────
export const INIT_STEPS: InitStep[] = [
  {
    id: "scan",
    label: "Scanning project structure...",
    output: "✓ Project structure detected"
  },
  {
    id: "framework",
    label: "Analyzing framework signals...",
    output: "✓ Detected express environment"
  },
  {
    id: "aliases",
    label: "Resolving alias mappings...",
    output: "✓ Import strategy mapped"
  }
];

export const FRAMEWORK_OPTIONS: SelectOption[] = [
  { value: "express", label: "Express.js" },
  { value: "fastify", label: "Fastify" },
  { value: "next", label: "Next.js (App Router)" },
  { value: "hono", label: "Hono" }
];

// ─── Footer links ─────────────────────────────────────────────────────────────
export const FOOTER_LINKS: FooterLink[] = [
  { href: "https://github.com/codewithnuh/blockend", label: "GitHub" },
  { href: "https://www.npmjs.com/package/blockend-cli", label: "npm" },
  { href: "https://x.com/codewithnuh", label: "X" },
  { href: "https://youtube.com/@codewithnuh", label: "YouTube" }
];
