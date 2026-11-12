// Quote form hand-off (section 14.1). Shared by QuoteCTA (writer) and the quote
// form (reader): the lab mock at /quote-test/ now, the Pack Legacy form after merge.

export const PREFILL_KEY = "pl_tool_prefill";
/** Pre-fills older than this are ignored (stale tab, back button days later). */
export const PREFILL_MAX_AGE_MS = 60 * 60 * 1000;

export type QuoteUnit = "inches" | "cm" | "mm";

export type QuotePrefill = {
  tool: string; // slug, also sent as hidden field tool_source
  l?: number;
  w?: number;
  h?: number;
  unit?: QuoteUnit;
  material?: string;
  details: string;
  createdAt: number;
};

export function writePrefill(p: Omit<QuotePrefill, "createdAt">): void {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ ...p, createdAt: Date.now() }));
  } catch {
    // Storage blocked (private mode, policy): the quote form simply opens empty.
  }
}

/** Read once, then delete (fills empty fields only; the form decides that). */
export function takePrefill(now = Date.now()): QuotePrefill | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    sessionStorage.removeItem(PREFILL_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as QuotePrefill;
    if (typeof p?.tool !== "string" || typeof p.createdAt !== "number") return null;
    if (now - p.createdAt > PREFILL_MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}
