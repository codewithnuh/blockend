import fs from "fs/promises";
import path from "path";

interface BlockManifest {
  name?: string;
  description: string;
  frameworks?: string[];
  dependencies?: string[];
  devDependencies?: string[];
  adapters?: Record<
    string,
    {
      dependencies?: string[];
      variants?: Record<
        string,
        {
          files?: Array<{ target: string }>;
        }
      >;
    }
  >;
  environments?: Record<
    string,
    {
      variants?: Record<string, unknown>;
    }
  >;
}

interface Registry {
  version?: string;
  blocks?: Record<string, BlockManifest>;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function BlocksList() {
  const appRoot = process.cwd();

  // apps/web/content/docs/02-blocks
  const docsPath = path.resolve(appRoot, "content/docs/02-blocks");

  // apps/web -> ../../registry/index.json
  const registryPath = path.resolve(appRoot, "../../registry/index.json");

  let registry: Registry;

  try {
    const raw = await fs.readFile(registryPath, "utf-8");
    registry = JSON.parse(raw) as Registry;
  } catch (error) {
    console.error("Registry load failed:", error);

    return <p className="text-muted-foreground">Failed to load blocks registry.</p>;
  }

  /**
   * Build docs map
   *
   * 01-rate-limiter.mdx
   *       ↓
   * rate-limiter => 01-rate-limiter
   */
  const docsMap = new Map<string, string>();

  try {
    const files = await fs.readdir(docsPath);

    for (const file of files) {
      if (!file.endsWith(".mdx")) continue;

      const filename = file.replace(/\.mdx$/, "");

      const slug = normalize(filename.replace(/^\d+-/, ""));

      docsMap.set(slug, filename);
    }
  } catch (error) {
    console.error("Docs scan failed:", docsPath, error);
  }

  const blockMap = registry.blocks ?? {};
  const entries = Object.entries(blockMap);

  if (entries.length === 0) {
    return <p className="text-muted-foreground">No blocks available yet.</p>;
  }

  return (
    <div className="not-prose grid gap-4">
      {entries.map(([key, block]) => {
        const adapterKeys = block.adapters
          ? Object.keys(block.adapters)
              .map((adapter) => (adapter === "*" ? "Any Framework" : adapter))
              .join(", ")
          : "—";

        const variantCount = block.adapters
          ? Object.values(block.adapters).reduce(
              (total, adapter) =>
                total + (adapter.variants ? Object.keys(adapter.variants).length : 0),
              0
            )
          : 0;

        /**
         * Match registry key to docs file
         */
        const docFile = docsMap.get(normalize(key));

        const href = docFile ? `/docs/02-blocks/${docFile}` : "/docs/blocks-reference";

        return (
          <a
            key={key}
            href={href}
            className="block rounded-lg border p-4 transition-colors hover:bg-accent/50"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">{block.name ?? key}</h3>

              <code className="text-xs text-muted-foreground">{key}</code>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">{block.description}</p>

            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {adapterKeys !== "—" && (
                <span className="rounded-md bg-secondary px-2 py-0.5">
                  Frameworks: {adapterKeys}
                </span>
              )}

              {variantCount > 0 && (
                <span className="rounded-md bg-secondary px-2 py-0.5">
                  {variantCount} variant
                  {variantCount > 1 ? "s" : ""}
                </span>
              )}

              {block.frameworks?.includes("*") && (
                <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5">
                  Framework-agnostic
                </span>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
