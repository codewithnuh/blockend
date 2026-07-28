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
            <span className="font-mono text-[12px] text-ash tracking-widest uppercase block">
              {GENERATED_OUTPUT.badge}
            </span>
            <h2
              id="generated-output-heading"
              className="text-2xl sm:text-[32px] font-regular text-paper tracking-compact leading-tight"
            >
              {GENERATED_OUTPUT.headline}
            </h2>
          </header>

          <p className="text-[15px] text-fog leading-relaxed">{GENERATED_OUTPUT.description}</p>

          <ul className="space-y-3 text-[13px] text-mist" role="list">
            {GENERATED_OUTPUT.checks.map((check) => (
              <li key={check} className="flex items-start gap-3">
                <Check
                  className="w-3.5 h-3.5 text-pulse-green mt-0.5 shrink-0"
                  aria-hidden="true"
                  strokeWidth={2.5}
                />
                <span
                  dangerouslySetInnerHTML={{
                    __html: check.replace(
                      /`([^`]+)`/g,
                      '<code class="font-mono text-[12px] text-mist bg-obsidian px-1 py-0.5 rounded-badge border border-graphite">$1</code>'
                    )
                  }}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Right Column: Interactive Workspace File Tree */}
        <Card className="lg:col-span-7 rounded-card bg-carbon border-graphite p-6 shadow-linear-card font-mono text-[12px] shadow-none">
          <CardHeader className="p-0 pb-4 border-b border-graphite mb-4 flex flex-row items-center justify-between text-ash space-y-0">
            <CardTitle className="text-[12px] font-mono font-normal text-ash">
              Workspace File Tree
            </CardTitle>
            <span className="text-pulse-green text-[11px]">Project Root</span>
          </CardHeader>

          <CardContent
            className="p-0 space-y-2 text-mist"
            role="tree"
            aria-label="Generated workspace directory structure"
          >
            {/* Root Folder */}
            <div role="treeitem" aria-expanded="true" className="space-y-2">
              <div className="flex items-center gap-2 text-paper">
                <Folder className="w-3.5 h-3.5 text-fog shrink-0" aria-hidden="true" />
                <span>my-backend-service/</span>
              </div>

              {/* src/ Folder */}
              <div className="pl-5 space-y-2 border-l border-graphite ml-2">
                <div role="treeitem" aria-expanded="true" className="space-y-2">
                  <div className="flex items-center gap-2 text-paper">
                    <Folder className="w-3.5 h-3.5 text-fog shrink-0" aria-hidden="true" />
                    <span>src/</span>
                  </div>

                  {/* blocks/ Folder */}
                  <div className="pl-5 space-y-2 border-l border-graphite ml-2">
                    <div role="treeitem" aria-expanded="true" className="space-y-1.5">
                      <div className="flex items-center gap-2 text-paper font-medium">
                        <FolderOpen
                          className="w-3.5 h-3.5 text-acid-lime shrink-0"
                          aria-hidden="true"
                        />
                        <span>blocks/</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.2 rounded-badge bg-obsidian border-graphite text-fog font-normal"
                        >
                          Generated Source
                        </Badge>
                      </div>

                      {/* Generated Source Files List */}
                      <ul
                        className="pl-5 space-y-1.5 border-l border-smoke ml-2 text-fog list-none p-0 m-0"
                        role="group"
                      >
                        {GENERATED_OUTPUT.files.map((file) => (
                          <li
                            key={file.name}
                            role="treeitem"
                            className="flex items-center justify-between hover:text-paper py-1 px-2 rounded-btn hover:bg-obsidian transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <FileCode
                                className="w-3.5 h-3.5 text-signal-teal shrink-0"
                                aria-hidden="true"
                              />
                              {file.name}
                            </span>
                            <span className="text-[11px] text-ash">{file.size}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Root src/ files */}
                    <div role="treeitem" className="flex items-center gap-2 text-fog pt-1">
                      <FileCode
                        className="w-3.5 h-3.5 text-signal-teal shrink-0"
                        aria-hidden="true"
                      />
                      <span>server.ts</span>
                    </div>
                  </div>
                </div>

                {/* Root project files */}
                <div role="treeitem" className="flex items-center gap-2 text-fog">
                  <FileText className="w-3.5 h-3.5 text-fog shrink-0" aria-hidden="true" />
                  <span>package.json</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
