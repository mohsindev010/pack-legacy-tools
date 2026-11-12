"use client";

import { useEffect, useState } from "react";
import { takePrefill, type QuotePrefill } from "@/src/components/tools/quote";
import f from "@/src/components/tools/form.module.css";
import s from "@/src/components/tools/tools.module.css";

type Fields = {
  material: string;
  length: string;
  width: string;
  height: string;
  unit: string;
  details: string;
  tool_source: string;
};

const EMPTY: Fields = {
  material: "",
  length: "",
  width: "",
  height: "",
  unit: "inches",
  details: "",
  tool_source: "",
};

/** Fill empty fields only (section 14.1, step 2). */
function applyPrefill(current: Fields, p: QuotePrefill): Fields {
  const pick = (cur: string, next: string | number | undefined) =>
    cur === "" && next !== undefined ? String(next) : cur;
  return {
    material: pick(current.material, p.material),
    length: pick(current.length, p.l),
    width: pick(current.width, p.w),
    height: pick(current.height, p.h),
    unit: p.unit ?? current.unit,
    details: pick(current.details, p.details),
    tool_source: p.tool,
  };
}

export function MockQuoteForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [received, setReceived] = useState<QuotePrefill | null | undefined>(undefined);

  useEffect(() => {
    const p = takePrefill();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser-only storage on mount
    setReceived(p);
    if (p) setFields((cur) => applyPrefill(cur, p));
  }, []);

  const field = (key: keyof Fields, label: string) => (
    <div className={f.field}>
      <label className={f.label} htmlFor={`q-${key}`}>
        {label}
      </label>
      <div className={f.inputWrap}>
        <input
          id={`q-${key}`}
          className={f.input}
          value={fields[key]}
          onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className={f.widget}>
      <form className={f.form} onSubmit={(e) => e.preventDefault()} aria-label="Mock quote form">
        {field("material", "Material Options")}
        <div className={f.fieldRow}>
          {field("length", "Length")}
          {field("width", "Width")}
          {field("height", "Height")}
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="q-unit">
            Unit
          </label>
          <select
            id="q-unit"
            className={f.select}
            value={fields.unit}
            onChange={(e) => setFields({ ...fields, unit: e.target.value })}
          >
            <option value="inches">inches</option>
            <option value="cm">cm</option>
            <option value="mm">mm</option>
          </select>
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="q-details">
            Project Details
          </label>
          <textarea
            id="q-details"
            className={f.select}
            rows={4}
            value={fields.details}
            onChange={(e) => setFields({ ...fields, details: e.target.value })}
          />
        </div>
        <input type="hidden" name="tool_source" value={fields.tool_source} />
      </form>
      <div className={s.panel}>
        <h2 className={s.cardTitle}>Payload that would be sent</h2>
        <p className={s.muted} data-testid="prefill-status">
          {received === undefined
            ? "Reading..."
            : received
              ? `Pre-filled by ${received.tool}`
              : "No tool pre-fill found."}
        </p>
        <pre data-testid="prefill-payload" style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
          {JSON.stringify(fields, null, 2)}
        </pre>
      </div>
    </div>
  );
}
