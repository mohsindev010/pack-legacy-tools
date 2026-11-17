"use client";

import { useEffect, useMemo, useState } from "react";
import { calcOxygen, type O2Value } from "@core/tools/oxygen";
import {
  BAG_IDS,
  MASS_UNITS,
  O2_CONTAINER_IDS,
  VOLUME_UNITS,
  mylarRules,
  o2FromQuery,
  o2InputSchema,
  o2Rules,
  o2ToQuery,
  type MassUnit,
  type O2Container,
  type O2Input,
  type VolumeUnit,
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

const SLUG = "oxygen-absorber-calculator";

type Fields = {
  container: O2Container;
  volume: string;
  volumeUnit: VolumeUnit;
  weight: string;
  weightUnit: MassUnit;
  count: string;
};
const DEFAULT: Fields = {
  container: "gallon-zip",
  volume: "",
  volumeUnit: "L",
  weight: "4",
  weightUnit: "lb",
  count: "1",
};
const VOLUME_LABEL: Record<VolumeUnit, string> = {
  gal: "gal",
  qt: "qt",
  L: "L",
  cc: "cc (mL)",
  in3: "in³",
};

const fmt = (x: number, dp = 0) => roundDisplay(x, dp);

export function OxygenWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`OxygenWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    const q = readQuery();
    if (!q.c) return;
    const parsed = o2InputSchema.safeParse(o2FromQuery(q));
    if (!parsed.success) return;
    const i = parsed.data;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    setFields({
      container: i.container,
      volume: i.volume === undefined ? "" : String(i.volume),
      volumeUnit: i.volumeUnit,
      weight: i.weight === undefined ? "" : String(i.weight),
      weightUnit: i.weightUnit,
      count: String(i.count),
    });
  }, []);

  const parsed = useMemo(() => o2InputSchema.safeParse({ ...fields }), [fields]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: calcOxygen(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: O2Input;
    result: ToolResult<O2Value>;
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
      writeQuery(o2ToQuery(current.input));
      track({ name: "tool_calculated", slug: SLUG, inputsHash: hashInputs(current.input) });
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  const v = shown?.result.value;
  const plan = v?.perContainer.sizes ?? [];
  const headline = v
    ? plan.length
      ? plan.map((x) => `${fmt(x)} cc`).join(" + ")
      : "Check the inputs"
    : "–";
  const values = v
    ? [
        { label: "Oxygen to absorb", value: `${fmt(v.oxygenCc, 1)} cc` },
        { label: "Residual air", value: `${fmt(v.airCc)} cc` },
        { label: "Container", value: `${fmt(v.containerCc)} cc` },
        ...(v.count > 1
          ? [
              {
                label: `For ${v.count} containers`,
                value: v.shoppingList.map((x) => `${x.packets} × ${x.sizeCc} cc`).join(", "),
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className={f.widget}>
      <ToolForm label="Container and product">
        <div className={f.field}>
          <label className={f.label} htmlFor="o2-container">
            Container
          </label>
          <select
            id="o2-container"
            className={f.select}
            value={fields.container}
            onChange={(e) => set("container", e.target.value as O2Container)}
          >
            <optgroup label="Mylar bags">
              {BAG_IDS.map((id) => (
                <option key={id} value={id}>
                  {mylarRules.bags[id].name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cans and pails">
              {O2_CONTAINER_IDS.map((id) => (
                <option key={id} value={id}>
                  {o2Rules.containers[id].name}
                </option>
              ))}
            </optgroup>
            <option value="custom">Other (enter volume)</option>
          </select>
        </div>
        {fields.container === "custom" && (
          <>
            <UnitToggle
              legend="Volume unit"
              value={fields.volumeUnit}
              onChange={(u) => set("volumeUnit", u)}
              options={VOLUME_UNITS.map((u) => ({ value: u, label: VOLUME_LABEL[u] }))}
            />
            <NumberField
              label="Container volume"
              unit={VOLUME_LABEL[fields.volumeUnit]}
              value={fields.volume}
              onChange={(x) => set("volume", x)}
              error={errors.volume}
              min={0}
            />
          </>
        )}
        <UnitToggle
          legend="Weight unit"
          value={fields.weightUnit}
          onChange={(u) => set("weightUnit", u)}
          options={MASS_UNITS.map((u) => ({ value: u, label: u }))}
        />
        <div className={f.fieldRow}>
          <NumberField
            label="Product weight in it"
            unit={fields.weightUnit}
            hint="Empty = empty container (most absorber)."
            value={fields.weight}
            onChange={(x) => set("weight", x)}
            error={errors.weight}
            min={0}
          />
          <NumberField
            label="Number of containers"
            unit="containers"
            value={fields.count}
            onChange={(x) => set("count", x)}
            error={errors.count}
            min={1}
            step={1}
          />
        </div>
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={
            current
              ? "Oxygen absorber per container"
              : "Fix the highlighted fields (showing last result)"
          }
          headline={headline}
          values={values}
          flags={shown?.result.flags.filter((x) => x.level !== "info") ?? []}
        />
        {v && v.oxygenCc > 0 && (
          <CompareTable
            caption="If you stock only one packet size"
            columns={[
              { key: "size", label: "Packet size" },
              { key: "per", label: "Per container" },
              { key: "total", label: `For ${v.count} container${v.count === 1 ? "" : "s"}` },
            ]}
            rows={v.singleSize.map((x) => ({
              size: `${fmt(x.sizeCc)} cc`,
              per: fmt(x.packets),
              total: fmt(x.packets * v.count),
            }))}
          />
        )}
        {v && plan.length > 0 && (
          <div className={s.ctaRow}>
            <QuoteCTA
              label="Quote mylar bags"
              prefill={{
                tool: SLUG,
                material: "Mylar",
                details: `${v.count} × ${v.containerName}, ${fmt(v.oxygenCc, 1)} cc oxygen each; absorber ${plan.map((x) => `${x} cc`).join(" + ")} per container.`,
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
