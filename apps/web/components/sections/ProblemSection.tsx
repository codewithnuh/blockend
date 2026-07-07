import React from "react";
import { SiNodedotjs, SiBun, SiDeno, SiExpress, SiFastify, SiHono } from "react-icons/si";

interface TechItem {
  name: string;
  type: "runtime" | "framework";
  icon: React.ComponentType<{ className?: string }>;
  hoverColor: string;
}

const SUPPORTED_STACK: TechItem[] = [
  {
    name: "Node.js",
    type: "runtime",
    icon: SiNodedotjs,
    hoverColor: "group-hover:text-[#5FA04E] group-hover:drop-shadow-[0_0_10px_rgba(95,160,78,0.25)]"
  },
  {
    name: "Bun",
    type: "runtime",
    icon: SiBun,
    hoverColor:
      "group-hover:text-[#FBF0DF] group-hover:drop-shadow-[0_0_10px_rgba(251,240,223,0.25)]"
  },
  {
    name: "Deno",
    type: "runtime",
    icon: SiDeno,
    hoverColor:
      "group-hover:text-[#FFFFFF] group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.25)]"
  },
  {
    name: "Express",
    type: "framework",
    icon: SiExpress,
    hoverColor: "group-hover:text-[#EAEAEA]"
  },
  {
    name: "Fastify",
    type: "framework",
    icon: SiFastify,
    hoverColor:
      "group-hover:text-[#202020] group-hover:bg-white group-hover:p-0.5 group-hover:rounded-none"
  },
  {
    name: "Hono",
    type: "framework",
    icon: SiHono,
    hoverColor: "group-hover:text-[#E36002] group-hover:drop-shadow-[0_0_10px_rgba(227,96,2,0.25)]"
  }
];

export function ProblemSection() {
  return (
    <section
      className="relative border-t border-border bg-background py-24 text-foreground sm:py-28"
      aria-labelledby="compatibility-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          {/* Left Side — Inter (Sans) Prose Content */}
          <div className="reveal">
            <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-primary">
              stdout // compatibility
            </p>
            <h2
              id="compatibility-heading"
              className="text-balance font-sans text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl"
            >
              Engineered to run anywhere. Zero config required.
            </h2>
            <p className="mt-5 max-w-md font-sans text-sm leading-relaxed text-muted-foreground">
              Drop it straight into your architecture. Native integration across premium runtimes
              and frameworks with strict zero-overhead compilation pipelines.
            </p>
          </div>

          {/* Right Side — Technical Grid View */}
          <div className="relative">
            <div
              className="grid grid-cols-2 sm:grid-cols-3 gap-0 border-t border-l border-border/60 bg-muted/10"
              aria-hidden="true"
            >
              {SUPPORTED_STACK.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.name}
                    className="group relative flex flex-col items-center justify-center p-8 border-r border-b border-border/60 transition-all duration-200 cursor-default select-none bg-background hover:bg-muted/30"
                  >
                    {/* Brand Icon wrapper */}
                    <div
                      className={`text-muted-foreground/40 filter grayscale transition-all duration-300 transform group-hover:grayscale-0 group-hover:scale-105 mb-4 ${item.hoverColor}`}
                    >
                      <IconComponent className="w-7 h-7" />
                    </div>

                    {/* Industrial Mono Labels */}
                    <span className="font-mono text-xs text-muted-foreground/70 group-hover:text-foreground transition-colors tracking-wide">
                      {item.name.toLowerCase()}
                    </span>

                    {/* Edge Context Tags */}
                    <span className="absolute bottom-1 right-2 text-[8px] font-mono opacity-0 group-hover:opacity-30 text-muted-foreground transition-opacity">
                      {item.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
