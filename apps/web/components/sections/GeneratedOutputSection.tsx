import { GENERATED_OUTPUT } from "@/lib/landing-constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Folder, FolderOpen, FileCode, FileText } from "lucide-react";

export function GeneratedOutputSection() {
  return (
    <section
      id="generated"
      aria-labelledby="generated-output-heading"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="grid lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Description and Check List */}
        <div className="lg:col-span-5 space-y-6">
          <header className="space-y-2">
            <span className="font-mono text-[12px] text-muted-foreground dark:text-ash tracking-widest uppercase block transition-colors">
              {GENERATED_OUTPUT.badge}
            </span>
            <h2
              id="generated-output-heading"
              className="text-2xl sm:text-[32px] font-normal text-fg dark:text-paper tracking-tight leading-tight transition-colors"
            >
              {GENERATED_OUTPUT.headline}
            </h2>
          </header>

          <p className="text-[15px] text-muted-foreground dark:text-fog leading-relaxed transition-colors">
            {GENERATED_OUTPUT.description}
          </p>

          <ul className="space-y-3 text-[13px] text-fg dark:text-mist" role="list">
            {GENERATED_OUTPUT.checks.map((check) => (
              <li key={check} className="flex items-start gap-3">
                <Check
                  className="w-3.5 h-3.5 text-emerald-600 dark:text-pulse-green mt-0.5 shrink-0 transition-colors"
                  aria-hidden="true"
                  strokeWidth={2.5}
                />
                <span
                  dangerouslySetInnerHTML={{
                    __html: check.replace(
                      /`([^`]+)`/g,
                      '<code class="font-mono text-[12px] text-fg dark:text-mist bg-surface-2 dark:bg-obsidian px-1 py-0.5 rounded-badge border border-border dark:border-graphite transition-colors">$1</code>'
                    )
                  }}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Right Column: Interactive Workspace File Tree */}
        <Card className="lg:col-span-7 rounded-card bg-surface border-border dark:bg-carbon dark:border-graphite p-6 font-mono text-[12px] shadow-sm transition-colors">
          <CardHeader className="p-0 pb-4 border-b border-border dark:border-graphite mb-4 flex flex-row items-center justify-between space-y-0 transition-colors">
            <CardTitle className="text-[12px] font-mono font-normal text-muted-foreground dark:text-ash transition-colors">
              Workspace File Tree
            </CardTitle>
            <span className="text-emerald-600 dark:text-pulse-green text-[11px] font-medium transition-colors">
              Project Root
            </span>
          </CardHeader>

          <CardContent
            className="p-0 space-y-2 text-fg dark:text-mist transition-colors"
            role="tree"
            aria-label="Generated workspace directory structure"
          >
            {/* Root Folder */}
            <div role="treeitem" aria-expanded="true" className="space-y-2">
              <div className="flex items-center gap-2 text-fg dark:text-paper font-medium transition-colors">
                <Folder
                  className="w-3.5 h-3.5 text-muted-foreground dark:text-fog shrink-0 transition-colors"
                  aria-hidden="true"
                />
                <span>my-backend-service/</span>
              </div>

              {/* src/ Folder */}
              <div className="pl-5 space-y-2 border-l border-border dark:border-graphite ml-2 transition-colors">
                <div role="treeitem" aria-expanded="true" className="space-y-2">
                  <div className="flex items-center gap-2 text-fg dark:text-paper font-medium transition-colors">
                    <Folder
                      className="w-3.5 h-3.5 text-muted-foreground dark:text-fog shrink-0 transition-colors"
                      aria-hidden="true"
                    />
                    <span>src/</span>
                  </div>

                  {/* blocks/ Folder */}
                  <div className="pl-5 space-y-2 border-l border-border dark:border-graphite ml-2 transition-colors">
                    <div role="treeitem" aria-expanded="true" className="space-y-1.5">
                      <div className="flex items-center gap-2 text-fg dark:text-paper font-medium transition-colors">
                        <FolderOpen
                          className="w-3.5 h-3.5 text-lime-600 dark:text-acid-lime shrink-0 transition-colors"
                          aria-hidden="true"
                        />
                        <span>blocks/</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.2 rounded-badge bg-surface-2 dark:bg-obsidian border-border dark:border-graphite text-muted-foreground dark:text-fog font-normal transition-colors"
                        >
                          Generated Source
                        </Badge>
                      </div>

                      {/* Generated Source Files List */}
                      <ul
                        className="pl-5 space-y-1.5 border-l border-border dark:border-smoke ml-2 text-muted-foreground dark:text-fog list-none p-0 m-0 transition-colors"
                        role="group"
                      >
                        {GENERATED_OUTPUT.files.map((file) => (
                          <li
                            key={file.name}
                            role="treeitem"
                            className="flex items-center justify-between hover:text-fg dark:hover:text-paper py-1 px-2 rounded-btn hover:bg-surface-2 dark:hover:bg-obsidian transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <FileCode
                                className="w-3.5 h-3.5 text-teal-600 dark:text-signal-teal shrink-0 transition-colors"
                                aria-hidden="true"
                              />
                              {file.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground dark:text-ash transition-colors">
                              {file.size}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Root src/ files */}
                    <div
                      role="treeitem"
                      className="flex items-center gap-2 text-muted-foreground dark:text-fog pt-1 transition-colors"
                    >
                      <FileCode
                        className="w-3.5 h-3.5 text-teal-600 dark:text-signal-teal shrink-0 transition-colors"
                        aria-hidden="true"
                      />
                      <span>server.ts</span>
                    </div>
                  </div>

                  {/* Root project files */}
                  <div
                    role="treeitem"
                    className="flex items-center gap-2 text-muted-foreground dark:text-fog transition-colors"
                  >
                    <FileText
                      className="w-3.5 h-3.5 text-muted-foreground dark:text-fog shrink-0 transition-colors"
                      aria-hidden="true"
                    />
                    <span>package.json</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
