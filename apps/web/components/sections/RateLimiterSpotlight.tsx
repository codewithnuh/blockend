import { RATE_LIMITER_FEATURES } from "@/lib/data";

// Fixed: Swapped hardcoded hex values for your system variables to maintain perfect readability in both light & dark themes
const CODE_SNIPPET = `<span className="text-muted-foreground">// generated into your project — yours to edit</span>
<span className="text-primary font-semibold">import</span> express <span className="text-primary font-semibold">from</span> <span className="text-foreground font-medium">"express"</span>;
<span className="text-primary font-semibold">import</span> { rateLimit } <span className="text-primary font-semibold">from</span> <span className="text-foreground font-medium">"./rate-limiter/rateLimiter"</span>;
<span className="text-primary font-semibold">import</span> { MemoryStore } <span className="text-primary font-semibold">from</span> <span className="text-foreground font-medium">"./rate-limiter/memory-store"</span>;

<span className="text-muted-foreground">// swap MemoryStore for a Redis-backed store in prod</span>
<span className="text-primary font-semibold">const</span> store = <span className="text-primary font-semibold">new</span> MemoryStore();

<span className="text-primary font-semibold">const</span> apiLimiter = rateLimit({
  windowMs: <span className="text-primary/80">60</span> * <span className="text-primary/80">1000</span>,
  max: <span className="text-primary/80">60</span>,
  store,
});

app.<span className="text-foreground">use</span>(<span className="text-foreground font-medium">"/api/"</span>, apiLimiter);`;

export function RateLimiterSpotlight() {
  return (
    <section
      id="blocks"
      className="relative py-28 border-t border-border bg-background text-foreground"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Shipped badge */}
        <div className="reveal flex items-center gap-3 mb-4">
          <span className="w-2 h-2 rounded-full bg-ready animate-pulse" />
          <p className="font-mono text-[0.7rem] tracking-[0.15em] uppercase text-ready-foreground bg-ready/10 dark:bg-ready/20 px-2 py-0.5 rounded-full font-semibold">
            shipped
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-14 items-start">
          {/* Left — description */}
          <div className="reveal">
            <h2 className="font-display font-bold text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.1] tracking-tight mb-5">
              <code className="font-mono bg-muted px-2 py-1 rounded-md text-base text-foreground">
                rate-limiter
              </code>
            </h2>
            <p className="text-muted-foreground leading-[1.7] mb-6">
              A token-bucket rate limiter with pluggable storage. Start with an in-memory store for
              local dev, swap in Redis for production — without touching how the limiter itself
              works.
            </p>

            <ul className="space-y-3 text-sm">
              {RATE_LIMITER_FEATURES.map((feat, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="text-primary font-mono select-none">→</span>
                  <span className="text-foreground/90">{feat.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — code block */}
          <div
            className="reveal glow-border rounded-xl overflow-hidden bg-card border border-border"
            style={{ transitionDelay: "0.1s" }}
          >
            {/* File tab */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-xs font-mono text-muted-foreground">rate-limiter/setup.ts</span>
            </div>

            {/* Code */}
            <pre className="font-mono text-[0.78rem] leading-[1.8] p-5 overflow-x-auto whitespace-pre-wrap md:whitespace-pre">
              <code dangerouslySetInnerHTML={{ __html: CODE_SNIPPET }} />
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
