import { ROADMAP } from "@/lib/landing-constants";

export function RoadmapSection() {
  return (
    <section id="roadmap" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="mb-12">
        <span className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase transition-colors">
          {ROADMAP.badge}
        </span>
        <h2 className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight mt-2 transition-colors">
          {ROADMAP.headline}
        </h2>
      </div>

      {/* Roadmap Items Grid */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {ROADMAP.items.map((item) => (
          <div
            key={item.title}
            className="p-5 rounded-card bg-surface border border-border dark:bg-carbon dark:border-graphite space-y-2 shadow-sm transition-colors"
          >
            <span className={`font-mono text-[11px] uppercase ${item.color}`}>{item.period}</span>
            <h3 className="text-[15px] font-medium text-fg dark:text-paper transition-colors">
              {item.title}
            </h3>
            <p className="text-[13px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom Quote Banner */}
      <div className="p-6 rounded-card bg-surface border border-border dark:bg-carbon dark:border-graphite text-center max-w-3xl mx-auto shadow-sm transition-colors">
        <p className="text-[14px] text-muted-foreground dark:text-mist leading-relaxed font-sans transition-colors">
          {ROADMAP.quote}
        </p>
      </div>
    </section>
  );
}
