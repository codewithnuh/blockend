import Link from "next/link";
import { CopyButton } from "./CopyButton";
import { HeroTerminal } from "./HeroTerminal";
import { FileText, Terminal } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-center pt-28 pb-16 overflow-hidden bg-background text-foreground">
      {/* Backgrounds */}
      <div className="absolute inset-0 dot-grid pointer-events-none opacity-50 dark:opacity-100" />
      <div className="absolute inset-0 glow-radial pointer-events-none opacity-50 dark:opacity-100" />
      <div className="absolute inset-0 noise pointer-events-none opacity-[0.02] dark:opacity-[0.05]" />

      <div className="relative max-w-6xl mx-auto px-6 lg:px-12 w-full grid lg:grid-cols-[1.05fr_1fr] gap-16 items-center">
        {/* Left column */}
        <div>
          {/* Eyebrow */}
          <div className="reveal inline-flex items-center  gap-2 rounded-full border-white  border border-border bg-muted/40 px-3 py-1.5 text-[0.7rem] font-mono font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-primary " />
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

          {/* Interactive Core Executable CTAs */}
          <div
            id="install"
            className="reveal mt-10 flex flex-col sm:flex-row sm:items-stretch gap-3 max-w-md"
            style={{ transitionDelay: "0.18s" }}
          >
            {/* Primary Command Trigger */}
            <div className="flex-1 flex items-center gap-2 rounded-none border border-border bg-muted/10 px-3 py-1.5 focus-within:border-primary/40">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 select-none" />
              <code className="flex-1 text-left font-mono text-xs text-foreground overflow-x-auto whitespace-nowrap scrollbar-none select-all pr-2">
                npx blockend-cli init
              </code>
              <CopyButton
                command="npx blockend-cli init"
                className="border-none bg-transparent hover:bg-muted/50 h-7"
              />
            </div>

            {/* Secondary Documentation Link */}
            <Link
              href="/docs"
              className="flex items-center justify-center gap-2 rounded-none border border-border bg-background px-5 py-2.5 text-xs font-mono font-medium tracking-wide uppercase text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>read_docs_</span>
            </Link>
          </div>

          {/* System Environment Structural Meta Flags */}
          <div
            className="reveal mt-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground/50 select-none divide-x divide-border/40"
            style={{ transitionDelay: "0.22s" }}
          >
            <span className="pr-0">license: mit_open_source</span>
            <span className="pl-4">dependencies: 0_runtime</span>
            <span className="pl-4">pipeline: typescript_native</span>
          </div>
        </div>

        {/* Right column — terminal */}
        <HeroTerminal />
      </div>
    </section>
  );
}
