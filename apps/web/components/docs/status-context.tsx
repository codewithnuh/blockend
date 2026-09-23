"use client";

import { createContext, useContext } from "react";
import type { DocStatus } from "@/lib/doc-status";

const StatusContext = createContext<Map<string, DocStatus>>(new Map());

export function StatusProvider({
  statusMap,
  children
}: {
  statusMap: Map<string, DocStatus>;
  children: React.ReactNode;
}) {
  return <StatusContext.Provider value={statusMap}>{children}</StatusContext.Provider>;
}

export function useStatusMap(): Map<string, DocStatus> {
  return useContext(StatusContext);
}
