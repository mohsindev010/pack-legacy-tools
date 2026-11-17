"use client";

import { useEffect, useMemo, useState } from "react";
import { calcBoxVolume, type BoxVolumeValue, type ContainerFit } from "@core/tools/box-volume";
import {
  BV_UNITS,
  boxVolumeFromQuery,
  boxVolumeInputSchema,
  boxVolumeToQuery,
  bvWeightUnit,
  type BoxVolumeInput,
  type BvUnit,
} from "@core/schemas/box-volume";
import { CONTAINER_IDS, containerRules, type ContainerId } from "@core/schemas/containers";
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

const SLUG = "box-volume-calculator";

type Fields = {
  l: string;
  w: string;
  h: string;
  unit: BvUnit;
  qty: string;
  weight: string;
  upright: boolean;
  containers: ContainerId[];
};

const DEFAULT: Fields = {
  l: "24",
  w: "18",
  h: "12",
  unit: "in",
  qty: "1",
  weight: "",
  upright: false,
  containers: [...CONTAINER_IDS],
};

const toRaw = (v: Fields): Record<string, unknown> => ({ ...v });

function fromInput(i: BoxVolumeInput): Fields {
  return {
    l: String(i.l),
    w: String(i.w),
    h: String(i.h),
    unit: i.unit,
    qty: String(i.qty),
    weight: i.weight === undefined ? "" : String(i.weight),
    upright: i.upright,
    containers: i.containers,
  };
}

/** mm per unit, for converting typed sides when the unit changes. */
const MM: Record<BvUnit, number> = { in: CM_PER_IN * 10, cm: 10, mm: 1 };

function convert(v: string, factor: number, dp: number): string {
  if (v.trim() === "" || !Number.isFinite(Number(v))) return v;
  return String(Number(roundDisplay(Number(v) * factor, dp).replace(/,/g, "")));
}

const fmt = (x: number, dp = 2) => roundDisplay(x, dp);
const UNIT_LABEL: Record<BvUnit, string> = { in: "in / lb", cm: "cm / kg", mm: "mm / kg" };
const QUOTE_UNIT = { in: "inches", cm: "cm", mm: "mm" } as const;

function fitCell(c: ContainerFit): string {
  if (c.reason === "NO_DOOR_FIT") return "0 (does not pass the door)";
  if (c.reason === "NO_CONTAINER_FIT") return "0 (too large)";
  return fmt(c.fit, 0);
}

export function BoxVolumeWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`BoxVolumeWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    const q = readQuery();
    if (!q.l) return;
    const parsed = boxVolumeInputSchema.safeParse(boxVolumeFromQuery(q));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (parsed.success) setFields(fromInput(parsed.data));
  }, []);

  const parsed = useMemo(() => boxVolumeInputSchema.safeParse(toRaw(fields)), [fields]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: calcBoxVolume(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: BoxVolumeInput;
    result: ToolResult<BoxVolumeValue>;
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
      writeQuery(boxVolumeToQuery(current.input));
      track({ name: "tool_calculated", slug: SLUG, inputsHash: hashInputs(current.input) });
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  function switchUnit(next: BvUnit) {
    if (next === fields.unit) return;
    const len = MM[fields.unit] / MM[next];
    const dp = next === "mm" ? 0 : 2;
    const fromW = bvWeightUnit(fields.unit);
    const toW = bvWeightUnit(next);
    const wt = fromW === toW ? 1 : toW === "kg" ? KG_PER_LB : 1 / KG_PER_LB;
    setFields((cur) => ({
      ...cur,
      unit: next,
      l: convert(cur.l, len, dp),
      w: convert(cur.w, len, dp),
      h: convert(cur.h, len, dp),
      weight: convert(cur.weight, wt, 2),
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
  const wu = bvWeightUnit(lu);
  const v = shown?.result.value;
  const many = (v?.qty ?? 1) > 1;
  const vol = v ? (many ? v.total : v.perCarton) : null;

  const values =
    v && vol
      ? [
          { label: "Cubic meters (CBM)", value: `${fmt(vol.m3, 4)} m³` },
          { label: "Liters", value: `${fmt(vol.liters)} L` },
          { label: "Cubic inches", value: `${fmt(vol.in3)} in³` },
          ...(many
            ? [
                {
                  label: "Per carton",
                  value: `${fmt(v.perCarton.ft3, 3)} ft³ · ${fmt(v.perCarton.m3, 4)} m³`,
                },
              ]
            : []),
          ...(v.totalWeight !== null && many
            ? [{ label: "Total weight", value: `${fmt(v.totalWeight)} ${v.weightUnit}` }]
            : []),
        ]
      : [];

  const best = v?.containers.filter((c) => c.fit > 0).at(-1);
  const quoteDetails =
    v && shown
      ? `Carton ${shown.input.l} x ${shown.input.w} x ${shown.input.h} ${lu}, qty ${fmt(v.qty, 0)}, ` +
        `${fmt(v.total.ft3, 3)} ft³ (${fmt(v.total.m3, 4)} CBM).` +
        (best
          ? ` Fits ${fmt(best.fit, 0)} per ${best.name} (${fmt(best.needed ?? 0, 0)} container${best.needed === 1 ? "" : "s"}).`
          : "")
      : "";

  return (
    <div className={f.widget}>
      <ToolForm label="Carton size and quantity">
        <UnitToggle
          legend="Units"
          value={lu}
          onChange={switchUnit}
          options={BV_UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))}
        />
        <p className={f.hint}>Use the carton&apos;s outside dimensions.</p>
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
            label="Quantity"
            unit="cartons"
            value={fields.qty}
            onChange={(x) => set("qty", x)}
            error={errors.qty}
            min={1}
            step={1}
          />
          <NumberField
            label="Weight per carton"
            unit={wu}
            hint="Optional: checks the container payload."
            value={fields.weight}
            onChange={(x) => set("weight", x)}
            error={errors.weight}
            min={0}
          />
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
        </fieldset>
        {errors.containers && <p className={f.error}>{errors.containers}</p>}
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={
            current
              ? many
                ? `Total for ${fmt(v!.qty, 0)} cartons`
                : "Volume of one carton"
              : "Fix the highlighted fields (showing last result)"
          }
          headline={vol ? `${fmt(vol.ft3, 3)} ft³ · ${fmt(vol.m3, 4)} CBM` : "–"}
          values={values}
          flags={shown?.result.flags.filter((x) => x.level !== "info") ?? []}
        />
        {v && v.containers.length > 0 && (
          <CompareTable
            caption={`How many cartons fit in a container${v.upright ? " (this side up)" : ""}`}
            columns={[
              { key: "name", label: "Container" },
              { key: "fit", label: "Cartons per container" },
              { key: "stack", label: "Stacking (L × W × H)" },
              { key: "limit", label: "Limited by" },
              { key: "needed", label: `Containers for ${fmt(v.qty, 0)}` },
              { key: "used", label: "Space used" },
            ]}
            rows={v.containers.map((c) => ({
              name: c.name,
              fit: fitCell(c),
              stack: c.grid
                ? `${c.grid.join(" × ")}, carton as ${c.orientation!.map((x) => fmt(x)).join(" × ")} ${lu}`
                : "–",
              limit: c.limit === "weight" ? "Weight" : c.limit === "space" ? "Space" : "–",
              needed:
                c.needed === null
                  ? "–"
                  : c.needed > 1 || (c.lastHolds ?? 0) < c.fit
                    ? `${fmt(c.needed, 0)} (last holds ${fmt(c.lastHolds ?? 0, 0)})`
                    : fmt(c.needed, 0),
              used: c.fit > 0 ? `${fmt(c.utilisation * 100, 1)} %` : "–",
            }))}
          />
        )}
        {v && shown && (
          <div className={s.ctaRow}>
            <QuoteCTA
              label="Quote cartons at this size"
              prefill={{
                tool: SLUG,
                l: shown.input.l,
                w: shown.input.w,
                h: shown.input.h,
                unit: QUOTE_UNIT[lu],
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
