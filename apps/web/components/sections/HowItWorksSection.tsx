"use client";

import { ArrowRight, Copy, Check } from "lucide-react";
import { WORKFLOW_STEPS } from "@/lib/data";
import { useState } from "react";

function CopyButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      // Ignore clipboard errors (e.g. permission denied or unsupported browser)
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="inline-flex items-center gap-1.5 rounded-none border border-border bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring select-none active:scale-[0.98]"
      aria-label={copied ? "Copied command string" : `Copy ${command}`}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-primary stroke-[2.5]" />
          <span className="text-primary font-semibold">copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>copy</span>
        </>
      )}
    </button>
  );
}

export function HowItWorksSection() {
  return (
    <section
      id="how"
      aria-labelledby="workflow-heading"
      className="relative border-t border-border bg-background py-24 text-foreground sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
        {/* Header Block */}
        <header className="mb-12 max-w-3xl">
          {/* Eyebrow: System Label Track */}
          <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-primary"></span>
            workflow // initialize
          </p>

          {/* Primary Editorial Headline: Rendered with Inter Display */}
          <h2
            id="workflow-heading"
            className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Three commands to production.
          </h2>

          {/* Body Prose: Standard Sans */}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground max-w-xl font-sans">
            No bloated configuration blocks. No hidden dependency scripts. Run the execution
            primitives directly in your local directory environment.
          </p>
        </header>

        {/* Brutalist Industrial Terminal Window Component Frame */}
        <div className="rounded-none border border-border bg-card shadow-sm">
          {/* Terminal Top Window Bar Controls */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3 select-none">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-none bg-border" />
              <div className="h-2.5 w-2.5 rounded-none bg-border" />
              <div className="h-2.5 w-2.5 rounded-none bg-border" />
              <span className="ml-2 font-mono text-[11px] text-muted-foreground/60 tracking-tight">
                bash — ~/workspace/project
              </span>
            </div>
            <div className="font-mono text-[9px] text-muted-foreground/30">v1.0.0_stable</div>
          </div>

          {/* Code Pipeline Processing Lines */}
          <ol className="divide-y divide-border/60">
            {WORKFLOW_STEPS.map((step, index) => (
              <li
                key={step.step ?? index}
                className="group flex flex-col gap-4 p-5 transition-all duration-150 hover:bg-muted/10 sm:flex-row sm:items-center sm:gap-6"
              >
                {/* Step Index Metric Identifier Label */}
                <div className="flex items-center gap-3 w-full shrink-0 sm:w-44 md:w-52 select-none">
                  <span className="font-mono text-xs font-bold text-primary/70 bg-primary/5 px-2 py-0.5 border border-primary/10">
                    {`0${step.step || index + 1}`}
                  </span>
                  <span className="font-sans text-sm font-medium text-foreground tracking-tight">
                    {step.title}
                  </span>
                </div>

                {/* Vertical Geometric Anchor Axis */}
                <div className="hidden h-5 w-px bg-border sm:block" />

                {/* Context Description Text Blocks */}
                <p className="text-xs leading-relaxed text-muted-foreground/90 font-sans sm:max-w-[180px] md:max-w-[220px] lg:max-w-[260px]">
                  {step.description}
                </p>

                {/* Shell Process Action Terminal Node */}
                <div className="min-w-0 flex-1">
                  {step.command && !step.commandMuted ? (
                    <div className="flex items-center gap-3 rounded-none border border-border bg-muted/20 px-3 py-2 transition-all group-hover:border-primary/30 group-hover:bg-muted/40">
                      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground scrollbar-none select-all">
                        <span className="mr-2 select-none text-muted-foreground/40">$</span>
                        {step.command}
                      </code>
                      <CopyButton command={step.command} />
                    </div>
                  ) : (
                    <div className="rounded-none border border-dashed border-border bg-muted/5 px-3 py-2 font-mono text-xs text-muted-foreground/50 select-none italic">
                      Runtime background processes attached
                    </div>
                  )}
                </div>

                {/* Iterative Direct Flow Anchors */}
                {!step.commandMuted && index !== WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-transform duration-200 group-hover:text-primary group-hover:translate-x-0.5 lg:block" />
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* Global Structural Verification Footprint */}
        <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] text-muted-foreground/40 select-none">
          <span>[press_enter]</span>
          <span>{"//"}</span>
          <span>sequential pipeline verification complete</span>
        </div>
      </div>
    </section>
  );
}
