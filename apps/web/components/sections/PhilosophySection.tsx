import { PHILOSOPHY_CARDS } from "@/lib/data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PhilosophySection() {
  return (
    <section
      id="philosophy"
      aria-labelledby="philosophy-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header Group */}
      <header className="mb-12">
        <Badge
          variant="outline"
          className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase border-none bg-transparent p-0 shadow-none font-normal block transition-colors"
        >
          manifesto // architectural_design
        </Badge>
        <h2
          id="philosophy-heading"
          className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight mt-2 transition-colors"
        >
          Frontend figured this out years ago.
        </h2>
        <p className="text-[14px] text-muted-foreground dark:text-fog leading-relaxed mt-4 max-w-2xl transition-colors">
          shadcn/ui proved that developers don&apos;t want another dependency—they want raw source
          control in their own repository to wrap their custom business logic around. Backend
          infrastructure deserves the exact same approach. No locked black boxes.
        </p>
      </header>

      {/* Grid of Philosophy Cards */}
      <ul
        role="list"
        aria-label="Architectural philosophy principles"
        className="grid md:grid-cols-3 gap-4 list-none p-0 m-0"
      >
        {PHILOSOPHY_CARDS.map((card) => (
          <li key={card.title} className="flex">
            <Card className="w-full p-6 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite space-y-3 shadow-sm flex flex-col justify-between transition-colors">
              <CardHeader className="p-0 space-y-3">
                <div className="font-mono text-[9px] text-muted-foreground dark:text-ash uppercase tracking-wider transition-colors">
                  layer directive
                </div>
                <CardTitle className="text-[15px] font-medium text-fg dark:text-paper p-0 m-0 leading-snug transition-colors">
                  {card.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 m-0 flex-1">
                <p className="text-[13px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
                  {card.body}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
