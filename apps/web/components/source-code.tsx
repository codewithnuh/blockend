import fs from "fs/promises";
import path from "path";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";

export async function SourceCode({ file }: { file: string }) {
  const BLOCKS_ROOT = path.join(process.cwd(), "../../blocks");
  const fullPath = path.resolve(BLOCKS_ROOT, file);

  if (!fullPath.startsWith(BLOCKS_ROOT)) {
    throw new Error("Invalid file path");
  }
  const code = await fs.readFile(fullPath, "utf8");

  return <ServerCodeBlock lang="ts" code={code} />;
}
