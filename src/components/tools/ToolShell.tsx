import Link from "next/link";
import type { ReactNode } from "react";
import type { ToolMeta } from "@core/registry";
import { toolPath } from "@core/registry";
import s from "./tools.module.css";

/** Page frame: breadcrumb, H1, one-sentence answer, widget slot, content slots (section 9, items 1-3). */
export function ToolShell({
  tool,
  answer,
  widget,
  children,
}: {
  tool: ToolMeta;
  answer: ReactNode;
  widget: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className={s.shell}>
      <nav aria-label="Breadcrumb" className={s.breadcrumb}>
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/tools/">Tools</Link>
          </li>
          <li>
            <Link href={toolPath(tool.slug)} aria-current="page">
              {tool.name}
            </Link>
          </li>
        </ol>
      </nav>
      <h1 className={s.h1}>{tool.h1}</h1>
      <p className={s.answer}>{answer}</p>
      <section aria-labelledby="calculator-h" className={s.panel}>
        {/* Keeps heading order h1 > h2 > h3 for the widget's own h3s. */}
        <h2 id="calculator-h" className={s.visuallyHidden}>
          Calculator
        </h2>
        {widget}
      </section>
      {children}
    </main>
  );
}

/** A titled content section; the first sentence of each should answer its heading (section 13.4). */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={s.section}>
      <h2 id={`${id}-h`}>{title}</h2>
      {children}
    </section>
  );
}
