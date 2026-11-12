import { allTools, toolPath } from "@core/registry";
import { absoluteUrl, LAB_MODE } from "@/src/seo/site";

// Tool list for AI crawlers (section 13.5), generated from the registry.
export function GET() {
  const tools = allTools().filter((t) => LAB_MODE || t.status === "live");
  const lines = [
    "# Pack Legacy free packaging tools",
    "",
    "> Free calculators and generators for packaging buyers. Each tool shows its working, the rule it follows and that rule's effective date. A JSON API is available at /api/tools/<slug>/ with the same inputs as the page.",
    "",
    "## Tools",
    "",
    ...tools.map(
      (t) => `- [${t.h1}](${absoluteUrl(toolPath(t.slug))}): ${t.question} ${t.description}`,
    ),
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
