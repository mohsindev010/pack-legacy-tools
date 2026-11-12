"use client";

import { track } from "./analytics";
import { writePrefill, type QuotePrefill } from "./quote";
import s from "./tools.module.css";

/** "Quote this size" button: passes the result to the quote form (section 14). */
export function QuoteCTA({
  prefill,
  label = "Get a quote for this size",
}: {
  prefill: Omit<QuotePrefill, "createdAt">;
  label?: string;
}) {
  const quoteUrl = process.env.NEXT_PUBLIC_QUOTE_URL ?? "/quote-test/";
  return (
    <a
      href={quoteUrl}
      className={s.button}
      onClick={() => {
        writePrefill(prefill);
        track({ name: "quote_clicked", slug: prefill.tool });
      }}
    >
      {label}
    </a>
  );
}
