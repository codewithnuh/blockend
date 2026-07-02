import type { ProjectContext } from "../types/index.js";

/**
 * Detects the runtime from project dependencies.
 * Most projects are Node — Bun has specific type markers.
 */
export function detectRuntime(deps: Record<string, string>): ProjectContext["runtime"] {
  if ("@types/bun" in deps || "bun-types" in deps) return "bun";
  return "node";
}
