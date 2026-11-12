import type { Metadata } from "next";
import Link from "next/link";
import { allTools, toolPath, type ToolCategory } from "@core/registry";
import { JsonLd } from "@/src/components/tools/JsonLd";
import { breadcrumbs, organization } from "@/src/seo/schema";
import s from "@/src/components/tools/tools.module.css";

export const metadata: Metadata = {
  title: { absolute: "Free Packaging Tools & Calculators | Pack Legacy" },
  description:
    "Free packaging tools: dimensional weight, box sizes, paper weight, QR and barcode generators, pallet and container load calculators.",
  alternates: { canonical: "/tools/" },
};

const CATEGORY_LABEL: Record<ToolCategory, string> = {
  "size-and-ship": "Size and ship",
  material: "Materials",
  "print-and-label": "Print and label",
  "bags-and-storage": "Bags and storage",
};

export default function ToolsHub() {
  const tools = allTools();
  const categories = Object.keys(CATEGORY_LABEL) as ToolCategory[];
  return (
    <main className={s.shell}>
      <JsonLd
        data={[
          organization(),
          breadcrumbs([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/tools/" },
          ]),
        ]}
      />
      <h1 className={s.h1}>Free Packaging Tools</h1>
      <p className={s.answer}>
        Each tool answers one packaging question with current carrier, GS1 and ISO rules, shows its
        working, and can send its result straight into a quote request.
      </p>
      {categories.map((cat) => {
        const list = tools.filter((t) => t.category === cat);
        if (list.length === 0) return null;
        return (
          <section key={cat} className={s.section} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`}>{CATEGORY_LABEL[cat]}</h2>
            <ul className={s.cards}>
              {list.map((t) => (
                <li key={t.slug}>
                  <Link href={toolPath(t.slug)} className={s.card} data-testid="tool-card">
                    {t.status !== "live" && <span className={s.badge}>{t.status}</span>}
                    <p className={s.cardTitle}>{t.name}</p>
                    <p className={s.cardQuestion}>{t.question}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
