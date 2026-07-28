import { PROBLEM_SECTION } from "@/lib/landing-constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RotateCcw, PackageOpen, Bug, GitMerge, AlertCircle } from "lucide-react";

interface ProblemIconProps {
  icon: string;
}

function ProblemIcon({ icon }: ProblemIconProps) {
  const iconProps = {
    className: "w-4 h-4 shrink-0",
    "aria-hidden": true
  };

  switch (icon) {
    case "rotate-left":
      return <RotateCcw {...iconProps} />;
    case "box-open":
      return <PackageOpen {...iconProps} />;
    case "bug":
      return <Bug {...iconProps} />;
    case "code-merge":
      return <GitMerge {...iconProps} />;
    default:
      return <AlertCircle {...iconProps} />;
  }
}

export function ProblemSection() {
  return (
    <section
      id="problem"
      aria-labelledby="problem-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Section Header Group */}
      <header className="mb-12">
        <span className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase block transition-colors">
          {PROBLEM_SECTION.badge}
        </span>
        <h2
          id="problem-heading"
          className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight mt-2 transition-colors"
        >
          {PROBLEM_SECTION.headline}
        </h2>
      </header>

      {/* Grid List of Problem Cards */}
      <ul
        role="list"
        aria-label="Common backend development challenges"
        className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0"
      >
        {PROBLEM_SECTION.items.map((item) => (
          <li key={item.title}>
            <Card className="h-full p-5 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite space-y-3 shadow-sm transition-colors">
              <CardHeader className="p-0 space-y-3">
                <div
                  aria-hidden="true"
                  className="w-8 h-8 rounded-btn bg-surface-2 border-border dark:bg-obsidian dark:border-graphite flex items-center justify-center text-muted-foreground dark:text-fog shrink-0 transition-colors"
                >
                  <ProblemIcon icon={item.icon} />
                </div>
                <CardTitle className="text-[15px] font-medium text-fg dark:text-paper p-0 m-0 leading-snug transition-colors">
                  {item.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 m-0">
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
