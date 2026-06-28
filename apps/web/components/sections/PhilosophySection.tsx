import { PHILOSOPHY_CARDS } from "@/lib/data";

export function PhilosophySection() {
  return (
    <section className="relative py-28 border-t border-border dot-grid bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="reveal max-w-2xl mb-14">
          <p className="font-mono text-[0.7rem] tracking-[0.15em] uppercase text-primary mb-4">
            why copy, not install
          </p>
          <h2 className="font-display font-bold text-[clamp(1.8rem,3.2vw,2.6rem)] leading-[1.1] tracking-tight">
            Frontend figured this out years ago.
          </h2>
          <p className="text-muted-foreground leading-[1.7] mt-5">
            shadcn/ui proved that developers don&apos;t want another dependency — they want the
            code, in their own repo, that they can shape to their architecture. Backend
            infrastructure is mostly the same handful of patterns repeated project after project. It
            deserves the same treatment.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-3 gap-5">
          {PHILOSOPHY_CARDS.map((card, i) => (
            <div
              key={card.title}
              className="reveal glow-card rounded-xl p-6"
              style={{ transitionDelay: `${i * 0.06}s` }}
            >
              <p className="font-display font-semibold mb-2 text-foreground">{card.title}</p>
              <p
                className="text-sm text-muted-foreground leading-[1.6]"
                dangerouslySetInnerHTML={{
                  __html: card.body.replace(
                    /node_modules/g,
                    `<span class="font-mono bg-muted text-foreground px-1 py-0.5 rounded text-[0.85em]">node_modules</span>`
                  )
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
