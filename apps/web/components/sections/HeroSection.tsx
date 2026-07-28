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
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-12 sm:pb-20"
    >
      <div className="max-w-4xl space-y-6">
        <StatusBadge label={HERO.badge} />

        <h1
          id="hero-heading"
          className="text-[clamp(2rem,5vw,4rem)] font-medium text-paper tracking-tight leading-none"
        >
          {HERO.headline}
        </h1>

        <p className="text-[clamp(0.9375rem,1.5vw,1.25rem)] text-fog max-w-2xl font-regular leading-snug">
          {HERO.subheadline}
        </p>

        <nav
          aria-label="Hero Actions"
          className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <Button
            asChild
            className="px-5 w-full sm:w-auto py-2.5 h-auto text-[14px] font-medium rounded-btn bg-acid-lime text-void hover:bg-[#d6e31f] transition-all shadow-linear-button flex items-center justify-center gap-2"
          >
            <Link href={HERO.cta.href}>
              <span>{HERO.cta.label}</span>
              <ArrowRight className="w-3 h-3 shrink-0" aria-hidden="true" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="px-4 w-full sm:w-auto py-2.5 h-auto text-[13px] font-regular text-mist hover:text-paper border-graphite rounded-btn hover:bg-carbon transition-all flex items-center justify-center gap-2 bg-transparent"
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

      {/* Code Showcase Block */}
      <figure
        aria-label="Code Example: Rate Limiter Implementation"
        className="mt-12 md:mt-16 rounded-card bg-[#0d0e11] border border-white/[0.08] shadow-2xl overflow-hidden"
      >
        <figcaption className="px-4 py-3 bg-[#121316] border-b border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[12px] font-mono">
          {/* Window Controls & File Path */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-white/[0.12] inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/[0.12] inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/[0.12] inline-block" />
            </div>
            <span className="ml-2 text-white/50 text-[12px]">src/blocks/rate-limiter.ts</span>
          </div>

          {/* Metadata Badges */}
          <div className="flex items-center gap-2" role="list" aria-label="Code metrics">
            <Badge
              variant="outline"
              role="listitem"
              className="px-2 py-0.5 rounded-md bg-white/[0.03] border-white/[0.08] text-[11px] text-white/70 font-normal tracking-wide transition-colors hover:bg-white/[0.06]"
            >
              Zero Runtime Dep
            </Badge>
            <Badge
              variant="outline"
              role="listitem"
              className="px-2 py-0.5 rounded-md bg-white/[0.03] border-white/[0.08] text-[11px] text-white/70 font-normal tracking-wide transition-colors hover:bg-white/[0.06]"
            >
              100% Strict TypeScript
            </Badge>
          </div>
        </figcaption>

        {/* Code Container */}
        <div className="bg-[#0d0e11]">
          <HighlightedCode code={CODE_EXAMPLE} />
        </div>
      </figure>
    </section>
  );
}
