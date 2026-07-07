"use client";

import { Check, Terminal, Square } from "lucide-react";
import { ROADMAP_BRICKS } from "@/lib/data";
import { cn } from "@/lib/utils";

export function RoadmapSection() {
  return (
    <section
      id="roadmap"
      aria-labelledby="roadmap-heading"
      className="relative border-t border-border bg-background py-24 text-foreground sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
        {/* Header Block */}
        <header className="mb-16 max-w-2xl">
          <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary flex items-center gap-2 select-none">
            <span className="inline-block w-1.5 h-1.5 bg-primary"></span>
            milestones // roadmap
          </p>

          {/* Primary Editorial Title: Inter Display */}
          <h2
            id="roadmap-heading"
            className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Built block by block.
          </h2>

          {/* Descriptive Block Copy: Standard Sans */}
          <p className="mt-4 font-sans text-sm leading-relaxed text-muted-foreground">
            Production versions are frozen and integrated. Dashed tasks represent pipeline queues
            currently in compilation. Zero vaporware.
          </p>
        </header>

        {/* Industrial Structural Timeline Layout Grid */}
        <div className="relative border-l border-border/70 ml-3 pl-6 space-y-6">
          {ROADMAP_BRICKS.map((brick, index) => {
            const isReady = brick.status === "ready";

            return (
              <div
                key={brick.label}
                className="group relative flex flex-col md:flex-row md:items-start gap-4 p-5 rounded-none border transition-all duration-150 bg-card hover:bg-muted/10"
                style={{
                  borderStyle: isReady ? "solid" : "dashed",
                  borderColor: isReady ? "var(--border)" : "rgba(var(--border), 0.4)"
                }}
              >
                {/* Custom Left Node Tracker Axis Indicator */}
                <div className="absolute -left-[31px] top-6 z-10 flex items-center justify-center bg-background p-0.5">
                  <TimelineNode isReady={isReady} />
                </div>

                {/* Left Card Segment: Feature Label Meta Node */}
                <div className="flex items-center justify-between gap-4 shrink-0 md:w-52 select-none">
                  <div className="flex items-center gap-2">
                    <Terminal
                      className={cn(
                        "h-3.5 w-3.5 hidden md:block",
                        isReady ? "text-emerald-400" : "text-muted-foreground/30"
                      )}
                    />
                    <h3
                      className={cn(
                        "font-mono text-xs font-bold tracking-tight uppercase",
                        isReady ? "text-foreground" : "text-muted-foreground/70"
                      )}
                    >
                      {brick.label}
                    </h3>
                  </div>
                  <div className="md:hidden">
                    <StatusBadge status={brick.status} isReady={isReady} />
                  </div>
                </div>

                {/* Description Body Segment: Standard Sans */}
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-xs leading-relaxed text-muted-foreground/90">
                    {brick.description}
                  </p>
                </div>

                {/* Right Card Segment: Metadata Badge (Desktop Interface Grid) */}
                <div className="hidden md:flex shrink-0 items-center justify-end w-28 select-none">
                  <StatusBadge status={brick.status} isReady={isReady} />
                </div>

                {/* Aesthetic Inline Hex Code Tracker Flag */}
                <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-0 group-hover:opacity-20 text-muted-foreground/50 select-none transition-opacity">
                  {`0x0${index + 1}_build`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Embedded Contextual Sub-components ──────────────────────────────── */

function TimelineNode({ isReady }: { isReady: boolean }) {
  return (
    <div
      className={cn(
        "flex h-4 w-4 items-center justify-center border transition-all select-none rounded-none",
        isReady
          ? "border-emerald-500 bg-emerald-500 text-background" /* Swapped text/bg weights to make the box solid & non-transparent */
          : "border-dashed border-border bg-background text-muted-foreground/30"
      )}
    >
      {isReady ? (
        <Check className="h-2.5 w-2.5 stroke-[3.5]" />
      ) : (
        <Square className="h-1.5 w-1.5 fill-current opacity-30" />
      )}
    </div>
  );
}

function StatusBadge({ status, isReady }: { status: string; isReady: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-none border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider",
        isReady
          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
          : "border-border bg-muted/40 text-muted-foreground/50"
      )}
    >
      {status}
    </span>
  );
}
