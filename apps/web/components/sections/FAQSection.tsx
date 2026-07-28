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
            className="font-mono text-[12px] text-ash tracking-widest uppercase border-none bg-transparent p-0 shadow-none font-normal inline-block"
          >
            {FAQ_SECTION.badge}
          </Badge>
        </div>
        <h2
          id="faq-heading"
          className="text-2xl sm:text-[32px] font-regular text-paper tracking-compact mt-2"
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
            className="rounded-card bg-carbon border border-graphite overflow-hidden px-0"
          >
            <AccordionTrigger className="w-full p-4 text-left font-medium text-paper text-[14px] hover:bg-obsidian hover:no-underline transition-colors [&>svg]:text-ash [&>svg]:w-3 [&>svg]:h-3 [&>svg]:shrink-0 [&>svg]:ml-4">
              <span>{item.question}</span>
            </AccordionTrigger>

            <AccordionContent className="px-4 pb-14 pt-0 text-[13px] text-fog leading-relaxed">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
