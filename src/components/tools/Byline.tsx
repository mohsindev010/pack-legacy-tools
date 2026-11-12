import type { ToolMeta } from "@core/registry";

/** Author, role, updated date. Feeds the Person/Organization schema. */
export function Byline({ tool }: { tool: ToolMeta }) {
  const { author } = tool;
  return (
    <p>
      By <a href={author.url}>{author.name}</a>
      {author.role && author.role !== "TBD" ? `, ${author.role}` : ""}. Updated{" "}
      <time dateTime={tool.updated}>{formatDate(tool.updated)}</time>.
    </p>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
