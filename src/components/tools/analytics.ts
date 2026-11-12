// Analytics events (section 18.2). Provider is undecided (GA4 vs Vercel Web
// Analytics, section 22.1 item 3), so this forwards to gtag when present and
// otherwise does nothing. Swap the body once the choice is made.

export type ToolEvent =
  | { name: "tool_view"; slug: string }
  | { name: "tool_calculated"; slug: string; inputsHash: string }
  | { name: "tool_unit_toggled"; slug: string; unit: string }
  | { name: "quote_clicked"; slug: string }
  | { name: "link_copied"; slug: string }
  | { name: "file_downloaded"; slug: string; format: string };

type Gtag = (cmd: "event", name: string, params: Record<string, unknown>) => void;

export function track(event: ToolEvent): void {
  if (typeof window === "undefined") return;
  const { name, ...params } = event;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (gtag) gtag("event", name, params);
  else if (process.env.NODE_ENV === "development") console.debug("[track]", name, params);
}

/** Short stable hash of the inputs, so events never carry raw user data. */
export function hashInputs(input: unknown): string {
  const str = JSON.stringify(input) ?? "";
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
