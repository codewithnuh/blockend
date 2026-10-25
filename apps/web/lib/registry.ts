import fs from "fs/promises";
import path from "path";
import {
  buildCatalog,
  loadRegistryFile,
  type CatalogBlock,
  type Registry
} from "@blockend/registry";

export type { CatalogBlock } from "@blockend/registry";

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
  "password-hash": "Security",
  "token-service": "Security"
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function loadRegistry(): Promise<Registry> {
  const registryPath = path.resolve(process.cwd(), "../../registry/index.json");
  return loadRegistryFile(registryPath);
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

/**
 * Load registry blocks as catalog entries, newest release first.
 * Pass `limit` to cap the list (landing page uses 8).
 */
export async function loadCatalog(options?: { limit?: number }): Promise<CatalogBlock[]> {
  const [registry, docsMap] = await Promise.all([loadRegistry(), buildDocsMap()]);
  const blocks = buildCatalog(registry, {
    tagForKey: (key) => TAG_BY_KEY[key] ?? "Block",
    docHrefForKey: (key) => resolveDocHref(key, docsMap)
  });
  return options?.limit ? blocks.slice(0, options.limit) : blocks;
}
