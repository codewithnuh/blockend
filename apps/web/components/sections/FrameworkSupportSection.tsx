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
      return (
        <Terminal
          {...iconProps}
          className="w-4 h-4 text-emerald-600 dark:text-pulse-green shrink-0 transition-colors"
        />
      );
    case "bolt":
      return (
        <Zap
          {...iconProps}
          className="w-4 h-4 text-lime-600 dark:text-acid-lime shrink-0 transition-colors"
        />
      );
    case "fire":
      return (
        <Flame
          {...iconProps}
          className="w-4 h-4 text-red-600 dark:text-coral-red shrink-0 transition-colors"
        />
      );

    default:
      return (
        <Terminal
          {...iconProps}
          className="w-4 h-4 text-muted-foreground dark:text-mist shrink-0 transition-colors"
        />
      );
  }
}

export function FrameworkSupportSection() {
  return (
    <section
      id="frameworks"
      aria-labelledby="frameworks-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      <Card className="p-8 md:p-14 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite text-center space-y-10 shadow-sm transition-colors border">
        {/* Section Header */}
        <CardHeader className="p-0 flex  flex-col items-center justify-center space-y-3">
          <div>
            <Badge
              variant="outline"
              className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase border-none bg-transparent p-0 shadow-none font-normal transition-colors"
            >
              {FRAMEWORKS.badge}
            </Badge>
          </div>

          <CardTitle
            id="frameworks-heading"
            className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight leading-tight max-w-[500px] mx-auto transition-colors"
          >
            {FRAMEWORKS.headline}
          </CardTitle>

          <CardContent className="p-0 pt-1 max-w-[460px] mx-auto">
            <p className="text-[14px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
              {FRAMEWORKS.description}
            </p>
          </CardContent>
        </CardHeader>

        {/* Framework Grid */}
        <ul
          role="list"
          aria-label="Supported frameworks and runtimes"
          className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-w-2xl mx-auto font-mono text-[13px] list-none p-0 m-0"
        >
          {FRAMEWORKS.items.map((fw, index) => (
            <li
              key={fw.name}
              className={`flex items-center ${
                index === 2 ? "col-span-2 sm:col-span-1 justify-center" : ""
              }`}
            >
              <div className="w-full py-3 px-4 rounded-btn bg-surface-2 border-border dark:bg-obsidian dark:border-graphite flex items-center justify-center gap-2.5 text-muted-foreground dark:text-mist hover:text-fg dark:hover:text-paper hover:border-border/80 dark:hover:border-smoke transition-colors">
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
