"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { calcDim, type CarrierResult, type DimWeightValue } from "@core/tools/dim-weight";
import {
  dimWeightFromQuery,
  dimWeightInputSchema,
  dimWeightToQuery,
  type DimWeightInput,
} from "@core/schemas/dim-weight";
import { CARRIER_IDS, type CarrierId } from "@core/schemas/carriers";
import { carrierRules } from "@core/schemas/carriers";
import { ceilUnit, roundDisplay } from "@core/lib/round";
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

const SLUG = "dimensional-weight-calculator";

type Unit = "in" | "cm";
type Packaging = DimWeightInput["packaging"];
type Fields = {
  l: string;
  w: string;
  h: string;
  weight: string;
  unit: Unit;
  carriers: CarrierId[];
  packaging: Packaging;
  contractDivisor: string;
  pl: string;
  pw: string;
  ph: string;
  clearance: string;
};

const DEFAULT: Fields = {
  l: "12",
  w: "9",
  h: "4",
  weight: "2.5",
  unit: "in",
  carriers: [...CARRIER_IDS],
  packaging: "box",
  contractDivisor: "",
  pl: "",
  pw: "",
  ph: "",
  clearance: "",
};

function toRaw(v: Fields): Record<string, unknown> {
  return {
    l: v.l,
    w: v.w,
    h: v.h,
    unit: v.unit,
    weight: v.weight,
    carriers: v.carriers,
    packaging: v.packaging,
    contractDivisor: v.contractDivisor,
    product: v.pl && v.pw && v.ph ? { l: v.pl, w: v.pw, h: v.ph } : undefined,
    clearance: v.clearance,
  };
}

function fromInput(i: DimWeightInput): Fields {
  return {
    l: String(i.l),
    w: String(i.w),
    h: String(i.h),
    weight: String(i.weight),
    unit: i.unit,
    carriers: i.carriers,
    packaging: i.packaging,
    contractDivisor: i.contractDivisor === undefined ? "" : String(i.contractDivisor),
    pl: i.product ? String(i.product.l) : "",
    pw: i.product ? String(i.product.w) : "",
    ph: i.product ? String(i.product.h) : "",
    clearance: i.clearance === undefined ? "" : String(i.clearance),
  };
}

/** Convert a numeric string between units, keeping empties empty. */
function convert(v: string, factor: number): string {
  if (v.trim() === "" || !Number.isFinite(Number(v))) return v;
  return String(Number(roundDisplay(Number(v) * factor, 2).replace(/,/g, "")));
}

const fmt = (x: number | null, dp = 2) => (x === null ? "–" : roundDisplay(x, dp));

function carrierCell(
  c: CarrierResult | undefined,
  pick: (c: CarrierResult) => ReactNode,
): ReactNode {
  return c ? pick(c) : "–";
}

/** "4 lb", plus "(1.81 kg)" when the user works in cm/kg but the carrier bills in lb (USPS). */
function weightText(x: number, c: CarrierResult, metricView: boolean): string {
  const base = `${fmt(x)} ${c.weightUnit}`;
  return metricView && c.weightUnit === "lb" ? `${base} (${fmt(x * KG_PER_LB)} kg)` : base;
}

function compareRows(v: DimWeightValue, metricView: boolean) {
  const ids = v.order;
  const row = (label: string, pick: (c: CarrierResult) => ReactNode) => {
    const r: Record<string, ReactNode> = { measure: label };
    for (const id of ids) r[id] = carrierCell(v.carriers[id], pick);
    return r;
  };
  return [
    row("Rounded size", (c) => `${c.roundedDims.join(" x ")} ${c.lengthUnit}`),
    row("Volume", (c) => `${fmt(c.volume, 0)} ${c.lengthUnit}³`),
    row(
      "Divisor",
      (c) => `${fmt(c.divisor, 0)}${c.divisorSource === "contract" ? " (contract)" : ""}`,
    ),
    row("DIM weight", (c) =>
      c.dimWeight === null ? "Not applied" : weightText(c.dimWeight, c, metricView),
    ),
    row("Actual (rounded)", (c) => weightText(c.actual, c, metricView)),
    row("Billable weight", (c) =>
      c.billable === null ? "Not accepted" : weightText(c.billable, c, metricView),
    ),
    row("Length + girth", (c) => `${fmt(c.lengthPlusGirth, 0)} ${c.lengthUnit}`),
    row("Surcharges", (c) =>
      c.surcharges.length ? c.surcharges.map((x) => x.label).join(", ") : "None",
    ),
    row("USPS cubic", (c) =>
      c.cubic
        ? c.cubic.eligible
          ? `Tier ${c.cubic.tierFt3}`
          : "Not eligible"
        : c.carrier === "usps"
          ? "–"
          : "n/a",
    ),
  ];
}

// The engine is deterministic, so the widget recomputes the default example
// itself; the server-computed initialResult is identical and not needed here.
export function DimensionalWeightWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`DimensionalWeightWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  // Shareable state: read the query once after mount (keeps the prerendered HTML = default example).
  useEffect(() => {
    const q = readQuery();
    if (!q.l) return;
    const parsed = dimWeightInputSchema.safeParse(dimWeightFromQuery(q));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (parsed.success) setFields(fromInput(parsed.data));
  }, []);

  const parsed = useMemo(() => dimWeightInputSchema.safeParse(toRaw(fields)), [fields]);
  const current = useMemo(() => {
    if (!parsed.success) return null;
    return { input: parsed.data, result: calcDim(parsed.data) };
  }, [parsed]);
  // Keep the last valid result visible (dimmed) while a field is being fixed.
  const [lastGood, setLastGood] = useState<{
    input: DimWeightInput;
    result: ToolResult<DimWeightValue>;
  } | null>(current);
  if (current && current !== lastGood) setLastGood(current);
  const shown = current ?? lastGood;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
    return e;
  }, [parsed]);

  // Mirror valid input to the URL and record the calculation (debounced).
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => {
      writeQuery(dimWeightToQuery(current.input));
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
      pl: convert(cur.pl, len),
      pw: convert(cur.pw, len),
      ph: convert(cur.ph, len),
      clearance: convert(cur.clearance, len),
      weight: convert(cur.weight, wt),
    }));
    track({ name: "tool_unit_toggled", slug: SLUG, unit: next });
  }

  function toggleCarrier(id: CarrierId, on: boolean) {
    const next = on
      ? CARRIER_IDS.filter((c) => c === id || fields.carriers.includes(c))
      : fields.carriers.filter((c) => c !== id);
    set("carriers", next);
  }

  const lu = fields.unit;
  const wu = lu === "in" ? "lb" : "kg";
  const v = shown?.result.value;
  const lowest = v?.lowest;
  // Name every carrier that ties for the lowest billable weight.
  const tied = lowest
    ? v.order
        .map((id) => v.carriers[id])
        .filter(
          (c): c is CarrierResult =>
            !!c && c.billableLb !== null && Math.abs(c.billableLb - lowest.billableLb) < 1e-9,
        )
        .map((c) => c.name)
    : [];
  const tiedNames =
    tied.length > 1 ? `${tied.slice(0, -1).join(", ")} and ${tied.at(-1)}` : (tied[0] ?? "");

  const quoteDims = shown
    ? ([shown.input.l, shown.input.w, shown.input.h].map(ceilUnit) as number[])
    : [];
  const quoteDetails = shown
    ? `Tool: DIM calculator. ${shown.input.l} x ${shown.input.w} x ${shown.input.h} ${lu}, ${shown.input.weight} ${wu}. ` +
      shown.input.carriers
        .map((id) => {
          const c = v?.carriers[id];
          return c
            ? `${c.name} billable ${c.billable === null ? "n/a" : `${fmt(c.billable)} ${c.weightUnit}`}`
            : "";
        })
        .filter(Boolean)
        .join(", ") +
      "."
    : "";

  return (
    <div className={f.widget}>
      <ToolForm label="Box size and weight">
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
            label="Length"
            unit={lu}
            value={fields.l}
            onChange={(x) => set("l", x)}
            error={errors.l}
            min={0}
          />
          <NumberField
            label="Width"
            unit={lu}
            value={fields.w}
            onChange={(x) => set("w", x)}
            error={errors.w}
            min={0}
          />
          <NumberField
            label="Height"
            unit={lu}
            value={fields.h}
            onChange={(x) => set("h", x)}
            error={errors.h}
            min={0}
          />
        </div>
        <NumberField
          label="Actual weight"
          unit={wu}
          value={fields.weight}
          onChange={(x) => set("weight", x)}
          error={errors.weight}
          min={0}
        />
        <fieldset className={f.checks}>
          <legend>Carriers</legend>
          {CARRIER_IDS.map((id) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={fields.carriers.includes(id)}
                onChange={(e) => toggleCarrier(id, e.target.checked)}
              />
              {carrierRules.carriers[id].name}
            </label>
          ))}
        </fieldset>
        {errors.carriers && <p className={f.error}>{errors.carriers}</p>}
        <fieldset className={f.checks}>
          <legend>Packaging</legend>
          {(
            [
              ["box", "Box"],
              ["softpack", "Poly mailer / envelope"],
              ["mylar", "Mylar bag / pouch"],
            ] as const
          ).map(([val, label]) => (
            <label key={val}>
              <input
                type="radio"
                name="packaging"
                checked={fields.packaging === val}
                onChange={() => set("packaging", val)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <details className={f.more}>
          <summary>More options: contract divisor, right-size limits</summary>
          <div>
            <NumberField
              label="Your contract divisor (UPS, FedEx)"
              hint="Leave empty to use the published divisor. Applies to in / lb only."
              value={fields.contractDivisor}
              onChange={(x) => set("contractDivisor", x)}
              error={errors.contractDivisor}
            />
            <p className={f.hint}>
              Product size: right-size suggestions never cut the box below the product plus
              clearance.
            </p>
            <div className={f.fieldRow}>
              <NumberField
                label="Product L"
                unit={lu}
                value={fields.pl}
                onChange={(x) => set("pl", x)}
                error={errors["product.l"]}
              />
              <NumberField
                label="Product W"
                unit={lu}
                value={fields.pw}
                onChange={(x) => set("pw", x)}
                error={errors["product.w"]}
              />
              <NumberField
                label="Product H"
                unit={lu}
                value={fields.ph}
                onChange={(x) => set("ph", x)}
                error={errors["product.h"]}
              />
            </div>
            <NumberField
              label="Clearance per side"
              unit={lu}
              value={fields.clearance}
              onChange={(x) => set("clearance", x)}
              error={errors.clearance}
            />
          </div>
        </details>
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={
            current ? "Lowest billable weight" : "Fix the highlighted fields (showing last result)"
          }
          headline={
            lowest
              ? `${fmt(lowest.billable)} ${lowest.unit}${lu === "cm" && lowest.unit === "lb" ? ` (${fmt(lowest.billable * KG_PER_LB)} kg)` : ""} with ${tiedNames}`
              : "No carrier accepts this package"
          }
          flags={
            shown?.result.flags.filter(
              (x) => x.level !== "info" || x.code.startsWith("USPS_CUBIC"),
            ) ?? []
          }
        />
        {v && (
          <CompareTable
            caption="Billable weight by carrier (2026 rules)"
            columns={[
              { key: "measure", label: "" },
              ...v.order.map((id) => ({ key: id, label: carrierRules.carriers[id].name })),
            ]}
            rows={compareRows(v, lu === "cm")}
            highlightRow={5}
          />
        )}
        {v && v.rightSize.length > 0 && (
          <div>
            <h3>Right-size: where one size smaller saves money</h3>
            <ul className={f.suggestions}>
              {v.rightSize.map((r) => (
                <li key={r.side}>
                  Cut {r.side} {fmt(r.from)} to {fmt(r.to)} {r.unit}:{" "}
                  {r.savings
                    .map((sv) => `${sv.name} ${fmt(sv.before)} to ${fmt(sv.after)} ${sv.unit}`)
                    .join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
        {shown && (
          <div className={s.ctaRow}>
            <QuoteCTA
              label="Quote a box at this size"
              prefill={{
                tool: SLUG,
                l: quoteDims[0],
                w: quoteDims[1],
                h: quoteDims[2],
                unit: lu === "in" ? "inches" : "cm",
                details: quoteDetails,
              }}
            />
          </div>
        )}
        {shown && (
          <HowItWorks
            steps={shown.result.explain}
            notes={shown.result.flags.filter(
              (x) => x.level === "info" && !x.code.startsWith("USPS_CUBIC"),
            )}
          />
        )}
      </div>
    </div>
  );
}
