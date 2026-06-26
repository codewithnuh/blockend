/* eslint-disable no-console */
import path, { join } from "path";
import fs from "fs/promises";
import { execSync } from "child_process";
import { intro, outro, select, spinner, confirm } from "@clack/prompts";
import pc from "picocolors";
import { configPayloadType } from "./init.js";

// Global Registry CDN Configuration Layouts
const REPO_OWNER = "codewitnuh";
const REPO_NAME = "blockend";
const BRANCH = "master";

const RAW_CDN_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;
const MANIFEST_URL = `${RAW_CDN_BASE}/registry/index.json`;

interface RegistryManifest {
  [blockKey: string]: {
    name: string;
    description: string;
    environments: {
      [envKey in "express" | "fastify" | "hono" | "next"]?: {
        dependencies: string[];
        path: string; // This points to the .txt file on GitHub (e.g. "registry/.../file.ts.txt")
      };
    };
  };
}

export async function addCommand(blockName: string | undefined) {
  intro(pc.bgBlack(pc.magenta(" Blockend Component Ingestion ")));
  const cwd = process.cwd();

  // 1. Read and Parse blockend.json
  const configPath = join(cwd, "blockend.json");
  let config: configPayloadType;

  try {
    const configFile = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(configFile);
  } catch {
    outro(pc.red("✖ blockend.json not found. Run 'npx blockend init' first."));
    return;
  }

  // 2. Dynamic Registry Manifest Retrieval via Network Stream
  const s = spinner();
  s.start("Connecting to remote Blockend Registry manifest...");

  let registry: RegistryManifest;
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
    registry = (await response.json()) as RegistryManifest;
    s.stop(pc.green("✔ Remote manifest synchronization complete."));
  } catch {
    s.stop(pc.red("✖ Failed to fetch the component registry from GitHub network paths."));
    return;
  }

  // 3. Select block dynamically from fetched manifest keys
  let targetBlock = blockName;
  if (!targetBlock) {
    const availableOptions = Object.keys(registry).map((key) => ({
      value: key,
      label: `${key} - pc.dim(${registry[key].description})`
    }));

    if (availableOptions.length === 0) {
      outro(pc.yellow("⚠ The remote block registry is currently empty."));
      return;
    }

    targetBlock = (await select({
      message: "Which backend block would you like to inject?",
      options: availableOptions
    })) as string;
  }

  const blockMeta = registry[targetBlock];
  if (!blockMeta) {
    outro(pc.red(`✖ Block "${targetBlock}" does not exist in the remote registry.`));
    return;
  }

  // 4. Resolve environmental configuration variants
  const envKey = String(config.environment) as "express" | "fastify" | "hono" | "next";
  const envConfig = blockMeta.environments[envKey];
  if (!envConfig) {
    outro(
      pc.red(
        `✖ The block "${targetBlock}" does not support your environment layout: ${String(config.environment)}`
      )
    );
    return;
  }

  // 5. Automated Missing Dependency Detection
  let packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
  };
  try {
    packageJson = JSON.parse(await fs.readFile(join(cwd, "package.json"), "utf-8"));
  } catch {
    outro(pc.red("✖ Could not locate package.json in your current workspace directory."));
    return;
  }

  const installedDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {})
  };
  const missingDeps = envConfig.dependencies.filter((dep) => !(dep in installedDeps));

  if (missingDeps.length > 0) {
    console.log(
      pc.yellow(`\n⚠️ Missing required infrastructure packages: ${missingDeps.join(", ")}`)
    );
    const shouldInstall = await confirm({
      message: "Would you like the CLI to automatically install these dependencies?",
      initialValue: true
    });

    if (shouldInstall) {
      s.start(`Installing dependencies via your native package manager...`);
      try {
        const lockfileCheck = await fs
          .access(join(cwd, "pnpm-lock.yaml"))
          .then(() => "pnpm")
          .catch(() => "npm");
        const installCmd =
          lockfileCheck === "pnpm"
            ? `pnpm add ${missingDeps.join(" ")}`
            : `npm install ${missingDeps.join(" ")}`;

        execSync(installCmd, { stdio: "ignore", cwd });
        s.stop(pc.green("✔ Dependencies installed cleanly."));
      } catch {
        s.stop(pc.red("✖ Automated dependency installation failed. Please run setup manually."));
      }
    }
  }

  // 6. Ingest Remote Code Block String Stream directly from GitHub (.txt source)
  s.start(`Downloading clean production template block [${targetBlock}]...`);

  try {
    // Generates e.g., https://raw.githubusercontent.com/.../express-error.ts.txt
    const targetFileUrl = `${RAW_CDN_BASE}/${envConfig.path}`;
    const codeFetchResponse = await fetch(targetFileUrl);

    if (!codeFetchResponse.ok) {
      throw new Error(`Failed downloading component source file: ${codeFetchResponse.statusText}`);
    }

    // Grabs the content from GitHub as a raw, clean text string
    const targetCodeTemplate = await codeFetchResponse.text();

    // SAFETY CHECK: Target physical path only to prevent creating folders named '@'
    let physicalPath = config.paths.blocks;

    if (physicalPath.startsWith("@")) {
      physicalPath = "./src/blocks";
    }

    const targetFolder = path.resolve(cwd, physicalPath);
    await fs.mkdir(targetFolder, { recursive: true });

    // THE MAGIC STEP: Even though we fetched a .txt file, we write it back to the
    // client's machine as a fully working .ts or .js file depending on their config language!
    const fileExtension = config.language === "typescript" ? "ts" : "js";
    const outputFilename = `${targetBlock}.${fileExtension}`;

    await fs.writeFile(join(targetFolder, outputFilename), targetCodeTemplate, "utf-8");

    const cleanDisplayPath = physicalPath.replace(/\\/g, "/");

    s.stop(pc.green(`✔ ${outputFilename} successfully injected into codebase.`));
    outro(
      pc.cyan(
        `✨ Source blocks written to ${cleanDisplayPath}/${outputFilename}. Code ownership transferred!`
      )
    );
  } catch (error) {
    s.stop(pc.red("✖ Fatal crash occurred while downloading or transferring file layouts."));
    console.error(error);
  }
}
