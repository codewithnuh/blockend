"use client";

import Link from "next/link";
import { Terminal, FileText } from "lucide-react";
import { CopyButton } from "./CopyButton";

export function FinalCTASection() {
  return (
    <section className="relative py-24 sm:py-32 border-t border-border bg-background text-foreground overflow-hidden">
      {/* Structural matrix crosshair overlay background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(var(--border),0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(var(--border),0.1)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-40" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 z-10">
        {/* Terminal Deployment Shell Panel */}
        <div className="rounded-none border border-border bg-card shadow-sm max-w-2xl mx-auto">
          {/* Top Panel System Status */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3 select-none">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-none bg-primary animate-pulse"></span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
                system // terminal_deployment
              </span>
            </div>
            <div className="font-mono text-[9px] text-muted-foreground/30">root_session_active</div>
          </div>

          {/* Panel Core Content */}
          <div className="p-6 sm:p-10 text-center">
            {/* Primary Editorial Conversion Title: Inter Display */}
            <h2
              id="final-cta-heading"
              className="reveal font-display font-bold text-2xl sm:text-3xl tracking-tight mb-4 text-foreground text-balance"
            >
              Stop rewriting the same backend.
            </h2>

            {/* Descriptive Body Copy: Standard Sans */}
            <p
              className="reveal font-sans text-xs sm:text-sm text-muted-foreground/90 max-w-md mx-auto mb-8 leading-relaxed"
              style={{ transitionDelay: "0.08s" }}
            >
              Inject verified structural patterns into your project pipeline in under 60 seconds.
              Zero config file overhead.
            </p>

            {/* CTA Interaction Control Strip */}
            <div
              className="reveal flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-md mx-auto"
              style={{ transitionDelay: "0.14s" }}
            >
              {/* Primary Command Interaction: Code Base Mono */}
              <div className="flex-1 flex items-center gap-2 rounded-none border border-border bg-muted/20 px-3 py-1.5 transition-all focus-within:border-primary/40">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 select-none" />
                <code className="flex-1 text-left font-mono text-xs text-foreground overflow-x-auto whitespace-nowrap scrollbar-none select-all pr-2">
                  npx blockend-cli init
                </code>
                <CopyButton command="npx blockend-cli init" />
              </div>

              {/* Secondary Reference Fallback: Action Mono */}
              <Link
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-none border border-border bg-background px-4 py-2 text-xs font-mono font-bold tracking-wide uppercase text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0 active:scale-[0.98]"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>read_docs_</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
