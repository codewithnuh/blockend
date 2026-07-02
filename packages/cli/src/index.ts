#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { addCommand } from "./commands/add.js";
import { initCommand } from "./commands/init.js";
import { detectCommand } from "./commands/detect.js";

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
  subCommands: { init, add, detect }
});

runMain(main);
