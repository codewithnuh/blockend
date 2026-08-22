#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { addCommand } from "./commands/add.js";
import { initCommand } from "./commands/init.js";
import { detectCommand } from "./commands/detect.js";
import { listCommand } from "./commands/list.js";
import { mcpInitCommand, mcpStartCommand } from "./commands/mcp.js";
import { diffCommand } from "./commands/diff.js";
import { doctorCommand } from "./commands/doctor.js";
import { updateCommand } from "./commands/update.js";
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
    },
    multi: {
      type: "boolean",
      alias: "m",
      default: false,
      description: "Select and add multiple blocks at once via interactive multiselect"
    }
  },
  async run({ args }) {
    await addCommand(args.block, { yes: args.yes, json: args.json, multi: args.multi });
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

const diff = defineCommand({
  meta: {
    name: "diff",
    description: "Preview generated files for a block without writing to disk"
  },
  args: {
    block: {
      type: "positional",
      required: true,
      description: "Block name to preview"
    },
    json: {
      type: "boolean",
      default: false,
      description: "Output diff results as JSON"
    }
  },
  async run({ args }) {
    await diffCommand(args.block, { json: args.json });
  }
});

const doctor = defineCommand({
  meta: {
    name: "doctor",
    description: "Detect configuration and project issues affecting Blockend"
  },
  args: {
    json: {
      type: "boolean",
      default: false,
      description: "Output health check results as JSON"
    }
  },
  async run({ args }) {
    await doctorCommand({ json: args.json });
  }
});

const update = defineCommand({
  meta: {
    name: "update",
    description: "Compare installed blocks with newer available versions and show diffs"
  },
  args: {
    json: {
      type: "boolean",
      default: false,
      description: "Output update status as JSON"
    },
    diff: {
      type: "boolean",
      default: true,
      description: "Show git-diff style file comparison for blocks with updates"
    },
    apply: {
      type: "boolean",
      default: false,
      description: "Select blocks to update (multiselect) and apply updates with import rewriting"
    }
  },
  async run({ args }) {
    await updateCommand({ json: args.json, diff: args.diff, apply: args.apply });
  }
});

const main = defineCommand({
  meta: {
    name: "blockend",
    version: "0.1.0",
    description:
      "Blockend CLI - Core architectural blocks straight into your repository layout primitives"
  },
  subCommands: { init, add, detect, list, diff, doctor, update, mcp }
});

runMain(main);
