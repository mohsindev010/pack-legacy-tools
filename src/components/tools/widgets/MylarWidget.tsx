"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { findMylarBag, type MylarValue } from "@core/tools/mylar";
import {
  MASS_UNITS,
  PRODUCT_IDS,
  densityRules,
  mylarFromQuery,
  mylarInputSchema,
  mylarRules,
  mylarToQuery,
  type MassUnit,
  type MylarInput,
  type ProductId,
} from "@core/schemas/storage";
import { roundDisplay } from "@core/lib/round";
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

const SLUG = "mylar-bag-size-finder";

type Fields = {
  weight: string;
  unit: MassUnit;
  product: ProductId | "custom";
  density: string;
  headspace: string;
};
const DEFAULT: Fields = { weight: "4", unit: "lb", product: "rice", density: "", headspace: "" };

const fmt = (x: number, dp = 2) => roundDisplay(x, dp);
const dims = (w: number, h: number, g: number) => `${w} × ${h} in${g ? ` + ${g} in gusset` : ""}`;
const QT_PER_L = 1 / 0.946352946;

export function MylarWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`MylarWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    const q = readQuery();
    if (!q.wt) return;
    const parsed = mylarInputSchema.safeParse(mylarFromQuery(q));
    if (!parsed.success) return;
    const i = parsed.data;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    setFields({
      weight: String(i.weight),
      unit: i.unit,
      product: i.product,
      density: i.density === undefined ? "" : String(i.density),
      headspace: i.headspace === undefined ? "" : String(i.headspace),
    });
  }, []);

  const parsed = useMemo(() => mylarInputSchema.safeParse({ ...fields }), [fields]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: findMylarBag(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: MylarInput;
    result: ToolResult<MylarValue>;
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
      writeQuery(mylarToQuery(current.input));
      track({ name: "tool_calculated", slug: SLUG, inputsHash: hashInputs(current.input) });
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  const v = shown?.result.value;
  const rec = v ? v.bags.find((b) => b.id === v.recommended)! : null;
  const headline = rec ? `${v!.bagsNeeded > 1 ? `${v!.bagsNeeded} × ` : ""}${rec.name}` : "–";
  const values =
    v && rec
      ? [
          { label: "Bag size", value: dims(rec.widthIn, rec.heightIn, rec.gussetIn) },
          {
            label: "Product volume",
            value: `${fmt(v.productL, 2)} L (${fmt(v.productL * QT_PER_L, 2)} qt)`,
          },
          { label: "Fill", value: `${fmt((rec.fill / v.bagsNeeded) * 100, 0)} %` },
        ]
      : [];
  const quoteDetails =
    v && rec
      ? `Mylar bag for ${fmt(v.weight)} ${v.unit} of ${v.productName.toLowerCase()} (${fmt(v.productL, 2)} L): ${rec.name}, ${dims(rec.widthIn, rec.heightIn, rec.gussetIn)}.`
      : "";

  return (
    <div className={f.widget}>
      <ToolForm label="Product and fill weight">
        <UnitToggle
          legend="Weight unit"
          value={fields.unit}
          onChange={(u) => set("unit", u)}
          options={MASS_UNITS.map((u) => ({ value: u, label: u }))}
        />
        <NumberField
          label="Fill weight per bag"
          unit={fields.unit}
          value={fields.weight}
          onChange={(x) => set("weight", x)}
          error={errors.weight}
          min={0}
        />
        <div className={f.field}>
          <label className={f.label} htmlFor="my-product">
            Product
          </label>
          <select
            id="my-product"
            className={f.select}
            value={fields.product}
            onChange={(e) => set("product", e.target.value as Fields["product"])}
          >
            {PRODUCT_IDS.map((id) => (
              <option key={id} value={id}>
                {densityRules.entries[id].name} ({densityRules.entries[id].kgM3} g/L)
              </option>
            ))}
            <option value="custom">Other (enter density)</option>
          </select>
        </div>
        {fields.product === "custom" && (
          <NumberField
            label="Bulk density"
            unit="g/L"
            hint="Weigh a level litre of the product in grams."
            value={fields.density}
            onChange={(x) => set("density", x)}
            error={errors.density}
          />
        )}
        <NumberField
          label="Headspace for sealing"
          unit="%"
          hint={`Empty = ${mylarRules.defaultHeadspacePct} %.`}
          value={fields.headspace}
          onChange={(x) => set("headspace", x)}
          error={errors.headspace}
        />
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={current ? "Recommended bag" : "Fix the highlighted fields (showing last result)"}
          headline={headline}
          values={values}
          flags={shown?.result.flags.filter((x) => x.level !== "info") ?? []}
        />
        {v && (
          <CompareTable
            caption={`Every bag size for ${fmt(v.weight)} ${v.unit} of ${v.productName.toLowerCase()}`}
            columns={[
              { key: "name", label: "Bag" },
              { key: "dims", label: "Size (W × H)" },
              { key: "cap", label: "Capacity" },
              { key: "fill", label: "Fill" },
              { key: "holds", label: `Holds up to (${v.unit})` },
            ]}
            rows={v.bags.map((b) => ({
              name: b.name,
              dims: dims(b.widthIn, b.heightIn, b.gussetIn),
              cap: `${fmt(b.capacityL, 2)} L`,
              fill: b.fits ? `${fmt(b.fill * 100, 0)} %` : "Too small",
              holds: fmt(b.holds, 2),
            }))}
            highlightRow={v.bags.findIndex((b) => b.id === v.recommended)}
          />
        )}
        {v && (
          <p className={f.hint}>
            Sealing it for storage? Work out the absorber size with the{" "}
            <Link
              href={`/tools/oxygen-absorber-calculator/?c=${v.recommended}&wt=${v.weight}&wu=${v.unit}`}
            >
              oxygen absorber calculator
            </Link>
            .
          </p>
        )}
        {v && rec && (
          <div className={s.ctaRow}>
            <QuoteCTA
              label="Quote custom mylar bags"
              prefill={{ tool: SLUG, material: "Mylar", details: quoteDetails }}
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
