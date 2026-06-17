#!/usr/bin/env node
/* eslint-disable no-console */
import { Command } from "commander";
import { intro, outro, select } from "@clack/prompts";
import pc from "picocolors";
import { initCommand } from "./commands/init.js";

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
  .description("Add a backend block to your project")
  .action(async (block) => {
    intro(pc.bgBlack(pc.magenta(" Blockend Add Tool ")));

    if (!block) {
      const selectedBlock = await select({
        message: "Which backend block would you like to add?",
        options: [
          { value: "rate-limiter", label: "rate-limiter (Redis/Memory)" },
          { value: "auth-handler", label: "auth-handler (JWT/Session)" },
          { value: "error-handler", label: "global-error-handler" }
        ]
      });
      block = selectedBlock;
    }

    console.log(pc.yellow(`\n[Mock Run]: Fetching metadata manifest for "${block}"...`));
    console.log(pc.green(`✔ [Mock Run]: Injected missing dependencies into your package context.`));
    console.log(pc.green(`✔ [Mock Run]: Written file cleanly into your target blocks path.`));

    outro(pc.magenta(`Successfully added ${block} block!`));
  });

program.parse(process.argv);
