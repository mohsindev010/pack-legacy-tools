"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { findBoxes, type BoxCandidate, type BoxFinderValue } from "@core/tools/box-finder";
import {
  boxFinderFromQuery,
  boxFinderInputSchema,
  boxFinderToQuery,
  type BoxFinderInput,
} from "@core/schemas/box-finder";
import { boxRules, fluteRules, FLUTE_IDS, type FluteId } from "@core/schemas/boxes";
import { CARRIER_IDS } from "@core/schemas/carriers";
import { roundDisplay } from "@core/lib/round";
import { CM_PER_IN, KG_PER_LB } from "@core/lib/units";
import type { ToolResult } from "@core/lib/result";
import { NumberField } from "../NumberField";
import { UnitToggle } from "../UnitToggle";
import { ToolForm } from "../ToolForm";
import { ResultCard } from "../ResultCard";
import { CompareTable } from "../CompareTable";
import { QuoteCTA } from "../QuoteCTA";
import { HowItWorks } from "../HowItWorks";
import { hashInputs, track } from "../analytics";
import { readQuery, writeQuery } from "../urlState";
import type { WidgetProps } from "./index";
import f from "../form.module.css";
import s from "../tools.module.css";

const SLUG = "standard-box-sizes";
type Unit = "in" | "cm";
type Preset = "snug" | "standard" | "protective" | "custom";
const PRESETS = boxRules.settings.clearancePresetsIn;
const PRESET_LABEL: Record<Exclude<Preset, "custom">, string> = {
  snug: "Snug",
  standard: "Standard",
  protective: "Protective",
};

type Fields = {
  l: string;
  w: string;
  h: string;
  unit: Unit;
  preset: Preset;
  clearance: string; // custom value, input unit
  insert: string;
  orientation: BoxFinderInput["orientation"];
  family: BoxFinderInput["family"];
  board: FluteId;
  weight: string;
};

const DEFAULT: Fields = {
  l: "9",
  w: "6",
  h: "2.5",
  unit: "in",
  preset: "standard",
  clearance: "",
  insert: "",
  orientation: "free",
  family: "all",
  board: "e",
  weight: "",
};

const FAMILIES: { value: BoxFinderInput["family"]; label: string }[] = [
  { value: "all", label: "All boxes" },
  { value: "mailer", label: "Mailer boxes" },
  { value: "rsc", label: "Shipping boxes (RSC)" },
  { value: "usps-flat-rate", label: "USPS Flat Rate" },
];

const fmt = (x: number | null, dp = 2) => (x === null ? "–" : roundDisplay(x, dp));
const presetIn = (p: Preset) => (p === "custom" ? null : PRESETS[p]);
const inUnit = (inches: number, u: Unit) => (u === "in" ? inches : inches * CM_PER_IN);

function toRaw(v: Fields): Record<string, unknown> {
  const pIn = presetIn(v.preset);
  return {
    l: v.l,
    w: v.w,
    h: v.h,
    unit: v.unit,
    clearance: pIn === null ? v.clearance : String(inUnit(pIn, v.unit)),
    insert: v.insert || undefined,
    orientation: v.orientation,
    family: v.family,
    board: v.board,
    weight: v.weight,
  };
}

function fromInput(i: BoxFinderInput): Fields {
  const cIn =
    i.clearance === undefined
      ? PRESETS.standard
      : i.unit === "in"
        ? i.clearance
        : i.clearance / CM_PER_IN;
  const preset = (Object.keys(PRESETS) as (keyof typeof PRESETS)[]).find(
    (k) => Math.abs(PRESETS[k] - cIn) < 1e-6,
  );
  return {
    l: String(i.l),
    w: String(i.w),
    h: String(i.h),
    unit: i.unit,
    preset: preset ?? "custom",
    clearance: preset ? "" : String(i.clearance),
    insert: i.insert ? String(i.insert) : "",
    orientation: i.orientation,
    family: i.family,
    board: i.board,
    weight: i.weight === undefined ? "" : String(i.weight),
  };
}

function convert(v: string, factor: number): string {
  if (v.trim() === "" || !Number.isFinite(Number(v))) return v;
  return String(Number(roundDisplay(Number(v) * factor, 2).replace(/,/g, "")));
}

const dimsIn = (d: readonly number[]) => `${d.map((x) => fmt(x, 3)).join(" x ")} in`;

function rows(v: BoxFinderValue, hasWeight: boolean) {
  const row = (c: BoxCandidate): Record<string, ReactNode> => {
    const r: Record<string, ReactNode> = {
      box: c.plProductUrl ? <a href={c.plProductUrl}>{c.label}</a> : c.label,
      inside: dimsIn(c.insideIn),
      outside: `${dimsIn(c.outsideIn)}${c.outsideSource === "published" ? " (USPS)" : ""}`,
      waste: `${fmt(c.waste * 100, 1)}%`,
    };
    for (const id of CARRIER_IDS) {
      const w = c.carriers[id];
      const val = hasWeight ? (w?.billable ?? null) : (w?.dimWeight ?? null);
      r[id] = w ? (val === null ? (hasWeight ? "–" : "No DIM") : `${fmt(val)} ${w.unit}`) : "–";
    }
    return r;
  };
  return [...v.matches.map(row), row(v.exactFit)];
}

export function BoxFinderWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`BoxFinderWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    const q = readQuery();
    if (!q.l) return;
    const parsed = boxFinderInputSchema.safeParse(boxFinderFromQuery(q));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (parsed.success) setFields(fromInput(parsed.data));
  }, []);

  const parsed = useMemo(() => boxFinderInputSchema.safeParse(toRaw(fields)), [fields]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: findBoxes(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: BoxFinderInput;
    result: ToolResult<BoxFinderValue>;
  } | null>(current);
  if (current && current !== lastGood) setLastGood(current);
  const shown = current ?? lastGood;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
    return e;
  }, [parsed]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => {
      writeQuery(boxFinderToQuery(current.input));
      track({ name: "tool_calculated", slug: SLUG, inputsHash: hashInputs(current.input) });
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  function switchUnit(next: Unit) {
    if (next === fields.unit) return;
    const len = next === "cm" ? CM_PER_IN : 1 / CM_PER_IN;
    const wt = next === "cm" ? KG_PER_LB : 1 / KG_PER_LB;
    setFields((cur) => ({
      ...cur,
      unit: next,
      l: convert(cur.l, len),
      w: convert(cur.w, len),
      h: convert(cur.h, len),
      clearance: convert(cur.clearance, len),
      insert: convert(cur.insert, len),
      weight: convert(cur.weight, wt),
    }));
    track({ name: "tool_unit_toggled", slug: SLUG, unit: next });
  }

  const lu = fields.unit;
  const v = shown?.result.value;
  const hasWeight = shown?.input.weight !== undefined;
  const best = v?.matches[0];

  const quoteDetails = v
    ? `Product ${dimsIn(v.productIn)}, ${fmt(v.clearanceIn, 3)} in clearance per side, ${v.board.name}. ` +
      `Exact fit ${dimsIn(v.exactFit.insideIn)} inside` +
      (best ? `; best stock box ${best.label} (${fmt(best.waste * 100, 1)}% empty)` : "") +
      (v.exactFitSavingLb ? `; exact fit saves ${fmt(v.exactFitSavingLb)} lb UPS per parcel.` : ".")
    : "";

  return (
    <div className={f.widget}>
      <ToolForm label="Product size">
        <UnitToggle
          legend="Units"
          value={lu}
          onChange={switchUnit}
          options={[
            { value: "in", label: "in / lb" },
            { value: "cm", label: "cm / kg" },
          ]}
        />
        <div className={f.fieldRow}>
          <NumberField
            label="Product length"
            unit={lu}
            value={fields.l}
            onChange={(x) => set("l", x)}
            error={errors.l}
            min={0}
          />
          <NumberField
            label="Product width"
            unit={lu}
            value={fields.w}
            onChange={(x) => set("w", x)}
            error={errors.w}
            min={0}
          />
          <NumberField
            label="Product height"
            unit={lu}
            value={fields.h}
            onChange={(x) => set("h", x)}
            error={errors.h}
            min={0}
          />
        </div>
        <fieldset className={f.checks}>
          <legend>Clearance per side</legend>
          {(["snug", "standard", "protective", "custom"] as const).map((p) => (
            <label key={p}>
              <input
                type="radio"
                name="clearance"
                checked={fields.preset === p}
                onChange={() => set("preset", p)}
              />
              {p === "custom"
                ? "Custom"
                : `${PRESET_LABEL[p]} ${fmt(inUnit(PRESETS[p], lu), 3)} ${lu}`}
            </label>
          ))}
        </fieldset>
        {fields.preset === "custom" && (
          <NumberField
            label="Custom clearance per side"
            unit={lu}
            value={fields.clearance}
            onChange={(x) => set("clearance", x)}
            error={errors.clearance}
          />
        )}
        <fieldset className={f.checks}>
          <legend>Orientation</legend>
          <label>
            <input
              type="radio"
              name="orientation"
              checked={fields.orientation === "free"}
              onChange={() => set("orientation", "free")}
            />
            Any way up
          </label>
          <label>
            <input
              type="radio"
              name="orientation"
              checked={fields.orientation === "upright"}
              onChange={() => set("orientation", "upright")}
            />
            This side up (keep height vertical)
          </label>
        </fieldset>
        <div className={f.fieldRow}>
          <div className={f.field}>
            <label className={f.label} htmlFor="bf-family">
              Box type
            </label>
            <select
              id="bf-family"
              className={f.select}
              value={fields.family}
              onChange={(e) => set("family", e.target.value as Fields["family"])}
            >
              {FAMILIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="bf-board">
              Board type
            </label>
            <select
              id="bf-board"
              className={f.select}
              value={fields.board}
              onChange={(e) => set("board", e.target.value as FluteId)}
            >
              {FLUTE_IDS.map((id) => (
                <option key={id} value={id}>
                  {fluteRules.flutes[id].name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <details className={f.more}>
          <summary>More options: insert, packed weight</summary>
          <div>
            <NumberField
              label="Insert or padding thickness per side"
              unit={lu}
              value={fields.insert}
              onChange={(x) => set("insert", x)}
              error={errors.insert}
            />
            <NumberField
              label="Packed weight"
              unit={lu === "in" ? "lb" : "kg"}
              hint="Optional. Shows billable weight instead of dimensional weight."
              value={fields.weight}
              onChange={(x) => set("weight", x)}
              error={errors.weight}
            />
          </div>
        </details>
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={current ? "Best stock box" : "Fix the highlighted fields (showing last result)"}
          headline={best ? best.label : "No stock box fits"}
          values={
            v
              ? [
                  { label: "Required inside size", value: dimsIn(v.requiredIn) },
                  ...(best
                    ? [{ label: "Empty space", value: `${fmt(best.waste * 100, 1)}%` }]
                    : []),
                  { label: "Exact-fit box", value: dimsIn(v.exactFit.insideIn) },
                  ...(v.exactFitSavingLb
                    ? [
                        {
                          label: "Exact fit saves (UPS)",
                          value: `${fmt(v.exactFitSavingLb)} lb per parcel`,
                        },
                      ]
                    : []),
                ]
              : []
          }
          flags={
            shown?.result.flags.filter((x) => x.level !== "info" || x.code === "FLAT_RATE_NOTE") ??
            []
          }
        />
        {v && (
          <CompareTable
            caption={`Best ${v.matches.length} of ${v.totalFits} fitting boxes, plus an exact-fit box (${hasWeight ? "billable" : "dimensional"} weight)`}
            columns={[
              { key: "box", label: "Box" },
              { key: "inside", label: "Inside" },
              { key: "outside", label: "Outside" },
              { key: "waste", label: "Empty" },
              ...CARRIER_IDS.map((id) => ({ key: id, label: v.exactFit.carriers[id]?.name ?? id })),
            ]}
            rows={rows(v, hasWeight)}
            highlightRow={v.matches.length}
          />
        )}
        {v && (
          <div className={s.ctaRow}>
            <QuoteCTA
              label="Quote the exact-fit box"
              prefill={{
                tool: SLUG,
                l: v.exactFit.insideIn[0],
                w: v.exactFit.insideIn[1],
                h: v.exactFit.insideIn[2],
                unit: "inches",
                material: "Kraft corrugated",
                details: quoteDetails,
              }}
            />
          </div>
        )}
        {shown && (
          <HowItWorks
            steps={shown.result.explain}
            notes={shown.result.flags.filter(
              (x) => x.level === "info" && x.code !== "FLAT_RATE_NOTE",
            )}
          />
        )}
      </div>
    </div>
  );
}
