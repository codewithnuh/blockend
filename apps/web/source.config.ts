import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { metaSchema } from "fumadocs-core/source/schema";
import { z } from "zod";

const docStatusSchema = z.enum(["new", "experimental", "validated", "field-tested", "audited"]);

const docsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  full: z.boolean().optional(),
  status: docStatusSchema.optional()
});

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: docsSchema,
    postprocess: {
      includeProcessedMarkdown: true
    }
  },
  meta: {
    schema: metaSchema
  }
});

export default defineConfig({
  mdxOptions: {
    // MDX options
  }
});
