import { FEATURES } from "@/lib/landing-constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Code2, Boxes, Zap, ShieldCheck, Eye, Server, Sparkles } from "lucide-react";

interface FeatureIconProps {
  icon: string;
}

function FeatureIcon({ icon }: FeatureIconProps) {
  const iconProps = {
    className: "w-4 h-4 shrink-0",
    "aria-hidden": true
  };

  switch (icon) {
    case "code":
      return <Code2 {...iconProps} />;
    case "cubes":
      return <Boxes {...iconProps} />;
    case "feather-pointed":
      return <Zap {...iconProps} />;
    case "shield-halved":
      return <ShieldCheck {...iconProps} />;
    case "glasses":
      return <Eye {...iconProps} />;
    case "server":
      return <Server {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
}

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header Group */}
      <header className="mb-12">
        <span className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase block transition-colors">
          {FEATURES.badge}
        </span>
        <h2
          id="features-heading"
          className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight mt-2 transition-colors"
        >
          {FEATURES.headline}
        </h2>
      </header>

      {/* Grid List of Features */}
      <ul
        role="list"
        aria-label="Key features and capabilities"
        className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0"
      >
        {FEATURES.items.map((item) => (
          <li key={item.title} className="flex">
            <Card className="w-full p-5 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite space-y-3 shadow-sm transition-colors flex flex-col justify-between">
              <CardHeader className="p-0 space-y-3">
                <div
                  aria-hidden="true"
                  className="w-8 h-8 rounded-btn bg-surface-2 border-border dark:bg-obsidian dark:border-graphite flex items-center justify-center text-fg dark:text-paper shrink-0 transition-colors"
                >
                  <FeatureIcon icon={item.icon} />
                </div>
                <CardTitle className="text-[15px] font-medium text-fg dark:text-paper p-0 m-0 leading-snug transition-colors">
                  {item.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 m-0 flex-1">
                <p className="text-[13px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
