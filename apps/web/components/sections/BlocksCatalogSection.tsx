import { BLOCKS_CATALOG } from "@/lib/landing-constants";
import { loadCatalog, type CatalogBlock } from "@/lib/registry";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { CatalogCopyButton } from "@/components/sections/CatalogCopyButton";

const LANDING_BLOCK_LIMIT = 8;

export async function BlocksCatalogSection() {
  const allBlocks = await loadCatalog();
  const blocks = allBlocks.slice(0, LANDING_BLOCK_LIMIT);
  const totalCount = allBlocks.length;

  return (
    <section
      id="catalog"
      aria-labelledby="catalog-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header */}
      <header className="mb-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase block transition-colors">
            {BLOCKS_CATALOG.badge}
          </span>

          <h2
            id="catalog-heading"
            className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight mt-2 transition-colors"
          >
            {BLOCKS_CATALOG.headline}
          </h2>
        </div>

        {/* Full Catalog CTA */}
        <Button
          asChild
          variant="outline"
          className="w-fit rounded-button border-border dark:border-graphite bg-transparent hover:bg-surface-2 dark:hover:bg-obsidian text-fg dark:text-paper font-mono text-[12px] font-normal"
        >
          <Link href="/docs/blocks-reference" aria-label="Browse the full Blockend catalog">
            Browse Full Catalog
            <ArrowUpRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </header>

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocks available yet.</p>
      ) : (
        <>
          <ul
            role="list"
            aria-label="Latest backend blocks, newest first"
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0"
          >
            {blocks.map((block) => (
              <li key={block.key} className="flex">
                <BlockCard block={block} />
              </li>
            ))}
          </ul>

          <p className="mt-6 font-mono text-[11px] text-muted-foreground dark:text-ash">
            Showing {blocks.length}
            {totalCount > blocks.length ? ` of ${totalCount}` : ""} blocks · sorted by release date
            ·{" "}
            <Link
              href="/docs/blocks-reference"
              className="underline underline-offset-2 hover:text-fg dark:hover:text-paper"
            >
              view full catalog
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

function BlockCard({ block }: { block: CatalogBlock }) {
  return (
    <Card className="w-full p-5 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite flex flex-col justify-between space-y-4 shadow-sm transition-colors">
      <div className="space-y-2">
        <CardHeader className="p-0 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-mono text-[12px] text-fg dark:text-paper font-normal transition-colors">
            {block.name}
          </CardTitle>

          <Badge
            variant="outline"
            className="px-1.5 py-0.5 rounded-badge bg-surface-2 border-border dark:bg-obsidian dark:border-graphite font-mono text-[10px] text-muted-foreground dark:text-fog font-normal transition-colors"
          >
            {block.tag}
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <p className="text-[13px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
            {block.description}
          </p>
        </CardContent>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {!block.isAgnostic && block.adapterKeys.length > 0 && (
            <span className="rounded-md bg-surface-2 dark:bg-obsidian border border-border dark:border-graphite px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:text-fog">
              {block.frameworkLabel}
            </span>
          )}

          {block.isAgnostic && (
            <span className="rounded-md bg-primary/10 text-primary px-1.5 py-0.5 font-mono text-[10px]">
              Framework-agnostic
            </span>
          )}

          {block.nodeRange && (
            <span className="rounded-md bg-surface-2 dark:bg-obsidian border border-border dark:border-graphite px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:text-fog">
              Node {block.nodeRange}
            </span>
          )}

          {block.version && (
            <span className="rounded-md bg-surface-2 dark:bg-obsidian border border-border dark:border-graphite px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:text-fog">
              v{block.version}
            </span>
          )}

          {block.releasedAtLabel && (
            <span className="rounded-md bg-surface-2 dark:bg-obsidian border border-border dark:border-graphite px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:text-fog">
              {block.releasedAtLabel}
            </span>
          )}
        </div>
      </div>

      <CardFooter className="p-0 py-3 border-t border-border dark:border-graphite flex justify-between items-center text-[11px] font-mono text-muted-foreground dark:text-ash transition-colors">
        <code className="text-[11px] font-mono text-muted-foreground dark:text-ash bg-transparent p-0 transition-colors">
          {block.command}
        </code>

        <CatalogCopyButton command={block.command} blockName={block.name} blockTag={block.tag} />
      </CardFooter>
    </Card>
  );
}
