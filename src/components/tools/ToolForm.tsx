"use client";

import type { ReactNode } from "react";
import f from "./form.module.css";

/** Form wrapper: results are live, so submit (Enter key) never reloads the page. */
export function ToolForm({ label, children }: { label: string; children: ReactNode }) {
  return (
    <form aria-label={label} className={f.form} onSubmit={(e) => e.preventDefault()} noValidate>
      {children}
    </form>
  );
}
