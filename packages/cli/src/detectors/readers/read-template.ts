import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export async function readTemplate(blockName: string): Promise<string> {
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    const cliRootDir = dirname(dirname(currentFilePath));
    const templatePath = join(cliRootDir, "templates", blockName, "index.template.ts");
    const rawTemplateContent = await readFile(templatePath, "utf-8");
    return rawTemplateContent;
  } catch (error) {
    if (error instanceof Error) {
      return `❌ Failed to read template for block "${blockName}": ${error.message}`;
    }
    return `❌ Failed to read template for block "${blockName}"`;
  }
}
