import { join } from "path";
import fs from "fs/promises";

/**
 * Pick a registry variant for non-interactive paths.
 * Prefers the recorded variant; falls back to a safe default.
 */
export function selectVariant(variantKeys: string[], preferredVariant?: string): string {
  if (preferredVariant && variantKeys.includes(preferredVariant)) {
    return preferredVariant;
  }
  if (variantKeys.includes("memory")) return "memory";
  if (variantKeys.includes("default")) return "default";
  return variantKeys[0];
}

/**
 * Resolve the preferred variant for update/diff.
 * Uses the recorded install variant when still present in the registry;
 * otherwise infers `redis` from on-disk markers so untracked Redis installs
 * are not silently downgraded to the `memory` files on update.
 */
export async function resolvePreferredVariant(
  variantKeys: string[],
  recordedVariant: string | undefined,
  targetFolder: string
): Promise<string | undefined> {
  if (recordedVariant && variantKeys.includes(recordedVariant)) {
    return recordedVariant;
  }

  if (variantKeys.includes("redis")) {
    const markers = [
      join(targetFolder, "variants", "redis-store.ts"),
      join(targetFolder, "variants", "redis-store.test.ts"),
      join(targetFolder, "variants", "redis.test.ts")
    ];

    for (const marker of markers) {
      try {
        await fs.access(marker);
        return "redis";
      } catch {
        // try next marker
      }
    }
  }

  return undefined;
}
