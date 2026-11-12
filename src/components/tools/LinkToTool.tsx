"use client";

import { useId, useState } from "react";
import { track } from "./analytics";
import s from "./tools.module.css";

/** Copyable HTML link + citation line. Earns backlinks (sections 8, 13.5). */
export function LinkToTool({ slug, name, url }: { slug: string; name: string; url: string }) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  const snippet = `<a href="${url}">${name}</a> by Pack Legacy`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      track({ name: "link_copied", slug });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the textarea stays selectable for manual copy.
    }
  }

  return (
    <div className={s.snippet}>
      <label htmlFor={id}>
        <strong>Link to this tool</strong>
      </label>
      <textarea
        id={id}
        readOnly
        rows={2}
        value={snippet}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" className={s.buttonSecondary} onClick={copy}>
        {copied ? "Copied" : "Copy HTML"}
      </button>
      <span role="status" className={s.visuallyHidden}>
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
