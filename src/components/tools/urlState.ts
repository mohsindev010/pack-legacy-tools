// Shareable state (principle 8): inputs mirrored in the query string.
// Widgets read the URL after mount instead of useSearchParams, so the whole
// widget prerenders with the default example and hydrates without a Suspense
// fallback swap (Next 16 cacheComponents behaviour).

export function readQuery(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

/** Replace the query string without navigation or scroll. Empty values are dropped. */
export function writeQuery(q: Record<string, string | undefined>): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") params.set(k, v);
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, "", url);
  }
}
