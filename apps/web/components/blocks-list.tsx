import { loadCatalog } from "@/lib/registry";

export async function BlocksList() {
  const blocks = await loadCatalog();

  if (blocks.length === 0) {
    return <p className="text-muted-foreground">No blocks available yet.</p>;
  }

  return (
    <div className="not-prose grid gap-4">
      {blocks.map((block) => (
        <a
          key={block.key}
          href={block.docHref}
          className="block rounded-lg border p-4 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-base">{block.name}</h3>

            <code className="text-xs text-muted-foreground">{block.key}</code>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">{block.description}</p>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {!block.isAgnostic && block.adapterKeys.length > 0 && (
              <span className="rounded-md bg-secondary px-2 py-0.5">
                Frameworks: {block.frameworkLabel}
              </span>
            )}

            {block.variantCount > 0 && (
              <span className="rounded-md bg-secondary px-2 py-0.5">
                {block.variantCount} variant{block.variantCount > 1 ? "s" : ""}
              </span>
            )}

            {block.isAgnostic && (
              <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5">
                Framework-agnostic
              </span>
            )}

            {block.nodeRange && (
              <span className="rounded-md bg-secondary px-2 py-0.5">Node {block.nodeRange}</span>
            )}

            {block.version && (
              <span className="rounded-md bg-secondary px-2 py-0.5">v{block.version}</span>
            )}

            {block.releasedAtLabel && (
              <span className="rounded-md bg-secondary px-2 py-0.5">
                Released {block.releasedAtLabel}
              </span>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
