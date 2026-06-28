"use client";

import { useState, useEffect, useRef } from "react";

interface TerminalLine {
  type: "cmd" | "out" | "tree";
  text: string;
}

const SCRIPT: TerminalLine[] = [
  { type: "cmd", text: "$ npx blockend-cli init" },
  { type: "out", text: "█ Scanning project structure..." },
  { type: "out", text: "✓ Project structure detected" },
  { type: "out", text: "█ Analyzing framework signals..." },
  { type: "out", text: "✓ Detected express environment" },
  { type: "out", text: "█ Resolving alias mappings..." },
  { type: "out", text: "✓ Import strategy mapped" },
  { type: "out", text: "System: express · ts · aliases=1" },
  { type: "out", text: "? Confirm framework environment (Express.js)" },
  { type: "out", text: "✓ Framework confirmed" },
  { type: "out", text: "? Configure blocks import alias (./src/blocks)" },
  { type: "out", text: "✓ Alias set" },
  { type: "out", text: "? Redis detected. Enable Redis-backed variants? (Y/n)" },
  { type: "out", text: "✓ Redis enabled" },
  { type: "out", text: "█ Finalizing configuration..." },
  { type: "out", text: "✓ blockend.json ready" },
  { type: "out", text: "✨ Blockend initialized successfully. Run: npx blockend add <block>" }
];

export function Terminal() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
    let index = 0;
    const timer = setInterval(() => {
      if (index < SCRIPT.length) {
        setLines((prev) => [...prev, SCRIPT[index]]);
        index++;
        // Auto-scroll
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        }, 10);
      } else {
        clearInterval(timer);
        setIsPlaying(false);
      }
    }, 400); // speed
    return () => clearInterval(timer);
  }, [isPlaying]);

  const renderLine = (line: TerminalLine, idx: number) => {
    const isCmd = line.type === "cmd";
    const isTree = line.type === "tree";
    const content = line.text;
    if (isCmd) {
      return (
        <div key={idx} className="text-[#e2724a]">
          {content}
        </div>
      );
    }
    if (isTree) {
      return (
        <div key={idx} className="text-[#8b8d93] whitespace-pre">
          {content}
        </div>
      );
    }
    // out
    const color = content.startsWith("✓") ? "#5fbf77" : "#ededef";
    return (
      <div key={idx} style={{ color }}>
        {content}
      </div>
    );
  };

  return (
    <div className="terminal-window rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#262830] bg-white/[0.02]">
        <span className="terminal-dot bg-[#FF5F56]"></span>
        <span className="terminal-dot bg-[#FFBD2E]"></span>
        <span className="terminal-dot bg-[#27C93F]"></span>
        <span className="ml-3 text-xs font-mono text-[#8b8d93]">~/api-service</span>
      </div>
      <div
        ref={containerRef}
        className="font-mono text-[0.83rem] leading-[1.75] p-5 h-[340px] overflow-y-auto"
      >
        {lines.map((line, i) => renderLine(line, i))}
        {isPlaying && (
          <span className="inline-block w-2 h-4 bg-[#e2724a] animate-blink align-middle ml-0.5" />
        )}
      </div>
    </div>
  );
}
