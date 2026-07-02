#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { addCommand } from "./commands/add.js";
import { initCommand } from "./commands/init.js";
import { detectCommand } from "./commands/detect.js";
import { listCommand } from "./commands/list.js";
import { mcpInitCommand, mcpStartCommand } from "./commands/mcp.js";
const mcpInit = defineCommand({
  meta: {
    name: "init",
    description: "Generate appropriate project-local MCP infrastructure configurations"
  },
  args: {
    client: {
      type: "string",
      description:
        "Target specific integration client profiles: claude | codex | cursor | vscode | windsurf"
    },
    force: {
      type: "boolean",
      default: false,
      description: "Force override existing asset layouts"
    },
    "dry-run": {
      type: "boolean",
      default: false,
      description: "Output planned workspace updates without disk mutation logs"
    },
    yes: { type: "boolean", default: false, description: "Bypass verification prompt iterations" }
  },
  async run({ args }) {
    await mcpInitCommand({
      client: args.client,
      force: args.force,
      dryRun: args["dry-run"],
      yes: args.yes
    });
  }
});

const mcp = defineCommand({
  meta: {
    name: "mcp",
    description: "Connect to context protocol channels or configure localized project setups"
  },
  subCommands: {
    init: mcpInit
  },
  async run({ rawArgs }) {
    // If running "blockend mcp" directly without target subcommands, default to spinning up transport stream
    if (rawArgs.length === 0) {
      await mcpStartCommand();
    }
  }
});
const init = defineCommand({
  meta: {
    name: "init",
    description: "Initialize Blockend configuration profile (blockend.json)"
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      default: false,
      description: "Skip initialization questions and auto-enforce layout defaults"
    },
    json: {
      type: "boolean",
      default: false,
      description: "Output machine-readable configuration write states"
    }
  },
  async run({ args }) {
    await initCommand({ yes: args.yes, json: args.json });
  }
});
const list = defineCommand({
  meta: {
    name: "list",
    description:
      "List available component blocks matching local project runtime environment context"
  },
  args: {
    json: {
      type: "boolean",
      default: false,
      description: "Output machine-readable blocks configuration array stream"
    }
  },
  async run({ args }) {
    await listCommand({ json: args.json });
  }
});
const add = defineCommand({
  meta: {
    name: "add",
    description: "Inject a production-grade component block straight into your codebase"
  },
  args: {
    block: {
      type: "positional",
      required: false,
      description: "Target block key name from the remote repository registry"
    },
    yes: {
      type: "boolean",
      alias: "y",
      default: false,
      description: "Skip structural modification confirmations and force dependency downloads"
    },
    json: {
      type: "boolean",
      default: false,
      description: "Output streaming machine-readable JSON payloads for automation systems"
    }
  },
  async run({ args }) {
    await addCommand(args.block, { yes: args.yes, json: args.json });
  }
});

const detect = defineCommand({
  meta: {
    name: "detect",
    description: "Scan runtime directory frameworks, engines, and workspaces architectures"
  },
  args: {
    json: {
      type: "boolean",
      default: false,
      description: "Output full detected project workspace context delta maps directly as JSON"
    }
  },
  async run({ args }) {
    await detectCommand({ json: args.json });
  }
});

const main = defineCommand({
  meta: {
    name: "blockend",
    version: "0.1.0",
    description:
      "Blockend CLI - Core architectural blocks straight into your repository layout primitives"
  },
  subCommands: { init, add, detect, list, mcp }
});

runMain(main);
