import fs from "fs/promises";
import path from "path";

export interface RegistryBlock {
  name?: string;
  description: string;
  version?: string;
  releasedAt?: string;
  runtimes?: Record<string, string>;
  frameworks?: string[];
  dependencies?: string[];
  devDependencies?: string[];
  requires?: string[];
  related?: string[];
  conflicts?: string[];
  adapters?: Record<
    string,
    {
      dependencies?: string[];
      variants?: Record<
        string,
        {
          files?: Array<{ target: string }>;
        }
      >;
    }
  >;
  environments?: Record<
    string,
    {
      variants?: Record<string, unknown>;
    }
  >;
}

export interface Registry {
  version?: string;
  blocks?: Record<string, RegistryBlock>;
}

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

const TAG_BY_KEY: Record<string, string> = {
  "rate-limiter": "HTTP",
  "error-handler": "Errors",
  logger: "Observability",
  "request-validator": "Validation",
  "response-formatter": "Response",
  "env-config": "Config",
  "health-check": "Ops",
  "graceful-shutdown": "Runtime",
  idempotency: "Reliability",
  "password-hash": "Security"
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function formatReleasedAt(iso?: string): string | undefined {
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

function buildAdapterInfo(block: RegistryBlock): {
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
    (total, container) => total + (container.variants ? Object.keys(container.variants).length : 0),
    0
  );

  return { adapterKeys, frameworkLabel, variantCount };
}

async function loadRegistry(): Promise<Registry> {
  const registryPath = path.resolve(process.cwd(), "../../registry/index.json");
  const raw = await fs.readFile(registryPath, "utf-8");
  return JSON.parse(raw) as Registry;
}

async function buildDocsMap(): Promise<Map<string, string>> {
  const docsPath = path.resolve(process.cwd(), "content/docs/02-blocks");
  const docsMap = new Map<string, string>();

  try {
    const files = await fs.readdir(docsPath);
    for (const file of files) {
      if (!file.endsWith(".mdx")) continue;
      const filename = file.replace(/\.mdx$/, "");
      const slug = normalize(filename.replace(/^\d+-/, ""));
      docsMap.set(slug, filename);
    }
  } catch {
    // Docs directory missing — cards fall back to blocks-reference.
  }

  return docsMap;
}

function resolveDocHref(key: string, docsMap: Map<string, string>): string {
  const normalizedKey = normalize(key);
  const direct = docsMap.get(normalizedKey);
  if (direct) return `/docs/02-blocks/${direct}`;

  for (const [slug, filename] of docsMap) {
    if (slug.includes(normalizedKey) || normalizedKey.includes(slug)) {
      return `/docs/02-blocks/${filename}`;
    }
  }

  return "/docs/blocks-reference";
}

function toCatalogBlock(
  key: string,
  block: RegistryBlock,
  docsMap: Map<string, string>
): CatalogBlock {
  const { adapterKeys, frameworkLabel, variantCount } = buildAdapterInfo(block);
  const isAgnostic = block.frameworks?.includes("*") ?? adapterKeys.includes("*");
  const nodeRange = block.runtimes?.node;

  return {
    key,
    name: block.name ?? key,
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
    tag: TAG_BY_KEY[key] ?? "Block",
    command: `blockend-cli add ${key}`,
    docHref: resolveDocHref(key, docsMap)
  };
}

function sortByReleasedAtDesc(a: CatalogBlock, b: CatalogBlock): number {
  return (b.releasedAt ?? "").localeCompare(a.releasedAt ?? "");
}

/**
 * Load registry blocks as catalog entries, newest release first.
 * Pass `limit` to cap the list (landing page uses 8).
 */
export async function loadCatalog(options?: { limit?: number }): Promise<CatalogBlock[]> {
  try {
    const [registry, docsMap] = await Promise.all([loadRegistry(), buildDocsMap()]);
    const blocks = Object.entries(registry.blocks ?? {}).map(([key, block]) =>
      toCatalogBlock(key, block, docsMap)
    );
    blocks.sort(sortByReleasedAtDesc);
    return options?.limit ? blocks.slice(0, options.limit) : blocks;
  } catch (error) {
    console.error("Registry load failed:", error);
    return [];
  }
}
