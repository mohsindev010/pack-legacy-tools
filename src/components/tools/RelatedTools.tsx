import Link from "next/link";
import { relatedProducts, relatedTools, toolPath } from "@core/registry";
import s from "./tools.module.css";

/** Internal links from the registry; never hand-typed. */
export function RelatedTools({ slug }: { slug: string }) {
  const list = relatedTools(slug);
  if (list.length === 0) return null;
  return (
    <ul className={s.cards}>
      {list.map((t) => (
        <li key={t.slug}>
          <Link href={toolPath(t.slug)} className={s.card}>
            <p className={s.cardTitle}>{t.name}</p>
            <p className={s.cardQuestion}>{t.question}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RelatedProducts({ slug }: { slug: string }) {
  const list = relatedProducts(slug);
  if (list.length === 0) return null;
  return (
    <ul className={s.cards}>
      {list.map((p) => (
        <li key={p.href}>
          <a href={p.href} className={s.card}>
            <p className={s.cardTitle}>{p.label}</p>
          </a>
        </li>
      ))}
    </ul>
  );
}
