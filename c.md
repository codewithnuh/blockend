This is the source of the warning.

The problem isn't `next.config.mjs` itself—it's that you're reading files from the **entire repository** using:

```ts
const root = path.resolve(process.cwd(), "../..");
```

From Turbopack's perspective, that means **any file in the repo** could be read at runtime, so it traces the whole project. That's why it reports:

```text
Encountered unexpected file in NFT list
```

## Fix 1 (Recommended): Restrict the traced path

If you only need to read files from specific directories (for example `blocks`), scope the path instead of pointing at the repository root.

For example:

```tsx
import fs from "node:fs/promises";
import path from "node:path";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";

const repoRoot = path.join(process.cwd(), "../..");
const blocksDir = path.join(repoRoot, "blocks");

export async function SourceCode({ file }: { file: string }) {
  const fullPath = path.join(blocksDir, file);

  const code = await fs.readFile(fullPath, "utf8");

  return <ServerCodeBlock lang="ts" code={code} />;
}
```

Then pass paths like:

```ts
file: "rate-limiter/core/core.ts";
```

instead of:

```ts
file: "blocks/rate-limiter/core/core.ts";
```

This limits Turbopack's tracing to the `blocks` directory.

---

## Fix 2: Use `turbopackIgnore`

If you intentionally need to read arbitrary files from the repository, annotate the path as suggested by the warning:

```ts
const repoRoot = path.join(
  /* turbopackIgnore: true */
  process.cwd(),
  "../.."
);
```

or

```ts
const fullPath = path.join(
  /* turbopackIgnore: true */
  repoRoot,
  file
);
```

This tells Turbopack not to try to statically analyze that path.

---

## Fix 3 (Best architecture)

If your documentation only displays source files from `blocks/`, `packages/cli/`, or another fixed set of directories, create a whitelist:

```ts
const roots = {
  blocks: path.join(repoRoot, "blocks"),
  cli: path.join(repoRoot, "packages/cli")
};
```

and resolve files relative to one of those roots instead of allowing arbitrary repository paths. This is both safer and avoids overly broad tracing.

### Recommendation

For your project, **Fix 1** is the best approach. It matches your repository structure, keeps the implementation simple, and avoids Turbopack tracing the entire monorepo while still allowing your documentation to load source code.
