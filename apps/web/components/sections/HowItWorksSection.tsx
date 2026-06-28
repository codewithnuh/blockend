"use client";
import { ArrowRight, Copy, Check } from "lucide-react";
import { WORKFLOW_STEPS } from "@/lib/data";
import { useState } from "react";
import { Button } from "../ui/button";

function CopyButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={copied ? "Copied" : `Copy ${command}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-primary" />
          <span className="text-primary">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copy</span>
        </>
      )}
    </Button>
  );
}

export function HowItWorksSection() {
  return (
    <section
      id="how"
      aria-labelledby="workflow-heading"
      className="relative border-t border-border bg-background py-16 sm:py-20 md:py-24 lg:py-32"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-12">
        {/* Header */}
        <header className="mb-10 sm:mb-12 md:mb-16">
          <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.15em] text-primary">
            Workflow
          </p>

          <h2
            id="workflow-heading"
            className="text-balance font-sans text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Three commands to production.
          </h2>

          <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground sm:mt-4 sm:text-lg">
            No configuration files. No boilerplate. Just the commands you already know.
          </p>
        </header>

        {/* Terminal Window */}
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {/* Terminal Chrome */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-muted-foreground/25" />
            <div className="h-3 w-3 rounded-full bg-muted-foreground/25" />
            <div className="h-3 w-3 rounded-full bg-muted-foreground/25" />
            <span className="ml-2 font-mono text-xs text-muted-foreground/60">~/project</span>
          </div>

          {/* Terminal Body — Steps as command lines */}
          <ol className="divide-y divide-border">
            {WORKFLOW_STEPS.map((step, index) => (
              <li
                key={step.step ?? index}
                className="group transition-colors duration-200 hover:bg-accent/50 focus-within:bg-accent/50"
              >
                {/* Mobile: stacked layout */}
                <div className="flex flex-col gap-3 p-4 sm:hidden">
                  {/* Step label row */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-primary">
                      ${step.step}
                    </span>
                    <span className="font-sans text-sm font-medium text-foreground">
                      {step.title}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="pl-6 text-sm leading-6 text-muted-foreground">{step.description}</p>

                  {/* Command block */}
                  {step.command && !step.commandMuted ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                      <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-foreground scrollbar-none">
                        <span className="mr-2 select-none text-primary">$</span>
                        {step.command}
                      </code>
                      <CopyButton command={step.command} />
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2.5 font-mono text-sm text-muted-foreground">
                      Keep it, it&apos;s Your
                    </div>
                  )}
                </div>

                {/* Tablet+: inline row layout */}
                <div className="hidden items-center gap-4 p-4 sm:flex md:p-5">
                  {/* Step number + title */}
                  <div className="flex w-44 shrink-0 items-center gap-3 md:w-52">
                    <span className="font-mono text-sm font-semibold text-primary">
                      ${step.step}
                    </span>
                    <span className="font-sans text-sm font-medium text-foreground">
                      {step.title}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="hidden h-8 w-px bg-border md:block" />

                  {/* Description — hidden on tablet, shown on desktop */}
                  <p className="hidden w-48 shrink-0 text-sm leading-6 text-muted-foreground lg:block xl:w-56">
                    {step.description}
                  </p>

                  {/* Command */}
                  <div className="min-w-0 flex-1">
                    {step.command && !step.commandMuted ? (
                      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 transition-colors group-hover:border-primary/30 group-hover:bg-muted/60">
                        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-foreground scrollbar-none">
                          <span className="mr-2 select-none text-primary">$</span>
                          {step.command}
                        </code>
                        <CopyButton command={step.command} />
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 font-mono text-sm text-muted-foreground">
                        Keep it, it&apos;s Your
                      </div>
                    )}
                  </div>

                  {/* Arrow connector — not on last step */}
                  {!step.commandMuted && index !== WORKFLOW_STEPS.length - 1 && (
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:text-primary group-hover:translate-x-1 lg:block" />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center font-mono text-xs text-muted-foreground/60">
          Press{" "}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            Enter
          </kbd>{" "}
          after each command
        </p>
      </div>
    </section>
  );
}
