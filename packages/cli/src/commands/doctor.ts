/* oxlint-disable no-console */
import path, { join, dirname } from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { intro, outro, spinner } from "@clack/prompts";
import pc from "picocolors";
import { detectProject } from "../detectors/index.js";
import { configPayloadType } from "./init.js";

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

// ─── filesystem helpers ──────────────────────────────────────────────────────

async function findUp(filename: string, startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, filename);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

// ─── doctor command ──────────────────────────────────────────────────────────

export async function doctorCommand(options: { json?: boolean } = {}): Promise<DoctorResult> {
  const { json = false } = options;

  if (!json) {
    console.log("");
    intro(`${pc.bgCyan(pc.black(" blockend "))} ${pc.dim("doctor")}`);
  }

  const cwd = process.cwd();
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

  // ── Check: package.json exists ───────────────────────────────────────────

  const packageJsonPath = await findUp("package.json", cwd);
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

  const configPath = await findUp("blockend.json", cwd);
  if (configPath) {
    addCheck({ name: "blockend.json", status: "ok", message: "Found" });
  } else {
    addCheck({
      name: "blockend.json",
      status: "error",
      message: "Not found. Run 'npx blockend init' first."
    });
  }

  // ── Check: tsconfig.json (optional, warning for TS projects) ─────────────

  const tsConfigPath = await findUp("tsconfig.json", cwd);
  if (tsConfigPath) {
    addCheck({ name: "tsconfig.json", status: "ok", message: "Found" });
  } else {
    addCheck({
      name: "tsconfig.json",
      status: "warning",
      message: "Not found. TypeScript projects typically need one."
    });
  }

  // ── Check: lockfile exists ───────────────────────────────────────────────

  const hasPnpmLock = existsSync(join(cwd, "pnpm-lock.yaml"));
  const hasYarnLock = existsSync(join(cwd, "yarn.lock"));
  const hasBunLock = existsSync(join(cwd, "bun.lockb"));
  const hasNpmLock = existsSync(join(cwd, "package-lock.json"));

  if (hasPnpmLock || hasYarnLock || hasBunLock || hasNpmLock) {
    const pmName = hasPnpmLock ? "pnpm" : hasYarnLock ? "yarn" : hasBunLock ? "bun" : "npm";
    addCheck({ name: "Lockfile", status: "ok", message: `${pmName} lockfile found` });
  } else {
    addCheck({
      name: "Lockfile",
      status: "warning",
      message: "No lockfile detected. Run your package manager to generate one."
    });
  }

  // ── Check: project detection ─────────────────────────────────────────────

  try {
    const context = await detectProject(cwd);

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
      const config = JSON.parse(raw) as configPayloadType;

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
