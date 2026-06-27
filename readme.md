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

[![npm](https://img.shields.io/npm/v/blockend?color=0ea5e9&label=blockend)](https://npmjs.com/package/blockend-cli)
[![license](https://img.shields.io/github/license/codewithnuh/blockend?color=0ea5e9)](./LICENSE)
[![blocks](https://img.shields.io/badge/blocks-1-0ea5e9)](#available-blocks)

</div>

---

Most backend projects need the same infrastructure code: rate limiting, logging, error handling, validation, pagination, and more.

You can install packages for these features, or write them yourself. Packages often require learning another API and working within someone else's abstractions. Writing everything yourself gives you full control, but usually means repeating the same work across projects.

Blockend takes a different approach.

Instead of adding another dependency, Blockend generates the code directly into your project so you can own, understand, and modify it from the start.

---

## Why Blockend?

When you add a block, it becomes part of your codebase.

```bash
npx blockend add rate-limiter
```

The generated files are regular source files. You can:

- Read the implementation
- Modify it to fit your architecture
- Debug it without digging through `node_modules`
- Remove or refactor it whenever you want

The goal is to provide practical backend building blocks that serve as a starting point—not another runtime framework.

---

## Inspiration

Frontend developers have widely adopted the copy-and-own model through projects like `shadcn/ui`.

Blockend applies the same philosophy to backend utilities.

Many backend features are common implementation patterns rather than libraries that need to stay external to your application. Keeping these utilities inside your project often makes customization and maintenance simpler.

---

## Current Status

Blockend is actively being developed.

### Available

| Block / Feature           | Description                                                    | Status   |
| ------------------------- | -------------------------------------------------------------- | -------- |
| `rate-limiter`            | Token bucket rate limiter with pluggable storage adapters.     | ✅ Ready |
| Workspace detection       | Detects your project setup and package manager where possible. | ✅ Ready |
| CLI interruption handling | Handles `Ctrl+C` cleanly during generation.                    | ✅ Ready |
| Code isolation            | Organizes generated code into dedicated folders.               | ✅ Ready |

### Planned

- JavaScript output without TypeScript syntax
- `error-handler`
- `logger`
- `request-validator`
- `pagination`
- `idempotency`

---

## Quick Start

Initialize Blockend:

```bash
npx blockend init
```

Add a block:

```bash
npx blockend add rate-limiter
```

---

## Example

```ts
import express from "express";
import { Redis } from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";
import { rateLimit } from "./rate-limiter/rateLimiter";
import { MemoryStore } from "./rate-limiter/memory-store";

const app = express();
app.set("trust proxy", 1);

// ---- ENVIRONMENT SWAPPING ----

// Store
const memoryStore = new MemoryStore();

// ---- APPLY MIDDLEWARE ----

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  store: memoryStore // Swap with another store implementation if needed.
});

app.use("/api/", apiLimiter);
```

---

## Contributing

Contributions are welcome.

If you have backend utilities that you've refined across multiple projects, feel free to open an issue or submit a pull request.

The goal is to build a collection of well-documented, easy-to-understand backend blocks with minimal runtime dependencies and clear implementations.

Feedback and suggestions are always appreciated.

## License

## This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **GitHub:** https://github.com/codewithnuh
- **LinkedIn:** https://linkedin.com/in/codewithnuh
- **X:** https://x.com/codewithnuh
- **YouTube:** https://youtube.com/@codewithnuh

If Blockend is useful to you, consider starring the repository. It helps others discover the project and supports its continued development.
