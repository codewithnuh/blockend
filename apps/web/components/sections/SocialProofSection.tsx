import { SOCIAL_PROOF } from "@/lib/landing-constants";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function SocialProofSection() {
  return (
    <section
      aria-label="Social proof and metrics"
      className="max-w-300 mx-auto px-4 sm:px-6 lg:px-8"
    >
      <Card className="py-6   px-6 rounded-card bg-carbon border-graphite flex flex-col md:flex-row items-center justify-between gap-6 text-[13px] shadow-none">
        {/* Badge & Subtext Header Group */}
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="w-8 h-8 rounded-btn bg-obsidian border border-graphite flex items-center justify-center text-paper font-mono text-[12px] shrink-0 select-none"
          >
            &lt;/&gt;
          </div>
          <div>
            <p className="font-medium text-bone">{SOCIAL_PROOF.badge}</p>
            <p className="text-fog text-[12px]">{SOCIAL_PROOF.subtext}</p>
          </div>
        </div>

        {/* Stats List Container */}
        <div
          role="list"
          aria-label="Platform Statistics"
          className="flex items-center gap-8 font-mono text-[12px] text-fog border-t md:border-t-0 md:border-l border-graphite pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-center"
        >
          {SOCIAL_PROOF.stats.map((stat, i) => (
            <div key={stat.label} role="listitem" className="flex items-center">
              <div className="text-center">
                <span className="block font-medium text-paper text-[13px]">{stat.value}</span>
                <span className="text-ash text-[11px]">{stat.label}</span>
              </div>

              {/* Accessible Vertical Divider using shadcn Separator */}
              {i < SOCIAL_PROOF.stats.length - 1 && (
                <Separator
                  orientation="vertical"
                  className="hidden md:block h-6 mx-8 bg-graphite shrink-0"
                />
              )}
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
