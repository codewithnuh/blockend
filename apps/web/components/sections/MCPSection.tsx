import { MCP_SECTION } from "@/lib/landing-constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, Search, Code2, SlidersHorizontal } from "lucide-react";

interface DetailIconProps {
  icon: string;
}

function DetailIcon({ icon }: DetailIconProps) {
  const iconProps = {
    className: "w-3.5 h-3.5 text-muted-foreground dark:text-ash shrink-0 transition-colors",
    "aria-hidden": true
  };

  switch (icon) {
    case "magnifying-glass":
      return <Search {...iconProps} />;
    case "code":
      return <Code2 {...iconProps} />;
    case "sliders":
      return <SlidersHorizontal {...iconProps} />;
    default:
      return <Cpu {...iconProps} />;
  }
}

export function MCPSection() {
  return (
    <section
      id="mcp"
      aria-labelledby="mcp-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="grid lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Overview & Features */}
        <div className="lg:col-span-6 space-y-6">
          <header className="space-y-3">
            <div>
              <Badge
                variant="outline"
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-pill bg-surface-2 border-border dark:bg-carbon dark:border-graphite font-mono text-[12px] text-violet-600 dark:text-iris-violet font-normal transition-colors"
              >
                <Cpu className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {MCP_SECTION.badge}
              </Badge>
            </div>

            <h2
              id="mcp-heading"
              className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight leading-tight transition-colors"
            >
              {MCP_SECTION.headline}
            </h2>
          </header>

          <p className="text-[14px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
            {MCP_SECTION.description}
          </p>

          {/* Feature List */}
          <ul
            role="list"
            aria-label="Model Context Protocol features"
            className="space-y-3 font-mono text-[12px] text-muted-foreground dark:text-mist list-none p-0 m-0"
          >
            {MCP_SECTION.features.map((f) => (
              <li
                key={f.text}
                className="p-3 rounded-btn bg-surface border border-border dark:bg-carbon dark:border-graphite flex items-center gap-3 transition-colors"
              >
                <DetailIcon icon={f.icon} />
                <span
                  className="[&>strong]:text-fg dark:[&>strong]:text-paper [&>strong]:font-semibold"
                  dangerouslySetInnerHTML={{
                    __html: f.text.replace(/(<strong>.*?<\/strong>)/g, "$1")
                  }}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Right Column: Simulated AI Session Card */}
        <Card className="lg:col-span-6 p-6 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite shadow-sm space-y-4 font-mono text-[12px] transition-colors">
          <CardHeader className="p-0 pb-3 border-b border-border dark:border-graphite flex flex-row items-center justify-between text-muted-foreground dark:text-ash space-y-0 transition-colors">
            <CardTitle className="text-[12px] font-mono font-normal text-muted-foreground dark:text-ash transition-colors">
              {MCP_SECTION.sessionTitle}
            </CardTitle>
            <span className="text-fg dark:text-paper transition-colors">
              {MCP_SECTION.sessionPlatform}
            </span>
          </CardHeader>

          <CardContent className="p-0">
            <div className="p-4 rounded-btn bg-surface-2 border border-border dark:bg-obsidian dark:border-graphite space-y-3 transition-colors">
              {/* User Prompt */}
              <div className="text-muted-foreground dark:text-mist flex items-start gap-2 transition-colors">
                <span
                  className="text-lime-600 dark:text-acid-lime shrink-0 font-bold transition-colors"
                  aria-hidden="true"
                >
                  &gt; Prompt:
                </span>
                <span>{MCP_SECTION.sessionPrompt}</span>
              </div>

              {/* Terminal Execution Steps */}
              <div
                className="pl-4 border-l border-border dark:border-graphite text-muted-foreground dark:text-fog space-y-1.5 transition-colors"
                aria-label="Automated execution trace"
              >
                {MCP_SECTION.sessionSteps.map((step, i) => (
                  <p key={i} className={step.color}>
                    {step.muted ? (
                      <span className="text-muted-foreground/70 dark:text-ash text-[11px] transition-colors">
                        {step.text}
                      </span>
                    ) : (
                      step.text
                    )}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
