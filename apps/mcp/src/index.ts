#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execa, type Options, type ExecaError } from "execa";

const server = new McpServer({
  name: "blockend",
  version: "0.1.0",
  description: "Blockend MCP server — install production-ready backend blocks into any project"
});

interface SafeExecResult {
  text: string;
  isError: boolean;
}

/**
 * Helper to safely execute commands.
 * Resolves the string type assignment issues cleanly.
 */
async function safeExec(
  command: string,
  args: string[],
  options?: Options
): Promise<SafeExecResult> {
  try {
    const { stdout } = await execa(command, args, options);
    // Ensure stdout is treated as a string
    return { text: String(stdout), isError: false };
  } catch (error) {
    const execaError = error as ExecaError;

    // Fallback chain: check stderr, then stdout, then the top-level error message
    const rawError = execaError.stderr || execaError.stdout || execaError.message;

    // Safely cast or convert the raw error output into a concrete string
    const errorMsg =
      typeof rawError === "string"
        ? rawError
        : rawError
          ? String(rawError)
          : "Unknown execution error";

    return { text: `Error executing command: ${errorMsg}`, isError: true };
  }
}

// Tool 1 — list available blocks
server.tool(
  "list_blocks",
  "Lists all available Blockend blocks with names, descriptions, and tags",
  {},
  async () => {
    const result = await safeExec("npx", ["--no-install", "blockend-cli", "list", "--json"]);
    return {
      content: [{ type: "text", text: result.text }],
      isError: result.isError
    };
  }
);

// Tool 2 — add a block to a project
server.tool(
  "add_block",
  "Installs a Blockend block into a project. Detects framework and language automatically.",
  {
    blockName: z.string().describe("Block name e.g. rate-limiter, error-handler, logger"),
    projectPath: z
      .string()
      .describe("Absolute path to the project root where blockend should install")
  },
  async ({ blockName, projectPath }) => {
    const result = await safeExec(
      "npx",
      ["--no-install", "blockend-cli", "add", blockName, "--yes"],
      { cwd: projectPath }
    );
    return {
      content: [{ type: "text", text: result.text }],
      isError: result.isError
    };
  }
);

// Tool 3 — detect project context
server.tool(
  "detect_project",
  "Analyzes a project and returns its framework, language, package manager, and other configuration Blockend uses to adapt blocks",
  {
    projectPath: z.string().describe("Absolute path to the project root")
  },
  async ({ projectPath }) => {
    const result = await safeExec("npx", ["--no-install", "blockend-cli", "detect", "--json"], {
      cwd: projectPath
    });
    return {
      content: [{ type: "text", text: result.text }],
      isError: result.isError
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
