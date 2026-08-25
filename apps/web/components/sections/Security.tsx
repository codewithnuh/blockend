export function SecuritySection() {
  return (
    <section
      id="security"
      aria-labelledby="security-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header Group */}
      <header className="mb-12">
        <span className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase transition-colors">
          production // security_observability
        </span>

        <h2
          id="security-heading"
          className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight mt-2 transition-colors"
        >
          Production-minded from the start.
        </h2>

        <p className="text-[14px] text-muted-foreground dark:text-fog leading-relaxed mt-4 max-w-2xl transition-colors">
          Blockend is built with real-world backend systems in mind. We use established security and
          observability tools to continuously improve the reliability and quality of the project.
        </p>
      </header>

      {/* Security & Observability */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Snyk */}
        <a
          href="https://snyk.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="group"
          aria-label="Visit Snyk"
        >
          <div
            className="h-full p-6 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite shadow-sm transition-transform
  duration-200
  hover:scale-[1.01]  hover:bg-surface-2 dark:hover:bg-obsidian"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 items-center">
                <img
                  src="/logos/synk-logo.svg"
                  alt="Snyk"
                  className="h-12 w-auto max-w-[130px] object-contain"
                />
              </div>

              <span className="font-mono text-[12px] text-muted-foreground dark:text-ash transition-colors group-hover:text-fg dark:group-hover:text-paper">
                ↗
              </span>
            </div>

            <div className="mt-8">
              <div className="font-mono text-[9px] text-muted-foreground dark:text-ash uppercase tracking-wider transition-colors">
                security // dependency_analysis
              </div>

              <h3 className="text-[15px] font-medium text-fg dark:text-paper leading-snug mt-3 transition-colors">
                Security analysis without adding another abstraction layer.
              </h3>

              <p className="text-[13px] text-muted-foreground dark:text-fog leading-relaxed mt-3 transition-colors max-w-lg">
                Blockend uses Snyk to help identify vulnerable dependencies and security issues
                across the project.
              </p>

              <div className="mt-6 inline-flex items-center rounded-badge border-border dark:border-graphite bg-muted dark:bg-obsidian px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground dark:text-ash transition-colors">
                Snyk Secure Developer Program
              </div>
            </div>
          </div>
        </a>

        {/* Sentry */}
        <a
          href="https://sentry.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="group"
          aria-label="Visit Sentry"
        >
          <div
            className="h-full p-6 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite transition-transform
  duration-200
  hover:scale-[1.01] shadow-sm transition-colors hover:bg-surface-2 dark:hover:bg-obsidian"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 items-center">
                <img
                  src="/logos/sentry-logo.svg"
                  alt="Sentry"
                  className="h-7 w-auto max-w-[130px] object-contain"
                />
              </div>

              <span className="font-mono text-[12px] text-muted-foreground dark:text-ash transition-colors group-hover:text-fg dark:group-hover:text-paper">
                ↗
              </span>
            </div>

            <div className="mt-8">
              <div className="font-mono text-[9px] text-muted-foreground dark:text-ash uppercase tracking-wider transition-colors">
                observability // error_monitoring
              </div>

              <h3 className="text-[15px] font-medium text-fg dark:text-paper leading-snug mt-3 transition-colors">
                Know when something breaks.
              </h3>

              <p className="text-[13px] text-muted-foreground dark:text-fog leading-relaxed mt-3 transition-colors max-w-lg">
                Sentry gives the project a way to capture and investigate runtime errors and
                unexpected failures as Blockend evolves.
              </p>

              <div className="mt-6 inline-flex items-center rounded-badge border-border dark:border-graphite bg-muted dark:bg-obsidian px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground dark:text-ash transition-colors">
                Sentry for Good
              </div>
            </div>
          </div>
        </a>
      </div>
    </section>
  );
}
