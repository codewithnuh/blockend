import type { LoaderOutput } from "fumadocs-core/source";

export type DocStatus = "new" | "experimental" | "validated" | "field-tested" | "audited";

interface DocStatusConfig {
  label: string;
  description: string;
  dot: string;
  badge: string;
}

export const docStatuses: Record<DocStatus, DocStatusConfig> = {
  new: {
    label: "New",
    description: "Recently added documentation",
    dot: "bg-blue-500",
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
  },
  experimental: {
    label: "Experimental",
    description: "API and design may change; core behavior has unit tests",
    dot: "bg-amber-500",
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  },
  validated: {
    label: "Validated",
    description: "Required security, integration, concurrency and failure tests pass in CI",
    dot: "bg-green-500",
    badge: "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
  },
  "field-tested": {
    label: "Field Tested",
    description: "Used in real workloads and operational feedback has been collected",
    dot: "bg-violet-500",
    badge: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400"
  },
  audited: {
    label: "Audited",
    description: "Reviewed through formal audit process",
    dot: "bg-teal-500",
    badge: "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400"
  }
};

export function getStatusMap(source: Pick<LoaderOutput, "getPages">): Map<string, DocStatus> {
  const map = new Map<string, DocStatus>();
  for (const page of source.getPages()) {
    const data = page.data as Record<string, unknown>;
    const status = data.status;
    if (typeof status === "string" && status in docStatuses) {
      map.set(page.url, status as DocStatus);
    }
  }
  return map;
}
