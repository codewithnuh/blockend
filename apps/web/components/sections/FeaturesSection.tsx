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
      aria-labelledby="features-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header Group */}
      <header className="mb-12">
        <span className="font-mono text-[12px] text-ash tracking-widest uppercase block">
          {FEATURES.badge}
        </span>
        <h2
          id="features-heading"
          className="text-2xl sm:text-[32px] font-regular text-paper tracking-compact mt-2"
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
            <Card className="w-full p-5 rounded-card bg-carbon border-graphite space-y-3 shadow-none flex flex-col justify-between">
              <CardHeader className="p-0 space-y-3">
                <div
                  aria-hidden="true"
                  className="w-8 h-8 rounded-btn bg-obsidian border border-graphite flex items-center justify-center text-paper shrink-0"
                >
                  <FeatureIcon icon={item.icon} />
                </div>
                <CardTitle className="text-[15px] font-medium text-paper p-0 m-0 leading-snug">
                  {item.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 m-0 flex-1">
                <p className="text-[13px] text-fog leading-relaxed">{item.description}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
