import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repoRoot, "packages", "registry");
const sourceRoot = path.join(packageRoot, "src");
const buildOutput = path.join(packageRoot, "dist", "index.js");

// Turbo builds workspace dependencies before dependents, so the package build
// is already complete when these lifecycle scripts run inside a Turbo task.
// Still build when the output is missing, such as on a clean checkout.
if (process.env.TURBO_HASH && existsSync(buildOutput)) process.exit(0);

function newestMtime(directory) {
  let newest = statSync(directory).mtimeMs;
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
