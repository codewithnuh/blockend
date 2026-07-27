import fs from "fs/promises";
import path from "path";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";

export async function SourceCode({ file }: { file: string }) {
  const root = path.resolve(process.cwd(), "../..");
  const fullPath = path.join(root, file);

  const code = await fs.readFile(fullPath, "utf8");

  return <ServerCodeBlock lang="ts" code={code} />;
}
