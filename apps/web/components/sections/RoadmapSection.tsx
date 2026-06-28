import { ROADMAP_BRICKS } from "@/lib/data";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function RoadmapSection() {
  return (
    <section
      id="roadmap"
      aria-labelledby="roadmap-heading"
      className="relative border-t border-border bg-background py-16 sm:py-24 lg:py-32"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-16 text-center sm:mb-20">
          <p className="mb-3 font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Roadmap
          </p>
          <h2
            id="roadmap-heading"
            className="text-balance font-sans text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Built block by block.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Solid blocks are shipped. Dashed blocks are next. No vaporware.
          </p>
        </header>

        {/* Timeline */}
        <ol className="relative">
          {/* Vertical spine */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-4 w-px bg-border sm:left-1/2 sm:-translate-x-px"
          />

          {ROADMAP_BRICKS.map((brick, index) => {
            const isReady = brick.status === "ready";
            const isLast = index === ROADMAP_BRICKS.length - 1;
            // Even index → card on the left (desktop); odd → card on the right
            const isLeft = index % 2 === 0;

            return (
              <li key={brick.label} className={cn("relative mb-10", !isLast && "pb-2")}>
                {/* ── Mobile layout ───────────────────────────── */}
                <div className="flex items-start gap-4 sm:hidden">
                  {/* Node — sits on the left spine */}
                  <div className="relative z-10 mt-0.5 shrink-0">
                    <TimelineNode isReady={isReady} size="sm" />
                  </div>

                  {/* Card */}
                  <RoadmapCard brick={brick} isReady={isReady} />
                </div>

                {/* ── Desktop layout ──────────────────────────── */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-x-6">
                  {/* Left slot */}
                  <div className="flex justify-end">
                    {isLeft && (
                      <RoadmapCard brick={brick} isReady={isReady} className="text-right" />
                    )}
                  </div>

                  {/* Center node */}
                  <div className="relative z-10 flex shrink-0 items-center justify-center">
                    <TimelineNode isReady={isReady} size="md" />
                  </div>

                  {/* Right slot */}
                  <div className="flex justify-start">
                    {!isLeft && <RoadmapCard brick={brick} isReady={isReady} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function TimelineNode({ isReady, size }: { isReady: boolean; size: "sm" | "md" }) {
  const dim = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const iconDim = size === "md" ? "h-5 w-5" : "h-4 w-4";

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full border-2 transition-colors",
        dim,
        isReady
          ? "border-primary bg-primary"
          : "border-dashed border-muted-foreground/40 bg-background"
      )}
    >
      {isReady ? (
        <Check className={cn(iconDim, "text-primary-foreground")} aria-hidden="true" />
      ) : (
        <span
          className={cn(
            "rounded-full bg-muted-foreground/30",
            size === "md" ? "h-2 w-2" : "h-1.5 w-1.5"
          )}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

function RoadmapCard({
  brick,
  isReady,
  className
}: {
  brick: { label: string; description: string; status: string };
  isReady: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-xs rounded-lg border p-4 sm:p-5",
        isReady ? "border-border bg-card" : "border-dashed border-border bg-muted/30",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "font-mono text-sm font-semibold",
            isReady ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {brick.label}
        </p>
        <StatusBadge status={brick.status} isReady={isReady} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{brick.description}</p>
    </div>
  );
}

function StatusBadge({ status, isReady }: { status: string; isReady: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-wide",
        isReady ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}
