"use client";

import { useId, type HTMLInputTypeAttribute } from "react";
import f from "./form.module.css";

/** Labelled text input with hint and inline error (same markup as NumberField). */
export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  placeholder,
  autoComplete = "off",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "url" | "email" | "tel";
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
          className={f.input}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
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

/** Labelled <select>. */
export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  const id = useId();
  return (
    <div className={f.field}>
      <label htmlFor={id} className={f.label}>
        {label}
      </label>
      <select
        id={id}
        className={f.select}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className={f.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Two colour pickers (code and background) with hex values. */
export function ColorPair({
  fg,
  bg,
  onFg,
  onBg,
  fgLabel = "Code colour",
}: {
  fg: string;
  bg: string;
  onFg: (v: string) => void;
  onBg: (v: string) => void;
  fgLabel?: string;
}) {
  return (
    <div className={f.fieldRow}>
      <TextField label={fgLabel} type="color" value={fg} onChange={onFg} />
      <TextField label="Background colour" type="color" value={bg} onChange={onBg} />
    </div>
  );
}
