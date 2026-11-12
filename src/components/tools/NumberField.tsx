"use client";

import { useId } from "react";
import f from "./form.module.css";

/**
 * Labelled numeric input with unit suffix and inline error. Keeps the raw
 * string so users can type "12." without it snapping back; the widget parses
 * with the tool's zod schema.
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  error,
  hint,
  min,
  max,
  step = "any",
  name,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  error?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  name?: string;
}) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={f.field}>
      <label htmlFor={id} className={f.label}>
        {label}
      </label>
      <div className={`${f.inputWrap} ${error ? f.invalid : ""}`}>
        <input
          id={id}
          name={name}
          className={f.input}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit && (
          <span className={f.unit} aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className={f.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className={f.error}>
          {error}
        </p>
      )}
    </div>
  );
}
