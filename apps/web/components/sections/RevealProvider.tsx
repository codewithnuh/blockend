"use client";

import { useReveal } from "@/lib/useReveal";

export function RevealProvider({ children }: { children: React.ReactNode }) {
  useReveal();
  return <>{children}</>;
}
