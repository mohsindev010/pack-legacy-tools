import type { MetadataRoute } from "next";
import { allTools, toolPath } from "@core/registry";
import { absoluteUrl, LAB_MODE } from "@/src/seo/site";

// Generated from the registry (principle 7). In production only live tools are
// listed; the lab lists everything (it is noindex anyway).
export default function sitemap(): MetadataRoute.Sitemap {
  const tools = allTools().filter((t) => LAB_MODE || t.status === "live");
  const latest = tools
    .map((t) => t.updated)
    .sort()
    .at(-1);
  return [
    {
      url: absoluteUrl("/tools/"),
      lastModified: latest,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...tools.map((t) => ({
      url: absoluteUrl(toolPath(t.slug)),
      lastModified: t.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
