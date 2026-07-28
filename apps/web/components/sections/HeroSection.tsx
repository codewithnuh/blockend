import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HERO, CODE_EXAMPLE } from "@/lib/landing-constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./Badge";
import { CommandBlock } from "./CommandBlock";
import { HighlightedCode } from "./HighlightedCode";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="max-w-300 mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-12 sm:pb-20"
    >
      <div className="max-w-4xl space-y-6">
        <StatusBadge label={HERO.badge} />

        {/* Dynamic Light/Dark Headline */}
        <h1
          id="hero-heading"
          className="text-[clamp(2rem,5vw,4rem)] font-medium text-foreground tracking-tight leading-none transition-colors"
        >
          {HERO.headline}
        </h1>

        {/* Dynamic Light/Dark Subheadline */}
        <p className="text-[clamp(0.9375rem,1.5vw,1.25rem)] text-muted-foreground max-w-2xl font-normal leading-snug transition-colors">
          {HERO.subheadline}
        </p>

        <nav
          aria-label="Hero Actions"
          className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          {/* Restored Acid Lime Green CTA */}
          <Button
            asChild
            className="px-5 w-full sm:w-auto py-2.5 h-auto text-[14px] font-medium rounded-btn bg-acid-lime text-void hover:opacity-90 hover:-translate-y-[1px] transition-all shadow-linear-button flex items-center justify-center gap-2 border-0"
          >
            <Link href={HERO.cta.href}>
              <span>{HERO.cta.label}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </Button>

          {/* Dynamic Light/Dark Secondary Button */}
          <Button
            asChild
            variant="outline"
            className="px-4 w-full sm:w-auto py-2.5 h-auto text-[13px] font-normal text-foreground border-border hover:bg-accent hover:text-accent-foreground rounded-btn transition-all flex items-center justify-center gap-2 bg-transparent"
          >
            <Link href={HERO.secondaryCta.href}>
              <span>{HERO.secondaryCta.label}</span>
            </Link>
          </Button>
        </nav>

        <div className="pt-4">
          <CommandBlock command={HERO.command} />
        </div>
      </div>

      {/* Code Showcase Block — Fixed dark container per design system spec */}
      <figure
        aria-label="Code Example: Rate Limiter Implementation"
        className="mt-12 md:mt-16 rounded-card bg-carbon border border-graphite shadow-2xl overflow-hidden"
      >
        <figcaption className="px-4 py-3 bg-obsidian border-b border-graphite flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[12px] font-mono">
          {/* Window Controls & File Path */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500/60 inline-block" />
            </div>
            <span className="ml-2 text-fog text-[12px]">src/blocks/rate-limiter.ts</span>
          </div>

          {/* Metadata Badges */}
          <div className="flex items-center gap-2" role="list" aria-label="Code metrics">
            <Badge
              variant="outline"
              role="listitem"
              className="px-2 py-0.5 rounded-md bg-graphite/40 border-smoke/40 text-[11px] text-mist font-normal tracking-wide transition-colors hover:bg-graphite"
            >
              Zero Runtime Dep
            </Badge>
            <Badge
              variant="outline"
              role="listitem"
              className="px-2 py-0.5 rounded-md bg-graphite/40 border-smoke/40 text-[11px] text-mist font-normal tracking-wide transition-colors hover:bg-graphite"
            >
              100% Strict TypeScript
            </Badge>
          </div>
        </figcaption>

        {/* Code Container */}
        <div className="dark:bg-carbon">
          <HighlightedCode code={CODE_EXAMPLE} />
        </div>
      </figure>
    </section>
  );
}
