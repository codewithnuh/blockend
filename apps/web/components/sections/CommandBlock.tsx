"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CommandBlockProps {
  command: string;
  className?: string;
}

export function CommandBlock({ command, className }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.log("FAILED TO COPY");
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-btn border border-graphite bg-obsidian px-3.5 py-2 font-mono text-[12px] text-mist shadow-linear-sm",
        className
      )}
    >
      <span className="text-ash select-none">$</span>
      <span className="text-bone whitespace-nowrap">{command}</span>
      <button
        onClick={handleCopy}
        className="ml-auto text-ash hover:text-mist transition-colors shrink-0"
        aria-label={copied ? "Copied" : "Copy command"}
      >
        {copied ? (
          <svg
            className="w-3.5 h-3.5 text-pulse-green"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
