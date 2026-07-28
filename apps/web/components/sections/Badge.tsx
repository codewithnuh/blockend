import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "green" | "violet";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-badge font-mono text-[10px] border",
        variant === "default" && "bg-obsidian border-graphite text-fog",
        variant === "green" && "bg-carbon border-graphite text-pulse-green",
        variant === "violet" && "bg-carbon border-graphite text-iris-violet",
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-pill dark:bg-carbon border border-graphite text-[12px] font-mono  text-carbon dark:text-fog">
      <span className="w-1.5 h-1.5 rounded-full bg-pulse-green" />
      {label}
    </span>
  );
}
