#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";

const program = new Command();

program
  .name("blockend")
  .description("Zero-dependency production backend blocks CLI")
  .version("0.1.0");

// --- INIT COMMAND ---
program
  .command("init")
  .description("Initialize blockend configuration in your project")
  .action(async () => await initCommand());

// --- ADD COMMAND ---
program
  .command("add [block]")
  .description("Inject unstyled, clean backend blocks directly into code paths")
  .action(async (block) => {
    await addCommand(block);
  });

program.parse(process.argv);
