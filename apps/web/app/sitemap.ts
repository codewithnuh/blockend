import type { MetadataRoute } from "next";

import { source } from "@/lib/source";

const BASE_URL = "https://blockend.noorulhassan.com";

function getPriority(url: string): number {
  if (url === "/docs") return 0.98;
  return 0.99;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages();

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1
    },

    ...pages.map((page) => ({
      url: `${BASE_URL}${page.url}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: getPriority(page.url)
    }))
  ];
}
