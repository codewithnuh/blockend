"use client";

import { FAQ_SECTION } from "@/lib/landing-constants";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from "@/components/ui/accordion";

export function FAQSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header */}
      <header className="mb-12 text-center">
        <div>
          <Badge
            variant="outline"
            className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase border-none bg-transparent p-0 shadow-none font-normal inline-block transition-colors"
          >
            {FAQ_SECTION.badge}
          </Badge>
        </div>
        <h2
          id="faq-heading"
          className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight mt-2 transition-colors"
        >
          {FAQ_SECTION.headline}
        </h2>
      </header>

      {/* Accessible Accordion Group */}
      <Accordion type="single" collapsible className="space-y-3 w-full border-none">
        {FAQ_SECTION.items.map((item, i) => (
          <AccordionItem
            key={i}
            value={`faq-item-${i}`}
            className="rounded-card bg-surface border border-border dark:bg-carbon dark:border-graphite overflow-hidden px-0 transition-colors shadow-sm"
          >
            <AccordionTrigger className="w-full p-4 text-left font-medium text-fg dark:text-paper text-[14px] hover:bg-surface-2 dark:hover:bg-obsidian hover:no-underline transition-colors [&>svg]:text-muted-foreground dark:[&>svg]:text-ash [&>svg]:w-3 [&>svg]:h-3 [&>svg]:shrink-0 [&>svg]:ml-4">
              <span>{item.question}</span>
            </AccordionTrigger>

            <AccordionContent className="px-4 pb-14 pt-0 text-[13px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
