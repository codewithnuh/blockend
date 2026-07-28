import { FINAL_CTA } from "@/lib/landing-constants";
import { CommandBlock } from "./CommandBlock";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function FinalCTASection() {
  return (
    <section
      id="get-started"
      aria-labelledby="cta-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      <Card className="p-10 md:p-16 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite text-center shadow-sm dark:shadow-linear-card transition-colors">
        <CardContent className="p-0 max-w-2xl mx-auto space-y-6">
          <header className="space-y-4">
            <h2
              id="cta-heading"
              className="text-3xl sm:text-4xl font-medium text-fg dark:text-paper tracking-tight transition-colors"
            >
              {FINAL_CTA.headline}
            </h2>
            <p className="text-[15px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
              {FINAL_CTA.description}
            </p>
          </header>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Primary Action Button */}
            <Button
              asChild
              className="w-full sm:w-auto px-6 py-2.5 text-[14px] font-medium rounded-btn bg-lime-600 text-white hover:bg-lime-700 dark:bg-acid-lime dark:text-void dark:hover:bg-[#d6e31f] transition-all shadow-sm dark:shadow-linear-button text-center h-auto border-none"
            >
              <Link href={FINAL_CTA.primaryCta.href}>{FINAL_CTA.primaryCta.label}</Link>
            </Button>

            {/* Secondary Action Button */}
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto px-5 py-2.5 text-[13px] font-normal text-muted-foreground hover:text-fg border-border dark:text-mist dark:hover:text-paper dark:border-graphite rounded-btn hover:bg-surface-2 dark:hover:bg-obsidian bg-transparent transition-all text-center h-auto"
            >
              <Link href={FINAL_CTA.secondaryCta.href} target="_blank" rel="noopener noreferrer">
                {FINAL_CTA.secondaryCta.label}
              </Link>
            </Button>
          </div>

          {/* CLI / Quick Installation Command */}
          <div className="pt-4 flex justify-center">
            <CommandBlock command={FINAL_CTA.command} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
