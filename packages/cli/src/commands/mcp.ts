/* eslint-disable no-console */
import path, { join } from "node:path";
import fs from "node:fs/promises";
import pc from "picocolors";
import { outro, spinner, select, confirm } from "@clack/prompts";
import type { Options as ExecaOptions } from "execa";

// Structural definitions for project-local configurations
interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface SafeExecResult {
  text: string;
  isError: boolean;
}

// Client definition matrix matching local profiles
export type SupportedClient = "claude" | "codex" | "cursor" | "vscode" | "windsurf";

type ConfigFormat = "json" | "toml";

interface ClientTargetMeta {
  label: string;
  relativePath: string;
  format: ConfigFormat;
  isCustomSchema?: boolean;
}

const CLIENT_MATRIX: Record<SupportedClient, ClientTargetMeta> = {
  claude: {
    label: "Claude Code",
    relativePath: ".mcp.json",
    format: "json"
  },

  codex: {
    label: "Codex CLI",
    relativePath: ".codex/config.toml",
    format: "toml"
  },

  cursor: {
    label: "Cursor",
    relativePath: ".cursor/mcp.json",
    format: "json"
  },

  vscode: {
    label: "VS Code",
    relativePath: ".vscode/settings.json",
    format: "json",
    isCustomSchema: true
  },

  windsurf: {
    label: "Windsurf",
    relativePath: ".windsurf/mcp.json",
    format: "json"
  }
};

// Global baseline server execution configuration
const BLOCKEND_SERVER: McpServerConfig = {
  command: "npx",
  args: ["-y", "blockend-cli", "mcp"]
};

/**
 * Creates a valid, minimized TOML block for file generation or logging
 */
function generateToml(server: McpServerConfig): string {
  const args = server.args.map((arg) => `"${arg}"`).join(", ");

  return `
[mcp_servers.blockend]
command = "${server.command}"
args = [${args}]
`.trimStart();
}

/**
 * Runs the Stdio Server transport connection loops
 */
export async function mcpStartCommand(): Promise<void> {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { z } = await import("zod");
  const { execa } = await import("execa");

  const server = new McpServer({
    name: "blockend",
    version: "0.1.0",
    description: "Blockend MCP server — install production-ready backend blocks into any project"
  });

  async function safeExec(
    command: string,
    args: string[],
    options?: ExecaOptions
  ): Promise<SafeExecResult> {
    try {
      const { stdout } = await execa(command, args, options);
      return { text: String(stdout), isError: false };
    } catch (error) {
      const err = error as { stderr?: unknown; stdout?: unknown; message?: string };
      const rawError = err.stderr || err.stdout || err.message || "Unknown execution error";
      return { text: `Error executing command: ${String(rawError)}`, isError: true };
    }
  }

  server.tool(
    "list_blocks",
    "Lists all available Blockend blocks with names, descriptions, and tags",
    {},
    async () => {
      const result = await safeExec("npx", ["--no-install", "blockend", "list", "--json"]);
      return { content: [{ type: "text", text: result.text }], isError: result.isError };
    }
  );

  server.tool(
    "add_block",
    "Installs a Blockend block into a project.",
    {
      blockName: z.string().describe("Block name e.g. rate-limit, error-handler, logger"),
      projectPath: z
        .string()
        .describe("Absolute path to the project root where blockend should install")
    },
    async ({ blockName, projectPath }) => {
      const result = await safeExec(
        "npx",
        ["--no-install", "blockend", "add", blockName, "--yes", "--json"],
        { cwd: projectPath }
      );
      return { content: [{ type: "text", text: result.text }], isError: result.isError };
    }
  );

  server.tool(
    "detect_project",
    "Analyzes a project context.",
    {
      projectPath: z.string().describe("Absolute path to the project root")
    },
    async ({ projectPath }) => {
      const result = await safeExec("npx", ["--no-install", "blockend", "detect", "--json"], {
        cwd: projectPath
      });
      return { content: [{ type: "text", text: result.text }], isError: result.isError };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Builds localized, project-level configurations safely
 */
export async function mcpInitCommand(options: {
  client?: string;
  force?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  let chosenClient = options.client as SupportedClient | undefined;

  // 1. Resolve targeted client interactively if omitted
  if (!chosenClient) {
    if (options.yes) {
      chosenClient = "claude"; // Fallback standard
    } else {
      const selection = await select({
        message: "Select target AI client layout profile:",
        options: Object.entries(CLIENT_MATRIX).map(([key, value]) => ({
          value: key,
          label: value.label
        }))
      });
      if (typeof selection === "symbol") return; // Handles clack cancellations gracefully
      chosenClient = selection as SupportedClient;
    }
  }

  const meta = CLIENT_MATRIX[chosenClient];
  if (!meta) {
    outro(pc.red(`✖ Unsupported client identifier profile: ${options.client}`));
    return;
  }

  const absoluteConfigTarget = join(cwd, meta.relativePath);

  // 2. Early exit if running dry run setups
  if (options.dryRun) {
    console.log(
      pc.cyan(`\nℹ Dry-run mode active. Intended path location: ${pc.dim(meta.relativePath)}`)
    );

    if (meta.format === "json") {
      const jsonConfig = meta.isCustomSchema
        ? { "mcp.mcpServers": { blockend: BLOCKEND_SERVER } }
        : { mcpServers: { blockend: BLOCKEND_SERVER } };
      console.log(pc.gray(JSON.stringify(jsonConfig, null, 2)));
    } else {
      console.log(pc.gray(generateToml(BLOCKEND_SERVER)));
    }

    outro(pc.green("✔ Dry run evaluation complete."));
    return;
  }

  // 3. File existence checks
  let fileConflict = false;
  try {
    await fs.access(absoluteConfigTarget);
    fileConflict = true;
  } catch {
    // Path clean
  }

  if (fileConflict && !options.force && !options.yes) {
    const shouldOverwrite = await confirm({
      message: `⚠ Local configuration at [${meta.relativePath}] already exists. Overwrite?`,
      initialValue: false
    });
    if (!shouldOverwrite || typeof shouldOverwrite === "symbol") {
      outro(pc.yellow("ℹ Operations halted. Project layout revisions preserved."));
      return;
    }
  }

  const s = spinner();
  s.start(`Writing localized project configurations inside ${pc.dim(meta.relativePath)}...`);

  try {
    await fs.mkdir(path.dirname(absoluteConfigTarget), { recursive: true });

    if (meta.format === "json") {
      let workingConfig: Record<string, unknown> = {};
      if (fileConflict) {
        try {
          const rawContent = await fs.readFile(absoluteConfigTarget, "utf-8");
          workingConfig = JSON.parse(rawContent) as Record<string, unknown>;
        } catch {
          workingConfig = {};
        }
      }

      // Merge clean block targets inside structure cleanly
      if (meta.isCustomSchema) {
        const existingServers = (workingConfig["mcp.mcpServers"] || {}) as Record<string, unknown>;
        workingConfig["mcp.mcpServers"] = { ...existingServers, blockend: BLOCKEND_SERVER };
      } else {
        const existingServers = (workingConfig.mcpServers || {}) as Record<string, unknown>;
        workingConfig.mcpServers = { ...existingServers, blockend: BLOCKEND_SERVER };
      }

      await fs.writeFile(absoluteConfigTarget, JSON.stringify(workingConfig, null, 2), "utf-8");
    } else {
      // For TOML config (e.g. Codex), write/overwrite directly via generator
      await fs.writeFile(absoluteConfigTarget, generateToml(BLOCKEND_SERVER), "utf-8");
    }

    s.stop(
      pc.green(`✔ Local workspace integration fully complete! File target: ${meta.relativePath}`)
    );
  } catch (error) {
    s.stop(pc.red("✖ Fatal crash reading or creating local configuration maps."));
    console.error(pc.dim(String(error)));
  }
}
