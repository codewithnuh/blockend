import { PHILOSOPHY_CARDS } from "@/lib/data";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PhilosophySection() {
  return (
    <section
      aria-labelledby="philosophy-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header Group */}
      <header className="mb-12">
        <Badge
          variant="outline"
          className="font-mono text-[12px] text-ash tracking-widest uppercase border-none bg-transparent p-0 shadow-none font-normal block"
        >
          manifesto // architectural_design
        </Badge>
        <h2
          id="philosophy-heading"
          className="text-2xl sm:text-[32px] font-regular text-paper tracking-compact mt-2"
        >
          Frontend figured this out years ago.
        </h2>
        <p className="text-[14px] text-fog leading-relaxed mt-4 max-w-2xl">
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
            <Card className="w-full p-6 rounded-card bg-carbon border-graphite space-y-3 shadow-none flex flex-col justify-between">
              <CardHeader className="p-0 space-y-3">
                <div className="font-mono text-[9px] text-ash uppercase tracking-wider">
                  layer directive
                </div>
                <CardTitle className="text-[15px] font-medium text-paper p-0 m-0 leading-snug">
                  {card.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 m-0 flex-1">
                <p className="text-[13px] text-fog leading-relaxed">{card.body}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
