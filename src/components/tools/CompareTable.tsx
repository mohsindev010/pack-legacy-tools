import type { ReactNode } from "react";
import s from "./tools.module.css";

export type Column = { key: string; label: string };

/** Side-by-side carriers or candidate boxes. Highlights the best row. */
export function CompareTable({
  caption,
  columns,
  rows,
  highlightRow,
  rowHeader = true,
}: {
  caption?: string;
  columns: Column[];
  rows: Record<string, ReactNode>[];
  highlightRow?: number;
  /** Render the first column as a row header (<th scope="row">). */
  rowHeader?: boolean;
}) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i === highlightRow ? s.highlight : undefined}>
              {columns.map((c, j) =>
                j === 0 && rowHeader ? (
                  <th key={c.key} scope="row">
                    {r[c.key]}
                  </th>
                ) : (
                  <td key={c.key}>{r[c.key]}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
