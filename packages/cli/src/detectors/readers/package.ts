import { readFile } from "fs/promises";
import { join } from "path";

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  type?: string;
}

/**
 * Reads and parses package.json from the given directory.
 * Throws a descriptive error if not found — Blockend requires a package.json.
 */
export async function readPackageJson(cwd: string): Promise<PackageJson> {
  const pkgPath = join(cwd, "package.json");
  try {
    const content = await readFile(pkgPath, "utf-8");
    return JSON.parse(content) as PackageJson;
  } catch {
    throw new Error(`No package.json found at ${pkgPath}. Run blockend from your project root.`);
  }
}
