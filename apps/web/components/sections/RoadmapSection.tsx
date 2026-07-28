import { ROADMAP } from "@/lib/landing-constants";

export function RoadmapSection() {
  return (
    <section id="roadmap" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-12">
        <span className="font-mono text-[12px] text-ash tracking-widest uppercase">
          {ROADMAP.badge}
        </span>
        <h2 className="text-2xl sm:text-[32px] font-regular text-paper tracking-compact mt-2">
          {ROADMAP.headline}
        </h2>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {ROADMAP.items.map((item) => (
          <div
            key={item.title}
            className="p-5 rounded-card bg-carbon border border-graphite space-y-2"
          >
            <span className={`font-mono text-[11px] uppercase ${item.color}`}>{item.period}</span>
            <h3 className="text-[15px] font-medium text-paper">{item.title}</h3>
            <p className="text-[13px] text-fog">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-card bg-carbon border border-graphite text-center max-w-3xl mx-auto">
        <p className="text-[14px] text-mist leading-relaxed font-sans">{ROADMAP.quote}</p>
      </div>
    </section>
  );
}
