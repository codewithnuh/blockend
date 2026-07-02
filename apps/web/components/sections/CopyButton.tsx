"use client";

import { useState } from "react";
import { FiCopy, FiCheck } from "react-icons/fi"; // Using standard, clean react-icons alternatives
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  command: string;
  className?: string;
}

export function CopyButton({ command, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard errors (e.g. permission denied or unsupported browser)
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-none border border-border bg-background p-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring select-none active:scale-[0.98]",
        className
      )}
      aria-label={copied ? "Copied execution command" : "Copy execution command"}
    >
      {copied ? (
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <FiCheck className="h-3 w-3 stroke-[3]" />
          <span>copied</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <FiCopy className="h-3 w-3" />
          <span>copy</span>
        </span>
      )}
    </button>
  );
}
