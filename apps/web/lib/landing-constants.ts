export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface ProblemItem {
  icon: string;
  title: string;
  description: string;
  color: string;
}

export interface WorkflowStep {
  step: string;
  title: string;
  description: string;
  command: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface CatalogBlock {
  name: string;
  tag: string;
  description: string;
  command: string;
}

export interface Framework {
  name: string;
  icon: string;
  color: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface RoadmapItem {
  period: string;
  title: string;
  description: string;
  color: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export const SITE = {
  name: "Blockend",
  tagline: "Source-First Backend Toolkit",
  url: "https://blockend.noorulhassan.com",
  github: "https://github.com/noorulhassan/blockend"
} as const;

export const HERO = {
  badge: "Source-First Backend Toolkit",
  headline: "Production backend code blocks, generated into your project.",
  subheadline:
    "Rate limiting, validation, logging, and error handling — generated as pure TypeScript files you read, edit, and own.",
  cta: { label: "Get Started", href: "#get-started" },
  secondaryCta: { label: "View Blocks & Catalog", href: "#catalog" },
  command: "npx blockend-cli add rate-limiter"
} as const;

export const SOCIAL_PROOF = {
  badge: "Designed for backend teams building modern TypeScript services.",
  subtext: "Compatible with Express, Fastify, Hono, and Next.js backend layers.",
  stats: [
    { value: "Essential Only", label: "NPM Dependencies" },
    { value: "100%", label: "Source Owned" }
  ] as StatItem[]
} as const;

export const PROBLEM_SECTION = {
  badge: "The Problem",
  headline: "Stop relying on black-box middleware dependencies.",
  items: [
    {
      icon: "rotate-left",
      title: "Boilerplate Redundancy",
      description:
        "Every new backend microservice requires rewriting rate limiting, error classes, loggers, and header parsers from scratch.",
      color: "text-fog"
    },
    {
      icon: "box-open",
      title: "Node_Modules Lock-in",
      description:
        "Key infrastructure logic ends up buried inside deeply nested external packages, making minor tweaks impossible.",
      color: "text-coral-red"
    },
    {
      icon: "bug",
      title: "Opaque Stack Traces",
      description:
        "Production failures force developers to step through foreign package code rather than inspecting clean local files.",
      color: "text-iris-violet"
    },
    {
      icon: "code-merge",
      title: "Inconsistent Conventions",
      description:
        "Different developers implement error handling and logging differently, fragmenting the architecture across teams.",
      color: "text-signal-teal"
    }
  ] as ProblemItem[]
} as const;

export const HOW_IT_WORKS = {
  badge: "Workflow",
  headline: "Three commands to clean, native backend blocks.",
  steps: [
    {
      step: "01",
      title: "Initialize Blockend in your repository.",
      description:
        "Configure your target backend framework (Express, Fastify, Hono, Next.js) and custom block output path.",
      command: "npx blockend-cli init"
    },
    {
      step: "02",
      title: "Add production blocks on demand.",
      description:
        "Blockend fetches the block template and generates idiomatic TypeScript source files tailored to your framework.",
      command: "npx blockend-cli add rate-limiter"
    },
    {
      step: "03",
      title: "Commit code directly to Git.",
      description:
        "Read, audit, and customize the generated files inside your project. The code belongs entirely to you.",
      command: "git add src/blocks/"
    }
  ] as WorkflowStep[]
} as const;

export const GENERATED_OUTPUT = {
  badge: "Output Structure",
  headline: "Real TypeScript files in your workspace.",
  description:
    "Blockend generates clear, commented TypeScript files inside your project structure. Every file includes framework adapters, strict types, and usage examples.",
  checks: [
    "Pragmatic Dependencies: Imports external packages only for security-critical tasks (JWT, Zod).",
    "Framework Native: Emits typed handlers for Express, Fastify, Hono, & Next.js.",
    "Fully Editable: Rename options, modify algorithms, or adjust log shapes instantly."
  ] as string[],
  files: [
    { name: "rate-limiter.ts", size: "2.1 KB" },
    { name: "error-handler.ts", size: "1.8 KB" },
    { name: "logger.ts", size: "1.4 KB" },
    { name: "request-validator.ts", size: "2.8 KB" }
  ] as { name: string; size: string }[]
} as const;

export const FEATURES = {
  badge: "System Properties",
  headline: "Engineered for code ownership and maintainability.",
  items: [
    {
      icon: "code",
      title: "Complete Source Ownership",
      description:
        "You own every generated block. Tweak logic, rename variables, or extend algorithms directly inside your codebase."
    },
    {
      icon: "cubes",
      title: "Framework Awareness",
      description:
        "Generates native request contexts and middleware signatures for Express, Fastify, Hono, and Next.js."
    },
    {
      icon: "feather-pointed",
      title: "Pragmatic Dependency Tree",
      description:
        "Uses npm dependencies exclusively for non-negotiable security tasks like JWT verification or schema validation."
    },
    {
      icon: "shield-halved",
      title: "Strict Type Safety",
      description:
        "Written with strict TypeScript type definitions, generic parameters, and explicit return types."
    },
    {
      icon: "glasses",
      title: "High Code Legibility",
      description:
        "Cleanly formatted, idiomatic code designed for fast code reviews and immediate developer comprehension."
    },
    {
      icon: "server",
      title: "Production Defaults",
      description:
        "Pre-configured with industry standard defaults for security headers, graceful termination, and structured logs."
    }
  ] as FeatureItem[]
} as const;

export const BLOCKS_CATALOG = {
  badge: "Catalog",
  headline: "Production blocks ready for generation.",
  blocks: [
    {
      name: "rate-limiter",
      tag: "HTTP",
      description: "Token bucket rate limiting with in-memory or storage adapter options.",
      command: "blockend-cli add rate-limiter"
    },
    {
      name: "error-handler",
      tag: "Errors",
      description: "Centralized error normalization pipeline with custom exception classes.",
      command: "blockend-cli add error-handler"
    },
    {
      name: "logger",
      tag: "Observability",
      description: "Structured JSON request logging with correlation ID propagation.",
      command: "blockend-cli add logger"
    },
    {
      name: "request-validator",
      tag: "Validation",
      description: "Zod-based body and query validation middleware adapter.",
      command: "blockend-cli add request-validator"
    },
    {
      name: "response-formatter",
      tag: "Response",
      description: "Standardized API success and error envelope payloads.",
      command: "blockend-cli add response-formatter"
    },
    {
      name: "health-check",
      tag: "Ops",
      description: "Liveness and readiness health probe handlers.",
      command: "blockend-cli add health-check"
    },
    {
      name: "env-config",
      tag: "Config",
      description: "Type-safe environment variable parser and validator with Zod schemas.",
      command: "blockend-cli add env-config"
    }
  ] as CatalogBlock[]
} as const;

export const FRAMEWORKS = {
  badge: "Ecosystem",
  headline: "Native support across HTTP frameworks.",
  description:
    "Blockend tailors type definitions and middleware patterns for your preferred stack.",
  items: [
    { name: "Express", icon: "node-js", color: "text-pulse-green" },
    { name: "Fastify", icon: "bolt", color: "text-acid-lime" },
    { name: "Hono", icon: "fire", color: "text-coral-red" },
    { name: "Next.js API", icon: "n", color: "text-paper" }
  ] as Framework[]
} as const;

export const MCP_SECTION = {
  badge: "Model Context Protocol",
  badgeIcon: "robot",
  headline: "Scaffold your infrastructure with natural language.",
  description:
    "Blockend includes an MCP server. AI assistants (Cursor, Claude, Windsurf) can query the block catalog, inspect signatures, and generate middleware stacks directly into your repository.",
  features: [
    {
      icon: "magnifying-glass",
      text: "Discover Blocks: Live catalog capability discovery for AI."
    },
    { icon: "code", text: "Accurate Generation: Eliminates AI import hallucinations." },
    { icon: "sliders", text: "Automated Adapters: Automatic framework detection." }
  ],
  sessionTitle: "MCP Agent Session",
  sessionPlatform: "Cursor / Claude Desktop",
  sessionPrompt: '"Add rate limiting to my Hono API with custom 429 status code."',
  sessionSteps: [
    { text: "Executing Tool: blockend_add_block", color: "text-pulse-green", muted: false },
    { text: "Target detected: Hono framework", color: "text-ash", muted: true },
    { text: "Generated: src/blocks/rate-limiter.ts", color: "text-paper", muted: false },
    { text: "Context: Typed middleware registered", color: "text-paper", muted: false }
  ]
} as const;

export const ROADMAP = {
  badge: "Future",
  headline: "Roadmap & Vision",
  items: [
    {
      period: "Q3 2026",
      title: "Expanded Catalog",
      description: "JWT authentication, CORS, and audit logging blocks.",
      color: "text-pulse-green"
    },
    {
      period: "Q4 2026",
      title: "Storage Adapters",
      description: "Redis, PostgreSQL, and Upstash storage flags.",
      color: "text-signal-teal"
    },
    {
      period: "Q1 2027",
      title: "Starter Kits",
      description: "Pre-composed starter compositions for full microservices.",
      color: "text-iris-violet"
    },
    {
      period: "Future",
      title: "AI Verification",
      description: "Local sync verification and refactoring agents.",
      color: "text-ash"
    }
  ] as RoadmapItem[],
  quote:
    '"Blockend provides a source-first backend foundation: generating readable, battle-tested code directly into your repository without black-box framework lock-in."'
} as const;

export const FAQ_SECTION = {
  badge: "FAQ",
  headline: "Frequently Asked Questions",
  items: [
    {
      question: "Why generate source files instead of publishing npm packages?",
      answer:
        "NPM packages hide infrastructure logic inside black-box node_modules. Generating source code gives you 100% code ownership, allowing you to read, edit, customize, and audit logic inside your repository."
    },
    {
      question: "Does Blockend use npm dependencies?",
      answer:
        "Blockend avoids unnecessary middleware wrappers, but relies on well-tested npm packages when security or correctness demands it—such as jsonwebtoken for JWT parsing or Zod for schema validation."
    },
    {
      question: "Which HTTP backend frameworks are supported?",
      answer:
        "Blockend natively supports Express, Fastify, Hono, and Next.js API route handlers with tailored type definitions for each."
    },
    {
      question: "Can I use Blockend in existing production codebases?",
      answer:
        "Yes. Run `npx blockend-cli init` in any existing TypeScript codebase. It configures a dedicated blocks folder without interfering with your existing routes or setup."
    },
    {
      question: "Is Blockend open source?",
      answer:
        "Yes. Blockend CLI and block templates are open source and hosted on GitHub. Contributions for new framework adapters and blocks are welcome."
    }
  ] as FAQItem[]
} as const;

export const FINAL_CTA = {
  headline: "Own your backend code.",
  description: "Generate your first block in seconds and experience pure source code ownership.",
  primaryCta: { label: "Get Started", href: "#catalog" },
  secondaryCta: { label: "View on GitHub", href: "https://github.com/noorulhassan/blockend" },
  command: "npx blockend-cli init"
} as const;

export const CODE_EXAMPLE = `// GENERATED FILE: src/blocks/rate-limiter.ts
// Owned by your repository. Zero black-box wrapper dependencies.

import { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || '127.0.0.1';
    const now = Date.now();
    const record = hits.get(ip) || { count: 0, resetTime: now + options.windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + options.windowMs;
    }

    record.count++;
    hits.set(ip, record);

    if (record.count > options.maxRequests) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    next();
  };
}`;

export const FILE_TREE_CODE = `my-backend-service/
├── src/
│   ├── blocks/
│   │   ├── rate-limiter.ts
│   │   ├── error-handler.ts
│   │   ├── logger.ts
│   │   └── request-validator.ts
│   └── server.ts
└── package.json`;
