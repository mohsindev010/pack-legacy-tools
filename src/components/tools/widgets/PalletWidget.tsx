"use client";

import { useEffect, useMemo, useState } from "react";
import { calcPallet, type PalletValue } from "@core/tools/pallet";
import {
  PALLET_IDS,
  PALLET_UNITS,
  palletFromQuery,
  palletInputSchema,
  palletRules,
  palletToQuery,
  type PalletId,
  type PalletInput,
  type PalletUnit,
} from "@core/schemas/pallets";
import { CONTAINER_IDS, containerRules, type ContainerId } from "@core/schemas/containers";
import type { Block } from "@core/lib/packing";
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

const SLUG = "pallet-calculator";

type Fields = {
  l: string;
  w: string;
  h: string;
  unit: PalletUnit;
  weight: string;
  qty: string;
  upright: boolean;
  pallet: PalletId;
  palletH: string;
  palletWeight: string;
  maxLoad: string;
  maxHeight: string;
  overhang: string;
  containers: ContainerId[];
  stack: boolean;
};

const DEFAULT: Fields = {
  l: "12",
  w: "10",
  h: "8",
  unit: "in",
  weight: "",
  qty: "1",
  upright: false,
  pallet: "gma-48x40",
  palletH: "",
  palletWeight: "",
  maxLoad: "",
  maxHeight: "",
  overhang: "",
  containers: [...CONTAINER_IDS],
  stack: false,
};

const str = (x: number | undefined) => (x === undefined ? "" : String(x));
function fromInput(i: PalletInput): Fields {
  return {
    l: String(i.l),
    w: String(i.w),
    h: String(i.h),
    unit: i.unit,
    weight: str(i.weight),
    qty: String(i.qty),
    upright: i.upright,
    pallet: i.pallet,
    palletH: str(i.palletH),
    palletWeight: str(i.palletWeight),
    maxLoad: str(i.maxLoad),
    maxHeight: str(i.maxHeight),
    overhang: str(i.overhang),
    containers: i.containers,
    stack: i.stack,
  };
}

function convert(v: string, factor: number): string {
  if (v.trim() === "" || !Number.isFinite(Number(v))) return v;
  return String(Number(roundDisplay(Number(v) * factor, 2).replace(/,/g, "")));
}

const fmt = (x: number, dp = 2) => roundDisplay(x, dp);

/** Top view of one layer, drawn to scale. */
function LayerDiagram({ v }: { v: PalletValue }) {
  if (!v.layer) return null;
  const L = v.pallet.length + 2 * v.pallet.overhang;
  const W = v.pallet.width + 2 * v.pallet.overhang;
  const k = 320 / L;
  const rects: { x: number; y: number; w: number; d: number }[] = [];
  v.layer.blocks.forEach((b: Block) => {
    for (let i = 0; i < b.nx; i++)
      for (let j = 0; j < b.ny; j++)
        rects.push({ x: b.x + i * b.w, y: b.y + j * b.d, w: b.w, d: b.d });
  });
  return (
    <figure className={s.diagram}>
      <svg
        viewBox={`-4 -4 ${L * k + 8} ${W * k + 8}`}
        width="100%"
        style={{ maxWidth: 420 }}
        role="img"
        aria-label={`Top view of one layer: ${v.layer.perLayer} cartons on a ${fmt(v.pallet.length)} × ${fmt(v.pallet.width)} ${v.unit} pallet`}
      >
        <rect
          x={v.pallet.overhang * k}
          y={v.pallet.overhang * k}
          width={v.pallet.length * k}
          height={v.pallet.width * k}
          fill="none"
          stroke="currentColor"
          strokeDasharray="4 3"
        />
        {rects.map((r, i) => (
          <rect
            key={i}
            x={r.x * k}
            y={r.y * k}
            width={r.w * k}
            height={r.d * k}
            fill="var(--plt-color-brand-soft)"
            stroke="var(--plt-color-brand)"
            strokeWidth={1}
          />
        ))}
      </svg>
      <figcaption>
        One layer from above: {v.layer.perLayer} cartons, {fmt(v.areaUsed * 100, 1)} % of the pallet
        covered. Dashed line = pallet edge.
      </figcaption>
    </figure>
  );
}

export function PalletWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`PalletWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    const q = readQuery();
    if (!q.l) return;
    const parsed = palletInputSchema.safeParse(palletFromQuery(q));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (parsed.success) setFields(fromInput(parsed.data));
  }, []);

  const parsed = useMemo(() => palletInputSchema.safeParse({ ...fields }), [fields]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: calcPallet(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: PalletInput;
    result: ToolResult<PalletValue>;
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
      writeQuery(palletToQuery(current.input));
      track({ name: "tool_calculated", slug: SLUG, inputsHash: hashInputs(current.input) });
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  function switchUnit(next: PalletUnit) {
    if (next === fields.unit) return;
    const len = next === "cm" ? CM_PER_IN : 1 / CM_PER_IN;
    const wt = next === "cm" ? KG_PER_LB : 1 / KG_PER_LB;
    setFields((cur) => ({
      ...cur,
      unit: next,
      l: convert(cur.l, len),
      w: convert(cur.w, len),
      h: convert(cur.h, len),
      palletH: convert(cur.palletH, len),
      maxHeight: convert(cur.maxHeight, len),
      overhang: convert(cur.overhang, len),
      weight: convert(cur.weight, wt),
      palletWeight: convert(cur.palletWeight, wt),
      maxLoad: convert(cur.maxLoad, wt),
    }));
    track({ name: "tool_unit_toggled", slug: SLUG, unit: next });
  }

  function toggleContainer(id: ContainerId, on: boolean) {
    set(
      "containers",
      on
        ? CONTAINER_IDS.filter((c) => c === id || fields.containers.includes(c))
        : fields.containers.filter((c) => c !== id),
    );
  }

  const lu = fields.unit;
  const wu = lu === "in" ? "lb" : "kg";
  const v = shown?.result.value;
  const values = v
    ? [
        {
          label: "Per layer × layers",
          value: v.layer ? `${v.layer.perLayer} × ${v.layersUsed}` : "–",
        },
        { label: "Loaded height", value: `${fmt(v.loadHeight)} ${lu}` },
        ...(v.grossWeight !== null
          ? [{ label: "Gross weight", value: `${fmt(v.grossWeight)} ${wu}` }]
          : []),
        ...(v.palletsNeeded !== null && v.palletsNeeded > 1
          ? [
              {
                label: `Pallets for ${fmt(Number(fields.qty), 0)}`,
                value: `${v.palletsNeeded} (last holds ${v.lastHolds})`,
              },
            ]
          : []),
      ]
    : [];

  const quoteDetails =
    v && shown
      ? `Carton ${shown.input.l} x ${shown.input.w} x ${shown.input.h} ${lu}: ${v.perPallet} per ${v.pallet.name} pallet (${v.layer?.perLayer ?? 0} per layer), ${fmt(v.loadHeight)} ${lu} loaded.`
      : "";

  return (
    <div className={f.widget}>
      <ToolForm label="Carton and pallet">
        <UnitToggle
          legend="Units"
          value={lu}
          onChange={switchUnit}
          options={PALLET_UNITS.map((u) => ({
            value: u,
            label: u === "in" ? "in / lb" : "cm / kg",
          }))}
        />
        <p className={f.hint}>Carton outside dimensions.</p>
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
        <div className={f.fieldRow}>
          <NumberField
            label="Weight per carton"
            unit={wu}
            hint="Optional: checks the pallet and container load limits."
            value={fields.weight}
            onChange={(x) => set("weight", x)}
            error={errors.weight}
            min={0}
          />
          <NumberField
            label="Quantity"
            unit="cartons"
            value={fields.qty}
            onChange={(x) => set("qty", x)}
            error={errors.qty}
            min={1}
            step={1}
          />
        </div>
        <div className={f.field}>
          <label className={f.label} htmlFor="pc-pallet">
            Pallet
          </label>
          <select
            id="pc-pallet"
            className={f.select}
            value={fields.pallet}
            onChange={(e) => set("pallet", e.target.value as PalletId)}
          >
            {PALLET_IDS.map((id) => (
              <option key={id} value={id}>
                {palletRules.pallets[id].name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className={f.checks}>
          <legend>Orientation</legend>
          <label>
            <input
              type="checkbox"
              checked={fields.upright}
              onChange={(e) => set("upright", e.target.checked)}
            />
            This side up (height stays vertical)
          </label>
        </fieldset>
        <NumberField
          label="Maximum loaded height"
          unit={lu}
          hint={`Including the pallet. Empty = ${lu === "in" ? "60 in" : "152.4 cm"}.`}
          value={fields.maxHeight}
          onChange={(x) => set("maxHeight", x)}
          error={errors.maxHeight}
        />
        <details className={f.more}>
          <summary>Pallet details: height, weight, load limit, overhang</summary>
          <div>
            <p className={f.hint}>Leave empty to use the preset for the pallet chosen above.</p>
            <div className={f.fieldRow}>
              <NumberField
                label="Pallet height"
                unit={lu}
                value={fields.palletH}
                onChange={(x) => set("palletH", x)}
                error={errors.palletH}
              />
              <NumberField
                label="Pallet weight"
                unit={wu}
                value={fields.palletWeight}
                onChange={(x) => set("palletWeight", x)}
                error={errors.palletWeight}
              />
            </div>
            <div className={f.fieldRow}>
              <NumberField
                label="Load limit (cargo)"
                unit={wu}
                value={fields.maxLoad}
                onChange={(x) => set("maxLoad", x)}
                error={errors.maxLoad}
              />
              <NumberField
                label="Overhang per side"
                unit={lu}
                value={fields.overhang}
                onChange={(x) => set("overhang", x)}
                error={errors.overhang}
              />
            </div>
          </div>
        </details>
        <fieldset className={f.checks}>
          <legend>Containers</legend>
          {CONTAINER_IDS.map((id) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={fields.containers.includes(id)}
                onChange={(e) => toggleContainer(id, e.target.checked)}
              />
              {containerRules.containers[id].name}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={fields.stack}
              onChange={(e) => set("stack", e.target.checked)}
            />
            Pallets can be stacked
          </label>
        </fieldset>
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={
            current ? "Cartons per pallet" : "Fix the highlighted fields (showing last result)"
          }
          headline={v ? (v.perPallet > 0 ? `${fmt(v.perPallet, 0)} cartons` : "Does not fit") : "–"}
          values={values}
          flags={shown?.result.flags.filter((x) => x.level !== "info") ?? []}
        />
        {v && <LayerDiagram v={v} />}
        {v && v.containers.length > 0 && (
          <CompareTable
            caption={`Pallets per container${fields.stack ? " (stacked where height allows)" : " (single tier)"}`}
            columns={[
              { key: "name", label: "Container" },
              { key: "pallets", label: "Pallets" },
              { key: "cartons", label: "Cartons" },
              { key: "limit", label: "Limited by" },
              { key: "needed", label: `Containers for ${v.palletsNeeded ?? 0} pallets` },
            ]}
            rows={v.containers.map((c) => ({
              name: c.name,
              pallets:
                c.reason === "TOO_TALL_FOR_DOOR"
                  ? "0 (too tall for the door)"
                  : c.reason === "TOO_TALL"
                    ? "0 (too tall)"
                    : `${c.pallets}${c.levels > 1 ? ` (${c.floor} × ${c.levels} high)` : ""}`,
              cartons: fmt(c.cartons, 0),
              limit: c.limit === "weight" ? "Weight" : c.limit === "space" ? "Space" : "–",
              needed: c.needed === null ? "–" : fmt(c.needed, 0),
            }))}
          />
        )}
        {v && shown && v.perPallet > 0 && (
          <div className={s.ctaRow}>
            <QuoteCTA
              label="Quote cartons for this pallet"
              prefill={{
                tool: SLUG,
                l: shown.input.l,
                w: shown.input.w,
                h: shown.input.h,
                unit: lu === "in" ? "inches" : "cm",
                details: quoteDetails,
              }}
            />
          </div>
        )}
        {shown && (
          <HowItWorks
            steps={shown.result.explain}
            notes={shown.result.flags.filter((x) => x.level === "info")}
          />
        )}
      </div>
    </div>
  );
}
