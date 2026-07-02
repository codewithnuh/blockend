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
      <div className="max-w-6xl mx-auto px-6 lg:px-12">
        {/* Header Component Block */}
        <div className="reveal max-w-xl mb-12">
          <p className="font-mono text-[0.7rem] tracking-[0.15em] uppercase text-primary mb-4 select-none">
            try it interactively
          </p>
          <h2 className="font-display font-bold text-[clamp(1.8rem,3.2vw,2.6rem)] leading-[1.1] tracking-tight mb-4">
            See what init actually does.
          </h2>
          <p className="font-sans text-muted-foreground text-sm leading-[1.7]">
            Run through the init wizard right here. It mirrors the real{" "}
            <code className="font-mono text-foreground bg-muted border border-border/40 px-1.5 py-0.5 rounded-none text-[0.9em]">
              blockend-cli init
            </code>{" "}
            flow — framework detection, alias config, Redis opt-in — and outputs a live preview of
            your{" "}
            <code className="font-mono text-foreground bg-muted border border-border/40 px-1.5 py-0.5 rounded-none text-[0.9em]">
              blockend.json
            </code>
            .
          </p>
        </div>

        <div className="reveal grid lg:grid-cols-2 gap-10 items-start">
          {/* Left Column — Wizard Terminal Simulator */}
          <div className="terminal-window rounded-none overflow-hidden border border-border bg-card">
            {/* Title Bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 select-none">
              <span className="w-2.5 h-2.5 bg-border rounded-none" />
              <span className="w-2.5 h-2.5 bg-border rounded-none" />
              <span className="w-2.5 h-2.5 bg-border rounded-none" />
              <span className="ml-3 text-xs font-mono text-muted-foreground/60">
                ~/my-api — blockend-cli init
              </span>
            </div>

            <div className="p-5 space-y-4 min-h-[440px] flex flex-col justify-between">
              <div className="space-y-3">
                {/* ASCII CLI Banner */}
                <pre className="font-mono text-[0.55rem] md:text-[0.62rem] leading-none text-primary/80 select-none overflow-x-auto whitespace-pre pb-2 scrollbar-none">
                  {`
 ██████╗ ██║        ██████╗  ██████╗██╗  ██╗███████╗███╗   ██╗██████╗
 ██╔══██╗██║       ██╔═══██╗██╔════╝██║ ██╔╝██╔════╝████╗  ██║██╔══██╗
 ██████╔╝██║       ██║   ██║██║     █████╔╝ █████╗  ██╔██╗ ██║██║  ██║
 ██╔══██╗██║       ██║   ██║██║     ██╔═██╗ ██╔══╝  ██║╚██╗██║██║  ██║
 ██████╔╝███████╗╚██████╔╝╚██████╗██║  ██╗███████╗██║ ╚████║██████╔╝
 ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═════╝
                  `}
                </pre>

                <p className="font-mono text-xs text-primary font-bold border-b border-border pb-2 select-none">
                  ┌ Blockend · Intelligent Backend Blocks Setup
                </p>

                {/* Simulated Clack Engine Outputs */}
                <div className="space-y-1.5 font-mono text-[0.8rem]">
                  {scanLogs.map((log, index) => (
                    <div
                      key={index}
                      className={
                        log.type === "success"
                          ? "text-emerald-400"
                          : log.type === "muted"
                            ? "text-muted-foreground/50 text-[0.75rem] pl-4"
                            : "text-primary animate-pulse"
                      }
                    >
                      {log.type === "muted" ? "" : "│  "}
                      {log.text}
                    </div>
                  ))}
                </div>

                {/* Interaction Pipeline Phases */}
                {phase === "framework" && (
                  <div className="space-y-3 pt-2 pl-4 border-l border-primary/30">
                    <p className="font-mono text-[0.82rem] text-foreground font-medium">
                      ? Confirm framework environment
                    </p>
                    <div className="space-y-1.5 max-w-xs">
                      {FRAMEWORK_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSelectedFramework(opt.value)}
                          className={`w-full text-left font-mono text-[0.8rem] px-3 py-1.5 rounded-none border transition-all ${
                            selectedFramework === opt.value
                              ? "border-primary text-primary bg-primary/5 font-bold"
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
                  <div className="space-y-3 pt-2 pl-4 border-l border-primary/30">
                    <p className="font-mono text-[0.82rem] text-foreground font-medium">
                      ? Configure blocks import alias
                    </p>
                    <input
                      type="text"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      className="max-w-xs w-full font-mono text-[0.8rem] bg-muted/50 border border-border rounded-none px-3 py-1.5 text-foreground focus:border-primary outline-none transition-colors"
                      placeholder="@/blocks"
                    />
                  </div>
                )}

                {phase === "redis" && (
                  <div className="space-y-3 pt-2 pl-4 border-l border-primary/30">
                    <p className="font-mono text-[0.82rem] text-foreground font-medium max-w-sm">
                      ? Redis detected. Enable Redis-backed block variants automatically?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmRedis(true)}
                        className="rounded-none bg-primary text-primary-foreground font-mono text-xs px-4 py-1.5 font-semibold transition-opacity hover:opacity-90 active:scale-[0.98]"
                      >
                        (Y)es
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRedis(false)}
                        className="rounded-none border border-border bg-background font-mono text-xs px-4 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-[0.98]"
                      >
                        (N)o
                      </button>
                    </div>
                  </div>
                )}

                {phase === "writing" && (
                  <div className="pl-4 font-mono text-[0.82rem] text-primary animate-pulse">
                    座 Finalizing configuration...
                  </div>
                )}

                {phase === "done" && (
                  <div className="space-y-2 pt-1 font-mono text-[0.82rem]">
                    <p className="text-emerald-400 font-semibold">✓ blockend.json ready</p>
                    <p className="text-foreground font-medium border-t border-border pt-2 text-xs">
                      └ Blockend initialized successfully. Run:{" "}
                      <span className="text-primary">npx blockend add &lt;block&gt;</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Action Active Control Row */}
              <div className="pt-4 border-t border-border/40 flex justify-between items-center select-none">
                {phase === "idle" && (
                  <div className="flex items-center justify-between w-full">
                    <div className="font-mono text-[0.82rem] text-muted-foreground/60">
                      <span className="text-primary">$</span> npx blockend-cli init
                      <span className="animate-pulse bg-primary inline-block w-1.5 h-3.5 ml-1.5 align-middle" />
                    </div>
                    <button
                      type="button"
                      onClick={runScanPhase}
                      className="rounded-none bg-primary text-primary-foreground px-4 py-2 text-xs font-mono font-bold tracking-wide uppercase transition-all active:scale-[0.98]"
                    >
                      Run init →
                    </button>
                  </div>
                )}

                {["framework", "alias"].includes(phase) && (
                  <button
                    type="button"
                    onClick={phase === "framework" ? confirmFramework : confirmAlias}
                    className="rounded-none bg-primary text-primary-foreground px-4 py-1.5 text-xs font-mono font-bold tracking-wide uppercase ml-auto active:scale-[0.98]"
                  >
                    Next Step →
                  </button>
                )}

                {phase === "done" && (
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-none border border-border text-muted-foreground hover:bg-muted hover:text-foreground px-3 py-1.5 text-xs font-mono flex items-center gap-1 ml-auto transition-all active:scale-[0.98]"
                  >
                    ↺ Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column — Static Config Preview Context Node */}
          <div className="rounded-none overflow-hidden bg-card border border-border">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 select-none">
              <span
                className={`w-1.5 h-1.5 rounded-none transition-colors ${
                  phase === "done" ? "bg-emerald-400" : "bg-border"
                }`}
              />
              <span className="text-xs font-mono text-muted-foreground/60">blockend.json</span>
            </div>

            <pre className="font-mono text-[0.78rem] leading-[1.8] p-5 min-h-[440px] overflow-x-auto whitespace-pre-wrap selection:bg-primary/20">
              {configPreview ? (
                <code className="text-foreground font-mono">{configPreview}</code>
              ) : (
                <code className="text-muted-foreground/40 font-mono italic">
                  {`// Runtime configuration file generation\n// Live code payload dynamically shifts here after configuration processing.`}
                </code>
              )}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
