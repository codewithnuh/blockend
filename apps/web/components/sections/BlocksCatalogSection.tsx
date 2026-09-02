"use client";

import { useState } from "react";
import { BLOCKS_CATALOG } from "@/lib/landing-constants";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";

export function BlocksCatalogSection() {
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

      {/* Grid of Catalog Cards */}
      <ul
        role="list"
        aria-label="Available backend blocks"
        className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0"
      >
        {BLOCKS_CATALOG.blocks.map((block) => (
          <li key={block.name} className="flex">
            <BlockCard block={block} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlockCard({ block }: { block: (typeof BLOCKS_CATALOG.blocks)[number] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`npx ${block.command}`);
      posthog.capture("catalog_block_command_copied", {
        block_name: block.name,
        block_tag: block.tag
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Handle fallback/silent fail
    }
  };

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
      </div>

      <CardFooter className="p-0 py-3 border-t border-border dark:border-graphite flex justify-between items-center text-[11px] font-mono text-muted-foreground dark:text-ash transition-colors">
        <code className="text-[11px] font-mono text-muted-foreground dark:text-ash bg-transparent p-0 transition-colors">
          {block.command}
        </code>

        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleCopy()}
            className="h-6 w-6 p-0 hover:bg-surface-2 dark:hover:bg-obsidian hover:text-fg dark:hover:text-mist text-muted-foreground dark:text-ash transition-colors"
            aria-label={`Copy command to install ${block.name}`}
          >
            {copied ? (
              <Check
                className="w-3.5 h-3.5 text-emerald-600 dark:text-pulse-green transition-colors"
                aria-hidden="true"
                strokeWidth={2.5}
              />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" strokeWidth={1.5} />
            )}
          </Button>

          <span className="sr-only" role="status" aria-live="polite">
            {copied ? `Command npx ${block.command} copied to clipboard` : ""}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
