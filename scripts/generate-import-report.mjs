import { promises as fs } from "fs";
import path from "path";

const BLOCKS_DIR = "./blocks"; // Change if needed
const OUTPUT = "./imports-report.md";

const IMPORT_REGEX = /^\s*import(?:["'\s\S]*?from\s*)?["']([^"']+)["'];?/gm;

const REQUIRE_REGEX = /require\s*\(\s*["']([^"']+)["']\s*\)/gm;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
      continue;
    }

    if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) {
      files.push(full);
    }
  }

  return files;
}

function extractImports(code) {
  const external = new Set();
  const internal = new Set();

  for (const regex of [IMPORT_REGEX, REQUIRE_REGEX]) {
    regex.lastIndex = 0;

    let match;

    while ((match = regex.exec(code))) {
      const mod = match[1];

      if (mod.startsWith(".") || mod.startsWith("/")) {
        internal.add(mod);
      } else {
        external.add(mod);
      }
    }
  }

  return {
    external: [...external].sort(),
    internal: [...internal].sort()
  };
}

async function main() {
  const files = await walk(BLOCKS_DIR);

  let md = `# Block Import Report

Generated: ${new Date().toLocaleString()}

Total Files: ${files.length}

---

`;

  for (const file of files.sort()) {
    const relative = path.relative(BLOCKS_DIR, file);

    const code = await fs.readFile(file, "utf8");

    const { external, internal } = extractImports(code);

    md += `## ${relative}

`;

    md += `**External Packages**

`;

    if (external.length) {
      for (const pkg of external) {
        md += `- ${pkg}\n`;
      }
    } else {
      md += "- None\n";
    }

    md += `

**Internal Imports**

`;

    if (internal.length) {
      for (const imp of internal) {
        md += `- ${imp}\n`;
      }
    } else {
      md += "- None\n";
    }

    md += `

---

`;
  }

  await fs.writeFile(OUTPUT, md);

  console.log(`✓ Report written to ${OUTPUT}`);
}

main().catch(console.error);
