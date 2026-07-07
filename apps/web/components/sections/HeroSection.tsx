import Link from "next/link";
import { CopyButton } from "./CopyButton";
import { HeroTerminal } from "./HeroTerminal";
import { FileText, Terminal } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center pt-28 pb-16 overflow-hidden bg-background text-foreground">
      {/* Background */}
      <div className="absolute inset-0 dot-grid pointer-events-none opacity-50 dark:opacity-100" />
      <div className="absolute inset-0 glow-radial pointer-events-none opacity-50 dark:opacity-100" />
      <div className="absolute inset-0 noise pointer-events-none opacity-[0.02] dark:opacity-[0.05]" />

      <div className="relative max-w-6xl mx-auto px-6 lg:px-12 w-full grid lg:grid-cols-[1.05fr_1fr] gap-16 items-center">
        {/* Left */}
        <div>
          {/* Eyebrow */}
          <div className="reveal inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[0.7rem] font-mono font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Source-first backend toolkit
          </div>

          {/* Headline */}
          <h1
            className="reveal font-display font-bold text-[clamp(2.6rem,5.4vw,4.6rem)] leading-[0.98] tracking-tight"
            style={{ transitionDelay: "0.05s" }}
          >
            Build backends.
            <br />
            <span className="text-primary">Own</span> every line.
          </h1>

          {/* Description */}
          <p
            className="reveal text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.65] text-muted-foreground mt-6 max-w-[34rem]"
            style={{ transitionDelay: "0.12s" }}
          >
            Blockend generates production-ready backend infrastructure directly into your project.
            Authentication, rate limiting, logging, and error handling — clean source code you can
            read, modify, and ship.
          </p>

          {/* Features */}
          <div
            className="reveal mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-mono text-muted-foreground"
            style={{ transitionDelay: "0.15s" }}
          >
            <span>✓ Uses battle-tested runtime dependencies</span>
            <span>✓ Avoids insecure custom implementations</span>
            <span>✓ Powerful, editable source code</span>
          </div>

          {/* CTA */}
          <div
            id="install"
            className="reveal mt-10 flex flex-col sm:flex-row sm:items-stretch gap-3 max-w-md"
            style={{ transitionDelay: "0.18s" }}
          >
            {/* Command */}
            <div className="flex-1 flex items-center gap-2 border border-border bg-muted/10 px-3 py-1.5 focus-within:border-primary/40">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />

              <code className="flex-1 text-left font-mono text-xs text-foreground overflow-x-auto whitespace-nowrap scrollbar-none select-all pr-2">
                npx blockend-cli init
              </code>

              <CopyButton
                command="npx blockend init"
                className="border-none bg-transparent hover:bg-muted/50 h-7"
              />
            </div>

            {/* Docs */}
            <Link
              href="/docs"
              className="flex items-center justify-center gap-2 border border-border bg-background px-5 py-2.5 text-xs font-mono font-medium tracking-wide uppercase text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
            >
              <FileText className="h-3.5 w-3.5" />
              Documentation
            </Link>
          </div>
        </div>

        {/* Terminal */}
        <HeroTerminal />
      </div>
    </section>
  );
}
