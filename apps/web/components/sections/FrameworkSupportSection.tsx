import { FRAMEWORKS } from "@/lib/landing-constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Flame, Terminal, Layers } from "lucide-react";

interface FrameworkIconProps {
  icon: string;
}

function FrameworkIcon({ icon }: FrameworkIconProps) {
  const iconProps = {
    className: "w-4 h-4 shrink-0",
    "aria-hidden": true
  };

  switch (icon) {
    case "node-js":
      return <Terminal {...iconProps} className="w-4 h-4 text-pulse-green shrink-0" />;
    case "bolt":
      return <Zap {...iconProps} className="w-4 h-4 text-acid-lime shrink-0" />;
    case "fire":
      return <Flame {...iconProps} className="w-4 h-4 text-coral-red shrink-0" />;
    case "n":
      return <Layers {...iconProps} className="w-4 h-4 text-paper shrink-0" />;
    default:
      return <Terminal {...iconProps} className="w-4 h-4 text-mist shrink-0" />;
  }
}

export function FrameworkSupportSection() {
  return (
    <section
      id="frameworks"
      aria-labelledby="frameworks-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      <Card className="p-8 md:p-14 rounded-card bg-carbon border-graphite text-center space-y-10 shadow-none border">
        {/* Section Header */}
        <CardHeader className="p-0 flex flex-col items-center justify-center space-y-3">
          <div>
            <Badge
              variant="outline"
              className="font-mono text-[12px] text-ash tracking-widest uppercase border-none bg-transparent p-0 shadow-none font-normal"
            >
              {FRAMEWORKS.badge}
            </Badge>
          </div>

          <CardTitle
            id="frameworks-heading"
            className="text-2xl sm:text-[32px] font-regular text-paper tracking-compact leading-tight max-w-[500px] mx-auto"
          >
            {FRAMEWORKS.headline}
          </CardTitle>

          <CardContent className="p-0 pt-1 max-w-[460px] mx-auto">
            <p className="text-[14px] text-fog leading-relaxed">{FRAMEWORKS.description}</p>
          </CardContent>
        </CardHeader>

        {/* Framework Grid */}
        <ul
          role="list"
          aria-label="Supported frameworks and runtimes"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-2xl mx-auto font-mono text-[13px] list-none p-0 m-0"
        >
          {FRAMEWORKS.items.map((fw) => (
            <li key={fw.name} className="flex">
              <div className="w-full py-3 px-4 rounded-btn bg-obsidian border border-graphite flex items-center justify-center gap-2.5 text-mist hover:text-paper hover:border-smoke transition-colors">
                <FrameworkIcon icon={fw.icon} />
                <span className="whitespace-nowrap">{fw.name}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
