"use client";

import { useState } from "react";
import { CopyIcon } from "./CopyIcon";

interface CopyButtonProps {
  command: string;
  className?: string;
}

export function CopyButton({ command, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(command).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={`group flex items-center gap-3 font-mono text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 hover:border-white/20 transition-colors focus-ring ${className}`}
    >
      <span className="text-[var(--accent)]">$</span>
      <span className="text-[var(--fg)]">{copied ? `${command} ✓ copied` : command}</span>
      <CopyIcon className="text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors ml-1" />
    </button>
  );
}
