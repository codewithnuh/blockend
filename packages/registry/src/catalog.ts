import type { Registry, RegistryBlock } from "./schema.js";

export interface CatalogBlock {
  key: string;
  name: string;
  description: string;
  version?: string;
  releasedAt?: string;
  releasedAtLabel?: string;
  runtimes?: Record<string, string>;
  nodeRange?: string;
  frameworks?: string[];
  adapterKeys: string[];
  frameworkLabel: string;
  variantCount: number;
  isAgnostic: boolean;
  tag: string;
  command: string;
  docHref: string;
}

export interface CatalogBlockOptions {
  tag: string;
  docHref: string;
}

export interface CatalogOptions {
  tagForKey?: (key: string) => string;
  docHrefForKey?: (key: string) => string;
}

export function formatReleasedAt(iso?: string): string | undefined {
  if (!iso) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

export function buildAdapterInfo(block: RegistryBlock): {
  adapterKeys: string[];
  frameworkLabel: string;
  variantCount: number;
} {
  const rawKeys = block.adapters
    ? Object.keys(block.adapters)
    : block.environments
      ? Object.keys(block.environments)
      : [];

  const adapterKeys = rawKeys.map((key) => (key === "*" ? "*" : key));
  const frameworkLabel =
    adapterKeys.length === 0
      ? "—"
      : adapterKeys.includes("*")
        ? "Any Framework"
        : adapterKeys.join(", ");

  const containers = [
    ...(block.adapters ? Object.values(block.adapters) : []),
    ...(block.environments ? Object.values(block.environments) : [])
  ];
  const variantCount = containers.reduce(
    (total, container) => total + Object.keys(container.variants).length,
    0
  );

  return { adapterKeys, frameworkLabel, variantCount };
}

export function toCatalogBlock(
  key: string,
  block: RegistryBlock,
  options: CatalogBlockOptions
): CatalogBlock {
  const { adapterKeys, frameworkLabel, variantCount } = buildAdapterInfo(block);
  const isAgnostic = block.frameworks?.includes("*") ?? adapterKeys.includes("*");
  const nodeRange = block.runtimes?.node;

  return {
    key,
    name: block.name,
    description: block.description,
    version: block.version,
    releasedAt: block.releasedAt,
    releasedAtLabel: formatReleasedAt(block.releasedAt),
    runtimes: block.runtimes,
    nodeRange,
    frameworks: block.frameworks,
    adapterKeys,
    frameworkLabel,
    variantCount,
    isAgnostic,
    tag: options.tag,
    command: `blockend-cli add ${key}`,
    docHref: options.docHref
  };
}

export function sortCatalogBlocks(a: CatalogBlock, b: CatalogBlock): number {
  return (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "");
}

/**
 * Derive the web catalog view from the canonical registry. Callers supply the
 * presentation-only bits (tags and docs links) so the registry package stays
 * independent of the docs site layout.
 */
export function buildCatalog(registry: Registry, options: CatalogOptions = {}): CatalogBlock[] {
  return Object.entries(registry.blocks)
    .map(([key, block]) =>
      toCatalogBlock(key, block, {
        tag: options.tagForKey?.(key) ?? "Block",
        docHref: options.docHrefForKey?.(key) ?? "/docs/blocks-reference"
      })
    )
    .sort(sortCatalogBlocks);
}
