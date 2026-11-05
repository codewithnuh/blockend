/* oxlint-disable no-console */
import path, { join, dirname } from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { intro, outro, spinner } from "@clack/prompts";
import pc from "picocolors";
import { detectProject } from "../detectors/index.js";
import { findUp } from "../utils/find-up.js";
import { resolveProjectTarget, targetErrorMessage } from "../workspace/index.js";
import type { BlockendConfig } from "../block-install/index.js";

// Lockfiles are searched in this order, matching the package-manager precedence.
const LOCKFILES: Array<{ file: string; manager: string }> = [
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "bun.lockb", manager: "bun" },
  { file: "package-lock.json", manager: "npm" }
];

// ─── types ───────────────────────────────────────────────────────────────────

export interface DoctorCheck {
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  warnings: DoctorCheck[];
  errors: DoctorCheck[];
}

// ─── output helpers ──────────────────────────────────────────────────────────

function outputDoctorResult(json: boolean, result: DoctorResult): void {
  if (json) {
    process.stdout.write(
      JSON.stringify({
        success: result.errors.length === 0,
        checks: result.checks,
        warnings: result.warnings,
        errors: result.errors
      }) + "\n"
    );
  } else {
    console.log("");
    for (const check of result.checks) {
      const icon =
        check.status === "ok"
          ? pc.green("✔")
          : check.status === "warning"
            ? pc.yellow("⚠")
            : pc.red("✖");
      const msg =
        check.status === "ok"
          ? pc.dim(check.message)
          : check.status === "warning"
            ? pc.yellow(check.message)
            : pc.red(check.message);
      console.log(`  ${icon} ${pc.bold(check.name)}: ${msg}`);
    }
    console.log("");

    if (result.errors.length > 0) {
      outro(pc.red(`Found ${result.errors.length} error(s). Please fix the issues above.`));
    } else if (result.warnings.length > 0) {
      outro(pc.yellow(`Found ${result.warnings.length} warning(s). Everything looks functional.`));
    } else {
      outro(pc.green("All checks passed! Your project is healthy."));
    }
  }
}

/**
 * Finds the nearest known lockfile between `startDir` and `boundary`, so a
 * workspace package can inherit the workspace root's lockfile.
 */
function findLockfile(startDir: string, boundary: string): string | null {
  const stop = path.resolve(boundary);
  let dir = startDir;

  while (true) {
    for (const { file, manager } of LOCKFILES) {
      if (existsSync(join(dir, file))) return manager;
    }
    if (path.resolve(dir) === stop) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ─── doctor command ──────────────────────────────────────────────────────────

export async function doctorCommand(
  options: { json?: boolean; cwd?: string } = {}
): Promise<DoctorResult> {
  const { json = false } = options;

  if (!json) {
    console.log("");
    intro(`${pc.bgCyan(pc.black(" blockend "))} ${pc.dim("doctor")}`);
  }

  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const checks: DoctorCheck[] = [];
  const warnings: DoctorCheck[] = [];
  const errors: DoctorCheck[] = [];

  function addCheck(check: DoctorCheck): void {
    checks.push(check);
    if (check.status === "warning") warnings.push(check);
    if (check.status === "error") errors.push(check);
  }

  const s = spinner();
  if (!json) s.start("Scanning project health...");

  // ── Resolve the target package, mirroring the install commands ───────────

  const target = await resolveProjectTarget(cwd, { command: "doctor", interactive: false });
  const configPath = target.kind === "package" ? target.configPath : null;
  const boundary = "workspace" in target ? (target.workspace?.root ?? cwd) : cwd;
  // Package-scoped checks use the resolved package; the lockfile boundary stays
  // the workspace root so a package can inherit the root lockfile.
  const projectDir =
    target.kind === "package" || target.kind === "needs-init" ? target.rootDir : cwd;

  // ── Check: package.json exists ───────────────────────────────────────────

  const packageJsonPath = await findUp("package.json", projectDir);
  if (packageJsonPath) {
    addCheck({ name: "package.json", status: "ok", message: "Found" });
  } else {
    addCheck({
      name: "package.json",
      status: "error",
      message: "Not found. Run 'npm init' or 'pnpm init' first."
    });
  }

  // ── Check: blockend.json exists ──────────────────────────────────────────

  if (configPath) {
    addCheck({ name: "blockend.json", status: "ok", message: "Found" });
  } else {
    addCheck({
      name: "blockend.json",
      status: "error",
      message: targetErrorMessage(target) ?? "Not found. Run 'npx blockend init' first."
    });
  }

  // ── Check: tsconfig.json (optional, warning for TS projects) ─────────────

  const tsConfigPath = await findUp("tsconfig.json", projectDir);
  if (tsConfigPath) {
    addCheck({ name: "tsconfig.json", status: "ok", message: "Found" });
  } else {
    addCheck({
      name: "tsconfig.json",
      status: "warning",
      message: "Not found. TypeScript projects typically need one."
    });
  }

  // ── Check: lockfile exists (searching up to the workspace root) ──────────

  const lockfileManager = findLockfile(cwd, boundary);
  if (lockfileManager) {
    addCheck({ name: "Lockfile", status: "ok", message: `${lockfileManager} lockfile found` });
  } else {
    addCheck({
      name: "Lockfile",
      status: "warning",
      message: "No lockfile detected. Run your package manager to generate one."
    });
  }

  // ── Check: project detection ─────────────────────────────────────────────

  try {
    const context = await detectProject(projectDir);

    if (context.framework !== "none") {
      addCheck({
        name: "Framework",
        status: "ok",
        message: `Detected: ${context.framework}`
      });
    } else {
      addCheck({
        name: "Framework",
        status: "warning",
        message:
          "No framework detected. Blockend works best with Express, Fastify, Hono, or Next.js."
      });
    }

    addCheck({
      name: "Package manager",
      status: "ok",
      message: `Detected: ${context.packageManager}`
    });

    if (context.workspace) {
      addCheck({
        name: "Workspace",
        status: "ok",
        message: `${context.workspace.manager} monorepo · ${context.workspace.packages.length} package(s)`
      });
    } else {
      addCheck({ name: "Workspace", status: "ok", message: "Single project" });
    }

    if (context.hasRedis) {
      addCheck({ name: "Redis", status: "ok", message: "Redis client detected" });
    }

    if (context.hasPrisma) {
      addCheck({ name: "Prisma", status: "ok", message: "Prisma ORM detected" });
    }

    if (context.hasDrizzle) {
      addCheck({ name: "Drizzle", status: "ok", message: "Drizzle ORM detected" });
    }
  } catch (err) {
    addCheck({
      name: "Project detection",
      status: "error",
      message: `Failed to scan project: ${String(err)}`
    });
  }

  // ── Check: blockend.json validity ────────────────────────────────────────

  if (configPath) {
    try {
      const raw = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(raw) as BlockendConfig;

      if (!config.environment) {
        addCheck({
          name: "Config: environment",
          status: "error",
          message: "Missing 'environment' field in blockend.json"
        });
      } else {
        addCheck({
          name: "Config: environment",
          status: "ok",
          message: `Set to '${config.environment}'`
        });
      }

      if (!config.paths?.blocks) {
        addCheck({
          name: "Config: blocks path",
          status: "error",
          message: "Missing 'paths.blocks' in blockend.json"
        });
      } else {
        const blocksDir = path.resolve(dirname(configPath), config.paths.blocks);
        if (existsSync(blocksDir)) {
          addCheck({
            name: "Config: blocks directory",
            status: "ok",
            message: `Exists: ${config.paths.blocks}`
          });
        } else {
          addCheck({
            name: "Config: blocks directory",
            status: "warning",
            message: `Directory '${config.paths.blocks}' does not exist yet. Blocks will create it on first add.`
          });
        }
      }
    } catch {
      addCheck({
        name: "Config: parse",
        status: "error",
        message: "Failed to parse blockend.json — file may be corrupted."
      });
    }
  }

  if (!json) s.stop("Scan complete.");

  const result: DoctorResult = { checks, warnings, errors };
  outputDoctorResult(json, result);

  if (errors.length > 0 && !json) {
    process.exit(1);
  }

  return result;
}
