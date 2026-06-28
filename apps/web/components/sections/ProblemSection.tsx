import { BLOCK_CHIPS } from "@/lib/data";

const chipDescriptions: Record<string, string> = {
  "Rate Limiting": "Token bucket, fixed/sliding window, Redis-backed",
  "Error Handling": "Structured errors, middleware, Express/Fastify adapters",
  Logging: "Structured JSON, request ID, levels, transports",
  Validation: "Zod schemas, request/response validation, DTOs",
  Pagination: "Cursor & offset, link headers, database-agnostic"
};

export function ProblemSection() {
  return (
    <section
      className="relative border-t border-border bg-background py-24 text-foreground sm:py-28"
      aria-labelledby="problem-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          {/* Left — copy */}
          <div className="reveal">
            <p className="mb-4 font-mono text-xs font-medium uppercase tracking-widest text-primary">
              The problem
            </p>
            <h2
              id="problem-heading"
              className="text-balance font-sans text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl"
            >
              Every backend rebuilds the same five things.
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
              You either adopt a third-party package and lock into its opinions, or you rewrite the
              same rate limiters, error handlers, loggers, validation, and pagination from scratch
              on every project.
            </p>
          </div>

          {/* Right — block chips */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
            {BLOCK_CHIPS.map((chip, i) => (
              <ChipCard
                key={chip.label}
                chip={chip}
                description={chipDescriptions[chip.label]}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Sub-component ───────────────────────────────────────────────── */

function ChipCard({
  chip,
  description,
  index
}: {
  chip: { label: string; available: boolean };
  description?: string;
  index: number;
}) {
  return (
    <div
      className="reveal glow-card rounded-xl p-4 text-center"
      style={{ transitionDelay: `${index * 0.04}s` }}
      title={description ?? ""}
    >
      <span className="inline-flex items-center justify-center gap-1.5 font-mono text-sm">
        {chip.available ? (
          <>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-foreground">{chip.label}</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">{chip.label}</span>
            <span className="ml-0.5 font-mono text-[0.6rem] text-muted-foreground/50">soon</span>
          </>
        )}
      </span>
    </div>
  );
}
