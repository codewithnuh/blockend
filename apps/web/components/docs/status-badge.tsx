"use client";

import { cn } from "@/lib/utils";
import { docStatuses, type DocStatus } from "@/lib/doc-status";

interface StatusBadgeProps {
  status: DocStatus;
  className?: string;
  size?: "sidebar" | "page";
}

export function StatusBadge({ status, className, size = "sidebar" }: StatusBadgeProps) {
  const config = docStatuses[status];

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-mono whitespace-nowrap transition-colors",
        size === "sidebar" && "px-1.5 py-0.5 text-[10px]",
        size === "page" && "px-2 py-0.5 text-[11px]",
        config.badge,
        className
      )}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
