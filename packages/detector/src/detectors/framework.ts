import type { ProjectContext } from "@blockend/core";
/**
 * Detects the HTTP framework by checking project dependencies.
 * Checks in order of specificity — Fastify and Hono before Express.
 */
export function detectFramework(deps: Record<string, string>): ProjectContext["framework"] {
  if ("fastify" in deps) return "fastify";
  if ("hono" in deps) return "hono";
  if ("express" in deps) return "express";
  if ("next" in deps) return "next";
  return "none";
}
