/* eslint-disable no-console */

import { detectProject } from "../detectors/index.js";
import { outro } from "@clack/prompts";
import pc from "picocolors";

export async function detectCommand(options: { json?: boolean } = {}): Promise<void> {
  const { json = false } = options;

  try {
    const context = await detectProject(process.cwd());

    if (json) {
      process.stdout.write(JSON.stringify(context, null, 2) + "\n");
      return;
    }

    console.log();
    console.log(pc.bold("  Detected project configuration:"));
    console.log();
    console.log(`  Framework:        ${pc.cyan(context.framework)}`);
    console.log(`  Language:         ${pc.cyan(context.language)}`);
    console.log(`  Package manager:  ${pc.cyan(context.packageManager)}`);
    console.log(`  Source dir:       ${pc.dim(context.srcDir)}`);
    console.log(
      `  Redis:            ${context.hasRedis ? pc.green("detected") : pc.dim("not found")}`
    );
    console.log(
      `  Prisma:           ${context.hasPrisma ? pc.green("detected") : pc.dim("not found")}`
    );
    console.log(
      `  Drizzle:          ${context.hasDrizzle ? pc.green("detected") : pc.dim("not found")}`
    );
    console.log();
  } catch (error) {
    if (json) {
      process.stdout.write(JSON.stringify({ success: false, error: String(error) }) + "\n");
    } else {
      outro(pc.red(`✖ Detection failed: ${String(error)}`));
    }
    process.exit(1);
  }
}
