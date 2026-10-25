import { parseRegistry } from "@blockend/registry";
import type { BlockManifest, RegistryManifest, RegistrySource } from "./types.js";

const DEFAULT_REPO_OWNER = "codewithnuh";
const DEFAULT_REPO_NAME = "blockend";
const DEFAULT_BRANCH = "master";

export interface GitHubRegistrySourceOptions {
  owner?: string;
  repo?: string;
  branch?: string;
  /** Override the raw CDN base (useful for tests or mirrors). */
  baseUrl?: string;
}

/**
 * Production registry source backed by GitHub raw content.
 * Registry reads and file downloads live behind the same seam so the
 * planning/apply code never depends on the network directly.
 */
export function createGitHubRegistrySource(
  options: GitHubRegistrySourceOptions = {}
): RegistrySource {
  const baseUrl =
    options.baseUrl ??
    `https://raw.githubusercontent.com/${options.owner ?? DEFAULT_REPO_OWNER}/${
      options.repo ?? DEFAULT_REPO_NAME
    }/${options.branch ?? DEFAULT_BRANCH}`;

  return {
    async fetchRegistry() {
      const response = await fetch(`${baseUrl}/registry/index.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parseRegistry(await response.json(), { allowLegacy: true });
    },

    async fetchFile(sourcePath) {
      const response = await fetch(`${baseUrl}/${sourcePath}`);
      if (!response.ok) {
        throw new Error(`Download failed: ${sourcePath} (HTTP ${response.status})`);
      }
      return response.text();
    }
  };
}

/**
 * In-memory registry source for module-level tests. No network, no global fetch.
 */
export function createStaticRegistrySource(
  registry: RegistryManifest,
  files: Record<string, string>
): RegistrySource {
  return {
    async fetchRegistry() {
      return registry;
    },

    async fetchFile(sourcePath) {
      const content = files[sourcePath];
      if (content === undefined) {
        throw new Error(`Download failed: ${sourcePath} (missing from static source)`);
      }
      return content;
    }
  };
}

export async function loadRegistry(source: RegistrySource): Promise<RegistryManifest> {
  return source.fetchRegistry();
}

export function getBlockMap(registry: RegistryManifest): Record<string, BlockManifest> {
  return registry.blocks;
}
