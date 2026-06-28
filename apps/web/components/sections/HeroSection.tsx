import Link from "next/link";
import { CopyButton } from "./CopyButton";
import { HeroTerminal } from "./HeroTerminal";

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center pt-28 pb-16 overflow-hidden bg-background text-foreground">
      {/* Backgrounds */}
      <div className="absolute inset-0 dot-grid pointer-events-none opacity-50 dark:opacity-100" />
      <div className="absolute inset-0 glow-radial pointer-events-none opacity-50 dark:opacity-100" />
      <div className="absolute inset-0 noise pointer-events-none opacity-[0.02] dark:opacity-[0.05]" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 w-full grid lg:grid-cols-[1.05fr_1fr] gap-16 items-center">
        {/* Left column */}
        <div>
          {/* Eyebrow */}
          <div className="reveal inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[0.7rem] font-mono font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            shadcn/ui, for backend engineers
          </div>

          {/* Headline */}
          <h1
            className="reveal font-display font-bold text-[clamp(2.6rem,5.4vw,4.6rem)] leading-[0.98] tracking-tight"
            style={{ transitionDelay: "0.05s" }}
          >
            Copy the backend.
            <br />
            <span className="text-primary">Own</span> the code.
          </h1>

          {/* Subline */}
          <p
            className="reveal text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.65] text-muted-foreground mt-6 max-w-[34rem]"
            style={{ transitionDelay: "0.12s" }}
          >
            Blockend generates production-ready backend blocks — rate limiters, error handlers,
            loggers — straight into your source tree. No package to install. No black box in{" "}
            <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-sm text-foreground">
              node_modules
            </code>
            . Just code you can read, edit, and delete.
          </p>

          {/* CTAs */}
          <div
            id="install"
            className="reveal mt-9 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{ transitionDelay: "0.18s" }}
          >
            <CopyButton command="npx blockend-cli init" />
            <Link
              href="/docs"
              className="rounded-lg px-5 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground"
            >
              Read Docs →
            </Link>
          </div>

          {/* Meta */}
          <p
            className="reveal mt-5 text-xs font-mono text-muted-foreground"
            style={{ transitionDelay: "0.22s" }}
          >
            MIT licensed · zero runtime dependency · TypeScript first
          </p>
        </div>

        {/* Right column — terminal */}
        <HeroTerminal />
      </div>
    </section>
  );
}
