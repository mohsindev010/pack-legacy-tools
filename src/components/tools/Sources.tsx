import { rulesSummary } from "@core/rules";
import s from "./tools.module.css";

export type SourceItem = { source: string; sourceUrl: string };

/** Numbered source list: every rule source for the tool plus any extra content sources. */
export function Sources({
  rulesFiles,
  extra = [],
}: {
  rulesFiles: string[];
  extra?: SourceItem[];
}) {
  const seen = new Set<string>();
  const items = [...rulesSummary(rulesFiles).sources, ...extra].filter((it) => {
    if (seen.has(it.source)) return false;
    seen.add(it.source);
    return true;
  });
  if (items.length === 0) return null;
  return (
    <ol className={s.sources}>
      {items.map((it) => (
        <li key={it.source}>
          {it.sourceUrl ? (
            <a href={it.sourceUrl} rel="noopener nofollow" target="_blank">
              {it.source}
            </a>
          ) : (
            <>
              {it.source} <span className={s.muted}>(source link pending)</span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
