"use client";

import { useEffect, useRef, useCallback } from "react";
import { TERMINAL_SCRIPT } from "@/lib/data";
import type { TerminalLine } from "@/lib/types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderLines(lines: TerminalLine[]): string {
  return lines
    .map((l) => {
      if (l.type === "cmd") {
        return `<div><span style="color:#E2724A">${escapeHtml(l.text)}</span></div>`;
      }
      if (l.type === "out") {
        return `<div style="color:#5FBF77">${escapeHtml(l.text)}</div>`;
      }
      return `<div style="color:#8B8D93">${escapeHtml(l.text)}</div>`;
    })
    .join("");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function HeroTerminal() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  const typeLoop = useCallback(async () => {
    const el = bodyRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      el.innerHTML = renderLines(TERMINAL_SCRIPT);
      return;
    }

    while (!cancelledRef.current) {
      const done: TerminalLine[] = [];

      for (const line of TERMINAL_SCRIPT) {
        if (cancelledRef.current) return;
        let acc = "";
        const full = line.text;
        const speed = line.type === "cmd" ? 28 : 4;
        const step = line.type === "cmd" ? 1 : 3;

        for (let i = 0; i <= full.length; i += step) {
          if (cancelledRef.current) return;
          acc = full.slice(0, i);
          const showCaret = line.type === "cmd" && i < full.length;
          const preview: TerminalLine[] = [
            ...done,
            { ...line, text: acc },
            ...(showCaret ? [{ type: "cmd" as const, text: "█" }] : [])
          ];
          el.innerHTML = renderLines(preview);
          await sleep(speed);
        }

        done.push(line);
        el.innerHTML = renderLines(done);
        await sleep(line.type === "cmd" ? 220 : 80);
      }

      await sleep(2600);

      // Erase
      let stepsBack = done.length;
      while (stepsBack > 0) {
        if (cancelledRef.current) return;
        stepsBack--;
        el.innerHTML = renderLines(done.slice(0, stepsBack));
        await sleep(40);
      }

      await sleep(500);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    typeLoop();
    return () => {
      cancelledRef.current = true;
    };
  }, [typeLoop]);

  return (
    <div className="reveal" style={{ transitionDelay: "0.15s" }}>
      <div className="terminal-window rounded-xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-white/[0.02]">
          <span className="terminal-dot bg-[#FF5F56]" />
          <span className="terminal-dot bg-[#FFBD2E]" />
          <span className="terminal-dot bg-[#27C93F]" />
          <span className="ml-3 text-xs font-mono text-[var(--muted)]">~/api-service</span>
        </div>
        {/* Body */}
        <div
          ref={bodyRef}
          className="font-mono text-[0.83rem] leading-[1.75] p-5 h-[340px] overflow-hidden whitespace-pre-wrap"
        />
      </div>
    </div>
  );
}
