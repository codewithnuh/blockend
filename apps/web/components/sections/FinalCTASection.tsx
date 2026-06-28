import Link from "next/link";
import { CopyButton } from "./CopyButton";

export function FinalCTASection() {
  return (
    <section className="relative py-28 border-t border-border bg-background text-foreground overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute inset-0 glow-radial opacity-50 dark:opacity-100 pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-6 text-center z-10">
        <h2 className="reveal font-display font-bold text-[clamp(2rem,4.5vw,3.2rem)] leading-[1.05] tracking-tight mb-6 text-foreground">
          Stop rewriting the same backend.
        </h2>

        <p
          className="reveal text-muted-foreground mb-9 text-base md:text-lg"
          style={{ transitionDelay: "0.08s" }}
        >
          Lay your first block in under a minute.
        </p>

        <div
          className="reveal flex flex-col sm:flex-row items-center justify-center gap-4"
          style={{ transitionDelay: "0.14s" }}
        >
          <CopyButton command="npx blockend-cli init" />
          <Link
            href="https://www.npmjs.com/package/blockend-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary rounded-lg px-5 py-3 text-sm focus-ring inline-block font-mono"
          >
            Read Docs →
          </Link>
        </div>
      </div>
    </section>
  );
}
