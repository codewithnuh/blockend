"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import posthog from "posthog-js";

interface CatalogCopyButtonProps {
  command: string;
  blockName: string;
  blockTag: string;
}

export function CatalogCopyButton({ command, blockName, blockTag }: CatalogCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`npx ${command}`);
      posthog.capture("catalog_block_command_copied", {
        block_name: blockName,
        block_tag: blockTag
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Handle fallback/silent fail
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void handleCopy()}
        className="h-6 w-6 p-0 hover:bg-surface-2 dark:hover:bg-obsidian hover:text-fg dark:hover:text-mist text-muted-foreground dark:text-ash transition-colors"
        aria-label={`Copy command to install ${blockName}`}
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
        {copied ? `Command npx ${command} copied to clipboard` : ""}
      </span>
    </div>
  );
}
