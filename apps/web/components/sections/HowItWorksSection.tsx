import { HOW_IT_WORKS } from "@/lib/landing-constants";
import { CommandBlock } from "./CommandBlock";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export function HowItWorksSection() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="max-w-300 mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header Group */}
      <header className="mb-12">
        <span className="font-mono text-[12px] text-ash tracking-widest uppercase block">
          {HOW_IT_WORKS.badge}
        </span>
        <h2
          id="how-it-works-heading"
          className="text-2xl sm:text-[32px] font-regular text-paper tracking-compact mt-2"
        >
          {HOW_IT_WORKS.headline}
        </h2>
      </header>

      {/* Ordered Steps Sequence */}
      <ol
        aria-label="How it works workflow steps"
        className="grid md:grid-cols-3 gap-6 list-none p-0 m-0"
      >
        {HOW_IT_WORKS.steps.map((step) => (
          <li key={step.step} className="flex">
            <Card className="w-full p-6 rounded-card bg-carbon border-graphite space-y-4 shadow-none flex flex-col justify-between">
              <CardHeader className="p-0 space-y-2">
                <span
                  aria-label={`Step ${step.step}`}
                  className="font-mono text-[12px] text-ash block"
                >
                  {step.step}
                </span>
                <CardTitle className="text-[17px] font-medium text-paper p-0 m-0 leading-snug">
                  {step.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 m-0 flex-1">
                <p className="text-[13px] text-fog leading-relaxed">{step.description}</p>
              </CardContent>

              <CardFooter className="p-0 py-3 m-0">
                <CommandBlock command={step.command} className="w-full" />
              </CardFooter>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
