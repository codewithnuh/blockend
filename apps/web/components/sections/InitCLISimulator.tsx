"use client";

import { useState } from "react";
import { FRAMEWORK_OPTIONS } from "@/lib/data";

type Phase = "idle" | "scanning" | "framework" | "alias" | "redis" | "writing" | "done";

interface ScanLog {
  text: string;
  type: "success" | "active" | "muted";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function InitCLISimulator() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [selectedFramework, setSelectedFramework] = useState("express");
  const [alias, setAlias] = useState("@/blocks");
  const [configPreview, setConfigPreview] = useState("");

  const runScanPhase = async () => {
    setPhase("scanning");
    setScanLogs([]);

    // 1. Project structure
    setScanLogs([{ text: "◌ Scanning project structure...", type: "active" }]);
    await sleep(600);
    setScanLogs([{ text: "✓ Project structure detected", type: "success" }]);

    // 2. Framework signals
    setScanLogs((prev) => [...prev, { text: "◌ Analyzing framework signals...", type: "active" }]);
    await sleep(500);
    setScanLogs((prev) => [
      ...prev.slice(0, -1),
      { text: `✓ Detected express environment`, type: "success" }
    ]);

    // 3. Import strategy map
    setScanLogs((prev) => [...prev, { text: "◌ Resolving alias mappings...", type: "active" }]);
    await sleep(400);
    setScanLogs((prev) => [
      ...prev.slice(0, -1),
      { text: "✓ Import strategy mapped", type: "success" },
      { text: "System: express · ts · aliases=1", type: "muted" }
    ]);

    setPhase("framework");
  };

  const confirmFramework = () => {
    setPhase("alias");
  };

  const confirmAlias = () => {
    setPhase("redis");
  };

  const confirmRedis = async (val: boolean) => {
    setPhase("writing");
    await sleep(800);

    const payload = {
      $schema: "https://blockend.dev/schema.json",
      environment: selectedFramework,
      language: "typescript",
      includeRedis: val,
      aliases: { blocks: alias },
      paths: { blocks: `./src/${alias.replace("@/", "")}` }
    };

    setConfigPreview(JSON.stringify(payload, null, 2));
    setPhase("done");
  };

  const reset = () => {
    setPhase("idle");
    setScanLogs([]);
    setSelectedFramework("express");
    setAlias("@/blocks");
    setConfigPreview("");
  };

  return (
    <section className="relative py-28 border-t border-border bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="reveal max-w-xl mb-12">
          <p className="font-mono text-[0.7rem] tracking-[0.15em] uppercase text-primary mb-4">
            try it interactively
          </p>
          <h2 className="font-display font-bold text-[clamp(1.8rem,3.2vw,2.6rem)] leading-[1.1] tracking-tight mb-4">
            See what init actually does.
          </h2>
          <p className="text-muted-foreground leading-[1.7]">
            Run through the init wizard right here. It mirrors the real{" "}
            <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-sm">
              blockend-cli init
            </code>{" "}
            flow — framework detection, alias config, Redis opt-in — and outputs a live preview of
            your{" "}
            <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-sm">
              blockend.json
            </code>
            .
          </p>
        </div>

        <div className="reveal grid lg:grid-cols-2 gap-10 items-start">
          {/* Left — wizard terminal */}
          <div className="terminal-window rounded-xl overflow-hidden border border-border bg-card">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <span className="terminal-dot bg-[#FF5F56]" />
              <span className="terminal-dot bg-[#FFBD2E]" />
              <span className="terminal-dot bg-[#27C93F]" />
              <span className="ml-3 text-xs font-mono text-muted-foreground">
                ~/my-api — blockend-cli init
              </span>
            </div>

            <div className="p-5 space-y-4 min-h-[440px] flex flex-col justify-between">
              <div className="space-y-3">
                {/* ASCII CLI Banner */}
                <pre className="font-mono text-[0.55rem] md:text-[0.62rem] leading-none text-primary/80 select-none overflow-x-auto whitespace-pre pb-2">
                  {`
                ██████╗ ██╗       ██████╗  ██████╗██╗  ██╗███████╗███╗   ██╗██████╗
                ██╔══██╗██║      ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝████╗  ██║██╔══██╗
                ██████╔╝██║      ██║   ██║██║     █████╔╝ █████╗  ██╔██╗ ██║██║  ██║
                ██╔══██╗██║      ██║   ██║██║     ██╔═██╗ ██╔══╝  ██║╚██╗██║██║  ██║
                ██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗███████╗██║ ╚████║██████╔╝
                ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═════╝
                `}
                </pre>

                <p className="font-mono text-xs text-primary font-semibold border-b border-border pb-2">
                  ┌ Blockend · Intelligent Backend Blocks Setup
                </p>

                {/* Simulated Clack Outputs */}
                <div className="space-y-1.5 font-mono text-[0.8rem]">
                  {scanLogs.map((log, index) => (
                    <div
                      key={index}
                      className={
                        log.type === "success"
                          ? "text-ready"
                          : log.type === "muted"
                            ? "text-muted-foreground text-[0.75rem] pl-4"
                            : "text-primary animate-pulse"
                      }
                    >
                      {log.type === "muted" ? "" : "│  "}
                      {log.text}
                    </div>
                  ))}
                </div>

                {/* Interaction Phases */}
                {phase === "framework" && (
                  <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/30">
                    <p className="font-mono text-[0.82rem] text-foreground font-medium">
                      ? Confirm framework environment
                    </p>
                    <div className="space-y-1.5 max-w-xs">
                      {FRAMEWORK_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedFramework(opt.value)}
                          className={`w-full text-left font-mono text-[0.8rem] px-3 py-1.5 rounded-md border transition-colors ${
                            selectedFramework === opt.value
                              ? "border-primary text-primary bg-primary/10 font-semibold"
                              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                          }`}
                        >
                          {selectedFramework === opt.value ? "❯ " : "  "}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {phase === "alias" && (
                  <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/30">
                    <p className="font-mono text-[0.82rem] text-foreground font-medium">
                      ? Configure blocks import alias
                    </p>
                    <input
                      type="text"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      className="max-w-xs w-full font-mono text-[0.8rem] bg-muted/50 border border-border rounded-md px-3 py-1.5 text-foreground focus:border-primary outline-none transition-colors"
                      placeholder="@/blocks"
                    />
                  </div>
                )}

                {phase === "redis" && (
                  <div className="space-y-3 pt-2 pl-4 border-l-2 border-primary/30">
                    <p className="font-mono text-[0.82rem] text-foreground font-medium max-w-sm">
                      ? Redis detected. Enable Redis-backed block variants automatically?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmRedis(true)}
                        className="rounded-md bg-primary text-primary-foreground font-mono text-xs px-4 py-1.5 font-semibold hover:opacity-90"
                      >
                        (Y)es
                      </button>
                      <button
                        onClick={() => confirmRedis(false)}
                        className="rounded-md border border-border bg-transparent font-mono text-xs px-4 py-1.5 hover:bg-muted"
                      >
                        (N)o
                      </button>
                    </div>
                  </div>
                )}

                {phase === "writing" && (
                  <div className="pl-4 font-mono text-[0.82rem] text-primary animate-pulse">
                    ◌ Finalizing configuration...
                  </div>
                )}

                {phase === "done" && (
                  <div className="space-y-2 pt-1 font-mono text-[0.82rem]">
                    <p className="text-ready">✓ blockend.json ready</p>
                    <p className="text-foreground font-semibold border-t border-border pt-2 text-xs">
                      └ Blockend initialized successfully. Run: npx blockend add &lt;block&gt;
                    </p>
                  </div>
                )}
              </div>

              {/* Action Trigger Row */}
              <div className="pt-4 border-t border-border/40 flex justify-between items-center">
                {phase === "idle" && (
                  <div className="flex items-center justify-between w-full">
                    <div className="font-mono text-[0.82rem] text-muted-foreground">
                      <span className="text-primary">$</span> npx blockend-cli init
                      <span className="caret ml-1" />
                    </div>
                    <button
                      onClick={runScanPhase}
                      className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-xs font-mono font-semibold transition-transform active:scale-95"
                    >
                      Run init →
                    </button>
                  </div>
                )}

                {["framework", "alias"].includes(phase) && (
                  <button
                    onClick={phase === "framework" ? confirmFramework : confirmAlias}
                    className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-xs font-mono font-semibold ml-4"
                  >
                    Next Step →
                  </button>
                )}

                {phase === "done" && (
                  <button
                    onClick={reset}
                    className="rounded-md border border-border text-muted-foreground hover:text-foreground px-3 py-1.5 text-xs font-mono flex items-center gap-1 ml-4"
                  >
                    ↺ Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right — config json preview file */}
          <div className="glow-border rounded-xl overflow-hidden bg-card border border-border">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  phase === "done" ? "bg-ready" : "bg-border"
                }`}
              />
              <span className="text-xs font-mono text-muted-foreground">blockend.json</span>
            </div>

            <pre className="font-mono text-[0.78rem] leading-[1.8] p-5 min-h-[440px] overflow-x-auto whitespace-pre-wrap">
              {configPreview ? (
                <code className="text-foreground">{configPreview}</code>
              ) : (
                <code className="text-muted-foreground/70">
                  {`// Runtime schema file configuration\n// live preview shifts here after completing workflow setup.`}
                </code>
              )}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
