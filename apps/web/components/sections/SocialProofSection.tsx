import { SOCIAL_PROOF } from "@/lib/landing-constants";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function SocialProofSection() {
  return (
    <section
      aria-label="Social proof and metrics"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      <Card className="py-6 px-6 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite flex flex-col md:flex-row items-center justify-between gap-6 text-[13px] shadow-sm transition-colors">
        {/* Badge & Subtext Header Group */}
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-btn bg-surface-2 border-border dark:bg-obsidian dark:border-graphite flex items-center justify-center text-fg dark:text-paper font-mono text-[12px] shrink-0 select-none transition-colors"
          >
            &lt;/&gt;
          </div>
          <div>
            <p className="font-medium text-fg dark:text-bone transition-colors">
              {SOCIAL_PROOF.badge}
            </p>
            <p className="text-muted-foreground dark:text-fog text-[12px] transition-colors">
              {SOCIAL_PROOF.subtext}
            </p>
          </div>
        </div>

        {/* Stats List Container */}
        <div
          role="list"
          aria-label="Platform Statistics"
          className="flex items-center gap-8 font-mono text-[12px] text-muted-foreground dark:text-fog border-t md:border-t-0 md:border-l border-border dark:border-graphite pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-center transition-colors"
        >
          {SOCIAL_PROOF.stats.map((stat, i) => (
            <div key={stat.label} role="listitem" className="flex items-center">
              <div className="text-center">
                <span className="block font-medium text-fg dark:text-paper text-[13px] transition-colors">
                  {stat.value}
                </span>
                <span className="text-muted-foreground/80 dark:text-ash text-[11px] transition-colors">
                  {stat.label}
                </span>
              </div>

              {/* Accessible Vertical Divider */}
              {i < SOCIAL_PROOF.stats.length - 1 && (
                <Separator
                  orientation="vertical"
                  className="hidden md:block h-6 mx-8 bg-border dark:bg-graphite shrink-0 transition-colors"
                />
              )}
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
