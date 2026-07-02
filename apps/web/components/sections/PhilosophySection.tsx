"use client";

import { PHILOSOPHY_CARDS } from "@/lib/data";

export function PhilosophySection() {
  return (
    <section className="relative py-24 border-t border-border dot-grid bg-background text-foreground sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12">
        {/* Header Block */}
        <div className="reveal max-w-2xl mb-16">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary mb-4 flex items-center gap-2 select-none">
            <span className="inline-block w-1.5 h-1.5 bg-primary"></span>
            manifestio // architectural_design
          </p>

          {/* Primary Editorial Title: Inter Display */}
          <h2 className="font-display font-bold text-3xl leading-[1.1] tracking-tight text-foreground sm:text-4xl text-balance">
            Frontend figured this out years ago.
          </h2>

          {/* Descriptive Body Copy: Standard Sans */}
          <p className="font-sans text-sm text-muted-foreground leading-relaxed mt-5">
            shadcn/ui proved that developers don&apos;t want another dependency—they want raw source
            control in their own repository to wrap their custom business logic around. Backend
            infrastructure deserves the exact same approach. No locked black boxes.
          </p>
        </div>

        {/* Brutalist Architectural Card Layout Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-t border-l border-border/60 bg-muted/5">
          {PHILOSOPHY_CARDS.map((card, i) => (
            <div
              key={card.title}
              className="group relative flex flex-col justify-between p-6 sm:p-8 border-r border-b border-border/60 bg-background transition-all duration-150 hover:bg-muted/10 cursor-default select-none"
              style={{ transitionDelay: `${i * 0.04}s` }}
            >
              <div>
                {/* Structural Label Indicator: Pure Mono */}
                <div className="font-mono text-[9px] text-muted-foreground/30 mb-3 uppercase tracking-wider">
                  {`layer_0${i + 1} // directive`}
                </div>

                {/* Card Feature Title: Standard Sans */}
                <h3 className="font-sans font-semibold text-sm mb-3 text-foreground tracking-tight group-hover:text-primary transition-colors">
                  {card.title}
                </h3>

                {/* Body Content Node Parser: Standard Sans with Mono Inlines */}
                <p className="text-xs text-muted-foreground/90 leading-relaxed font-sans">
                  {card.body.split("node_modules").map((chunk, index, array) => (
                    <span key={index}>
                      {chunk}
                      {index < array.length - 1 && (
                        <code className="font-mono bg-muted/70 text-foreground border border-border/40 px-1 py-0.5 rounded-none text-[0.85em] select-all font-medium">
                          node_modules
                        </code>
                      )}
                    </span>
                  ))}
                </p>
              </div>

              {/* Decorative Corner Structural Hash Marker */}
              <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-0 group-hover:opacity-30 text-muted-foreground/50 transition-opacity">
                {`[init_src_mod_${i + 1}]`}
              </span>
            </div>
          ))}
        </div>

        {/* Footer Audit Signature Line */}
        <div className="mt-4 flex items-center justify-between font-mono text-[9px] text-muted-foreground/30 px-1 select-none">
          <span>strategy: source_injection</span>
          <span>compilation: zero_dependency_payload</span>
        </div>
      </div>
    </section>
  );
}
