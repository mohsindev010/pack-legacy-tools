import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LAB_MODE } from "@/src/seo/site";
import { MockQuoteForm } from "./MockQuoteForm";
import s from "@/src/components/tools/tools.module.css";

export const metadata: Metadata = {
  title: "Quote form test",
  robots: { index: false, follow: false },
};

// Lab-only mock of the Pack Legacy quote form (section 14.1, step 4): shows
// exactly what a tool would pre-fill. It never submits anywhere.
export default function QuoteTestPage() {
  if (!LAB_MODE) notFound();
  return (
    <main className={s.shell}>
      <h1 className={s.h1}>Quote form pre-fill test</h1>
      <p className={s.answer}>
        Mirrors the fields of the Pack Legacy homepage quote form. Nothing is submitted.
      </p>
      <MockQuoteForm />
    </main>
  );
}
