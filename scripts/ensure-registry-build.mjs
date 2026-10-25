import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Turbo builds workspace dependencies before dependents, so the package build
// is already complete when these lifecycle scripts run inside a Turbo task.
if (process.env.TURBO_HASH) process.exit(0);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repoRoot, "packages", "registry");
const sourceRoot = path.join(packageRoot, "src");
const buildOutput = path.join(packageRoot, "dist", "index.js");

function newestMtime(directory) {
  let newest = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(fullPath));
    } else {
      newest = Math.max(newest, statSync(fullPath).mtimeMs);
    }
  }
  return newest;
}

const inputs = [
  sourceRoot,
  path.join(packageRoot, "package.json"),
  path.join(packageRoot, "tsconfig.json"),
  path.join(repoRoot, "tsconfig.base.json")
];
const newestInput = Math.max(
  ...inputs.map((input) =>
    statSync(input).isDirectory() ? newestMtime(input) : statSync(input).mtimeMs
  )
);

if (existsSync(buildOutput) && statSync(buildOutput).mtimeMs >= newestInput) {
  process.exit(0);
}

const result = spawnSync("pnpm", ["--filter", "@blockend/registry", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);
