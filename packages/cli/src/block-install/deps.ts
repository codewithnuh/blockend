/**
 * Parse a dependency specifier like "vitest@^4.0.0" into { name, versionRange }.
 * If no version specified, versionRange is null.
 */
export function parseDepSpec(dep: string): { name: string; versionRange: string | null } {
  const atIndex = dep.lastIndexOf("@");
  if (atIndex > 0) {
    return { name: dep.slice(0, atIndex), versionRange: dep.slice(atIndex + 1) };
  }
  return { name: dep, versionRange: null };
}

/**
 * Simple semver comparison. Returns true if `installed` satisfies `range`.
 * Supports: exact (1.2.3), caret (^1.2.3), tilde (~1.2.3), gte (>=1.2.3).
 * Falls back to true if we can't parse (don't block installs for weird ranges).
 */
export function semverSatisfies(installed: string, range: string): boolean {
  const parse = (v: string) => {
    const clean = v.replace(/^[~^>=<]+/, "");
    const parts = clean.split(".").map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };

  const [iMajor, iMinor, iPatch] = parse(installed);
  const raw = range.replace(/^[~^>=<]+/, "");
  const [rMajor, rMinor, rPatch] = parse(raw);

  if (range.startsWith("^")) {
    // ^1.2.3 means >=1.2.3 <2.0.0
    return (
      (iMajor > rMajor ||
        (iMajor === rMajor && (iMinor > rMinor || (iMinor === rMinor && iPatch >= rPatch)))) &&
      iMajor === rMajor
    );
  }

  if (range.startsWith("~")) {
    // ~1.2.3 means >=1.2.3 <1.3.0
    return iMajor === rMajor && iMinor === rMinor && iPatch >= rPatch;
  }

  if (range.startsWith(">=")) {
    return (
      iMajor > rMajor ||
      (iMajor === rMajor && (iMinor > rMinor || (iMinor === rMinor && iPatch >= rPatch)))
    );
  }

  // Exact match
  return installed === raw;
}

/**
 * Check if a block's dependency conflicts with the user's installed version.
 * Returns list of conflicts like "vitest: block requires ^4.0.0, you have 3.0.0"
 */
export function getVersionConflicts(deps: string[], installed: Record<string, string>): string[] {
  const conflicts: string[] = [];
  for (const dep of deps) {
    const { name, versionRange } = parseDepSpec(dep);
    if (versionRange && name in installed) {
      const installedVersion = installed[name];
      if (!semverSatisfies(installedVersion, versionRange)) {
        conflicts.push(`${name}: block requires ${versionRange}, you have ${installedVersion}`);
      }
    }
  }
  return conflicts;
}

/**
 * Returns deps that need to be installed or updated.
 *
 * Three cases:
 * 1. Dep not installed at all → include it
 * 2. Dep installed but version doesn't satisfy the required range → include with version spec
 * 3. Dep installed, no version range in registry, but installed version is old →
 *    include with @latest to ensure block-compatible version
 */
export const getMissingDependencies = (
  deps: string[],
  installed: Record<string, string>,
  forceLatest = false
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const dep of deps) {
    const { name, versionRange } = parseDepSpec(dep);
    if (seen.has(name)) continue;
    seen.add(name);

    if (!(name in installed)) {
      // Case 1: Dep not installed at all
      result.push(dep);
    } else if (versionRange && !semverSatisfies(installed[name], versionRange)) {
      // Case 2: Dep installed but version incompatible with required range
      result.push(dep); // e.g. "vitest@^4.0.0"
    } else if (!versionRange && forceLatest) {
      // Case 3: No version range specified, but force latest to ensure compatibility
      result.push(`${name}@latest`);
    }
    // else: dep exists and is compatible — skip
  }

  return result;
};
