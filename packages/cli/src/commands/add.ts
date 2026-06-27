/* eslint-disable no-console */
import path, { join } from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import { intro, outro, select, spinner, confirm, isCancel } from "@clack/prompts";
import pc from "picocolors";
import { configPayloadType } from "./init.js";

interface BlockendExtendedConfig extends configPayloadType {
  redisEnabled?: boolean;
}

const REPO_OWNER = "codewithnuh";
const REPO_NAME = "blockend";
const BRANCH = "master";
const LOCAL_DEV_URL = "http://localhost:5000";

const RAW_CDN_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;
const MANIFEST_URL = `${RAW_CDN_BASE}/registry/index.json`;

interface VariantConfig {
  dependencies: string[];
  path: string;
}

interface EnvironmentConfig {
  core: string;
  variants?: {
    [variantKey: string]: VariantConfig;
  };
  dependencies?: string[];
}

interface RegistryManifest {
  [blockKey: string]: {
    name: string;
    description: string;
    environments: {
      express?: EnvironmentConfig;
      fastify?: EnvironmentConfig;
      hono?: EnvironmentConfig;
      next?: EnvironmentConfig;
    };
  };
}

interface LocalPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function handleCancel(value: unknown) {
  if (isCancel(value)) {
    outro(pc.yellow("⚠ Operation cancelled. Exiting Blockend CLI cleanly."));
    process.exit(0);
  }
}

export async function addCommand(blockName: string | undefined) {
  intro(pc.bgBlack(pc.magenta(" Blockend Component Ingestion ")));
  const cwd = process.cwd();

  // 1. Read and Parse blockend.json
  const configPath = join(cwd, "blockend.json");
  let config: BlockendExtendedConfig;

  try {
    const configFile = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(configFile) as BlockendExtendedConfig;
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
      label: `${key} - ${pc.dim(registry[key].description)}`
    }));

    if (availableOptions.length === 0) {
      outro(pc.yellow("⚠ The remote block registry is currently empty."));
      return;
    }

    const selectBlockPrompt = await select({
      message: "Which backend block would you like to inject?",
      options: availableOptions
    });
    handleCancel(selectBlockPrompt);
    targetBlock = selectBlockPrompt as string;
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
      pc.red(`✖ The block "${targetBlock}" does not support your environment layout: ${envKey}`)
    );
    return;
  }

  // Determine and resolve the storage variant dynamically
  let selectedVariant: string | undefined;
  let variantMeta: VariantConfig | undefined = undefined;

  if (envConfig.variants && Object.keys(envConfig.variants).length > 0) {
    const variantKeys = Object.keys(envConfig.variants);

    if (variantKeys.includes("redis") && config.redisEnabled) {
      selectedVariant = "redis";
    } else {
      const selectVariantPrompt = await select({
        message: "Which architectural storage variant do you want to back this block?",
        options: variantKeys.map((vKey) => ({
          value: vKey,
          label: vKey.toUpperCase()
        }))
      });
      handleCancel(selectVariantPrompt);
      selectedVariant = selectVariantPrompt as string;
    }
    variantMeta = envConfig.variants[selectedVariant];
  }

  // 5. Automated Missing Dependency Detection (Aggregating Core + Variant)
  let packageJson: LocalPackageJson;
  try {
    packageJson = JSON.parse(
      await fs.readFile(join(cwd, "package.json"), "utf-8")
    ) as LocalPackageJson;
  } catch {
    outro(pc.red("✖ Could not locate package.json in your current workspace directory."));
    return;
  }

  const installedDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {})
  };

  const allRequiredDeps = [...(envConfig.dependencies ?? []), ...(variantMeta?.dependencies ?? [])];
  const missingDeps = allRequiredDeps.filter((dep) => !(dep in installedDeps));

  if (missingDeps.length > 0) {
    console.log(
      pc.yellow(`\n⚠️ Missing required infrastructure packages: ${missingDeps.join(", ")}`)
    );
    const shouldInstallPrompt = await confirm({
      message: "Would you like the CLI to automatically install these dependencies?",
      initialValue: true
    });
    handleCancel(shouldInstallPrompt);

    if (shouldInstallPrompt) {
      // Look up and determine active layout file systems
      const packageManager = await fs
        .access(join(cwd, "pnpm-lock.yaml"))
        .then(() => "pnpm")
        .catch(() => "npm");

      s.start(`Preparing native workspace via ${packageManager}...`);
      try {
        const installCmd =
          packageManager === "pnpm"
            ? `pnpm add ${missingDeps.join(" ")}`
            : `npm install ${missingDeps.join(" ")}`;

        s.stop(pc.cyan(`Executing: ${installCmd}\n`));

        // Use standard non-blocking exec loop streams to print direct lines out cleanly
        await new Promise<void>((resolve, reject) => {
          const child = exec(installCmd, { cwd });

          child.stdout?.on("data", (data: string) => {
            process.stdout.write(pc.dim(data));
          });

          child.stderr?.on("data", (data: string) => {
            process.stdout.write(pc.dim(pc.red(data)));
          });

          child.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Exit code ${code}`));
          });
        });

        console.log(""); // Clean carriage space jump
        s.start(pc.green("✔ Dependencies installed cleanly. Continuing components build..."));
        s.stop();
      } catch {
        s.stop(pc.red("✖ Automated dependency installation failed. Please run setup manually."));
      }
    }
  }

  // 6. Ingest Remote Code Block Streams (.txt sources)
  s.start(`Downloading clean production template block [${targetBlock}]...`);

  try {
    const BASE_URL = MANIFEST_URL.includes("localhost") ? LOCAL_DEV_URL : RAW_CDN_BASE;

    // Fetch core middleware payload
    const coreFileUrl = `${BASE_URL}/${envConfig.core}`;
    const coreFetchResponse = await fetch(coreFileUrl);
    if (!coreFetchResponse.ok) {
      throw new Error(`Failed downloading core component file: ${coreFetchResponse.statusText}`);
    }
    const coreCodeTemplate = await coreFetchResponse.text();

    // SAFETY CHECK: Target physical path configurations
    let physicalPath = config.paths.blocks;
    if (physicalPath.startsWith("@")) {
      physicalPath = "./src/blocks";
    }

    // Set up targeted folder path. If variants exist, wrap files inside a dedicated component folder!
    let targetFolder = path.resolve(cwd, physicalPath);
    if (variantMeta && selectedVariant) {
      targetFolder = join(targetFolder, targetBlock);
    }
    await fs.mkdir(targetFolder, { recursive: true });

    const fileExtension = config.language === "typescript" ? "ts" : "js";

    // Write out the core base framework file cleanly
    const coreOutputFilename = `${targetBlock}.${fileExtension}`;
    await fs.writeFile(join(targetFolder, coreOutputFilename), coreCodeTemplate, "utf-8");

    // If variant data is active, write it to its own file inside the same isolated folder
    if (variantMeta && selectedVariant) {
      const variantFileUrl = `${BASE_URL}/${variantMeta.path}`;
      const variantFetchResponse = await fetch(variantFileUrl);
      if (!variantFetchResponse.ok) {
        throw new Error(
          `Failed downloading storage variant file: ${variantFetchResponse.statusText}`
        );
      }
      const variantCodeTemplate = await variantFetchResponse.text();

      const variantOutputFilename = `store-${selectedVariant}.${fileExtension}`;
      await fs.writeFile(join(targetFolder, variantOutputFilename), variantCodeTemplate, "utf-8");
    }

    const cleanDisplayPath =
      variantMeta && selectedVariant
        ? `${physicalPath.replace(/\\/g, "/")}/${targetBlock}`
        : physicalPath.replace(/\\/g, "/");

    s.stop(pc.green("✔ Component isolation structures written smoothly."));
    outro(
      pc.cyan(
        `✨ Source blocks written to ${cleanDisplayPath}/ layout. Code ownership transferred!`
      )
    );
  } catch (error) {
    s.stop(pc.red("✖ Fatal crash occurred while downloading or transferring file layouts."));
    console.error(error);
  }
}
