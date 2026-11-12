import type { ReactNode } from "react";
import s from "./tools.module.css";

export type FaqItem = { q: string; a: string; body?: ReactNode };

/**
 * Accessible accordion built on <details>, so answers are in the HTML and work
 * without JavaScript. The same items feed FAQPage JSON-LD (use `a` there).
 */
export function FAQ({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className={s.faq}>
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <div>{f.body ?? <p>{f.a}</p>}</div>
        </details>
      ))}
    </div>
  );
}
