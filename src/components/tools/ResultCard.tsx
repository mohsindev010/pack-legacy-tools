import type { ReactNode } from "react";
import type { Flag } from "@core/lib/result";
import s from "./tools.module.css";

/**
 * Headline answer + secondary values. aria-live="polite" so screen readers hear
 * updates. Has no hooks, so it renders in server and client trees alike.
 */
export function ResultCard({
  label = "Result",
  headline,
  values = [],
  flags = [],
  children,
}: {
  label?: string;
  headline: ReactNode;
  values?: { label: string; value: ReactNode }[];
  flags?: Flag[];
  children?: ReactNode;
}) {
  return (
    <div className={s.result} aria-live="polite" aria-atomic="true">
      <p className={s.resultLabel}>{label}</p>
      <p className={s.resultHeadline}>{headline}</p>
      {values.length > 0 && (
        <dl className={s.resultGrid}>
          {values.map((v) => (
            <div key={v.label}>
              <dt>{v.label}</dt>
              <dd>{v.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <FlagList flags={flags} />
      {children}
    </div>
  );
}

export function FlagList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className={s.flags}>
      {flags.map((f, i) => (
        <li
          key={`${f.code}-${i}`}
          className={`${s.flag} ${s[`flag_${f.level}`]}`}
          data-code={f.code}
        >
          <strong>
            {f.level === "error" ? "Error: " : f.level === "warn" ? "Check: " : "Note: "}
          </strong>
          {f.message}
        </li>
      ))}
    </ul>
  );
}
