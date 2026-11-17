"use client";

import { useEffect, useMemo, useState } from "react";
import { convertPaperWeight, UNIT_LABEL, type PaperWeightValue } from "@core/tools/paper-weight";
import {
  PAPER_UNITS,
  paperWeightFromQuery,
  paperWeightInputSchema,
  paperWeightToQuery,
  type PaperUnit,
  type PaperWeightInput,
} from "@core/schemas/paper-weight";
import { STOCK_IDS, paperRules, type StockId } from "@core/schemas/paper";
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

const SLUG = "paper-weight-converter";

type Fields = { value: string; from: PaperUnit; stock: StockId };
const DEFAULT: Fields = { value: "24", from: "pt", stock: "uncoated" };
/** Display precision per unit. */
const DP: Record<PaperUnit, number> = { gsm: 1, lb: 1, pt: 1, mm: 3 };
const lbName = (basis: "text" | "cover") => (basis === "text" ? "lb text" : "lb cover");

function inUnit(v: PaperWeightValue, unit: PaperUnit): number {
  return unit === "gsm" ? v.gsm : unit === "lb" ? v.lb : unit === "pt" ? v.pt : v.mm;
}

export function PaperWeightWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`PaperWeightWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    const q = readQuery();
    if (!q.v) return;
    const parsed = paperWeightInputSchema.safeParse(paperWeightFromQuery(q));
    if (!parsed.success) return;
    const i = parsed.data;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    setFields({ value: String(i.value), from: i.from, stock: i.stock });
  }, []);

  const parsed = useMemo(() => paperWeightInputSchema.safeParse(fields), [fields]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: convertPaperWeight(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: PaperWeightInput;
    result: ToolResult<PaperWeightValue>;
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
      writeQuery(paperWeightToQuery(current.input));
      track({ name: "tool_calculated", slug: SLUG, inputsHash: hashInputs(current.input) });
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  /** Switching the unit converts the current value, so the answer stays the same paper. */
  function switchFrom(next: PaperUnit) {
    if (next === fields.from) return;
    const v = shown?.result.value;
    setFields((cur) => ({
      ...cur,
      from: next,
      value: v
        ? String(Number(roundDisplay(inUnit(v, next), DP[next]).replace(/,/g, "")))
        : cur.value,
    }));
    track({ name: "tool_unit_toggled", slug: SLUG, unit: next });
  }

  const v = shown?.result.value ?? null;
  const stockName = paperRules.stocks[fields.stock].name;
  const all: { unit: PaperUnit; text: string }[] = v
    ? [
        { unit: "gsm", text: `${roundDisplay(v.gsm, 1)} GSM` },
        { unit: "lb", text: `${roundDisplay(v.lb, 1)} ${lbName(v.lbBasis)}` },
        { unit: "pt", text: `${roundDisplay(v.pt, 1)} pt` },
        { unit: "mm", text: `${roundDisplay(v.mm, 3)} mm` },
      ]
    : [];
  const headline = all.find((x) => x.unit === (v?.from === "gsm" ? "lb" : "gsm"))?.text ?? "–";
  const values = all
    .filter((x) => x.unit !== v?.from && x.text !== headline)
    .map((x) => ({
      label:
        x.unit === "mm"
          ? "Thickness"
          : x.unit === "pt"
            ? "Caliper"
            : x.unit === "lb"
              ? "Basis weight"
              : "Grammage",
      value: x.text,
    }));

  const quoteDetails = v
    ? `Board spec: ${stockName}, ${roundDisplay(v.pt, 1)} pt ≈ ${roundDisplay(v.gsm, 0)} GSM ≈ ${roundDisplay(v.lb, 1)} ${lbName(v.lbBasis)} (${roundDisplay(v.mm, 3)} mm). Converted with the Pack Legacy paper weight converter.`
    : "";

  return (
    <div className={f.widget}>
      <ToolForm label="Paper or board weight">
        <UnitToggle
          legend="Convert from"
          value={fields.from}
          onChange={switchFrom}
          options={PAPER_UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }))}
        />
        <NumberField
          label="Value"
          unit={UNIT_LABEL[fields.from]}
          value={fields.value}
          onChange={(x) => set("value", x)}
          error={errors.value}
          min={0}
        />
        <div className={f.field}>
          <label className={f.label} htmlFor="pw-stock">
            Stock type
          </label>
          <select
            id="pw-stock"
            className={f.select}
            value={fields.stock}
            onChange={(e) => set("stock", e.target.value as StockId)}
          >
            {STOCK_IDS.map((id) => (
              <option key={id} value={id}>
                {paperRules.stocks[id].name}
              </option>
            ))}
          </select>
        </div>
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={
            current
              ? `${roundDisplay(Number(fields.value), DP[fields.from])} ${UNIT_LABEL[fields.from]} ${stockName.toLowerCase()} is`
              : "Fix the highlighted field (showing last result)"
          }
          headline={headline}
          values={values}
          flags={shown?.result.flags.filter((x) => x.level !== "info") ?? []}
        />
        {v && (
          <CompareTable
            caption={`${roundDisplay(v.gsm, 1)} GSM on each stock type`}
            columns={[
              { key: "stock", label: "Stock type" },
              { key: "factor", label: "GSM per pt" },
              { key: "pt", label: "Caliper (pt)" },
              { key: "mm", label: "Thickness (mm)" },
              { key: "lb", label: "Basis weight" },
            ]}
            rows={v.stocks.map((r) => ({
              stock: r.name,
              factor: roundDisplay(r.gsmPerPt, 1),
              pt: roundDisplay(r.pt, 1),
              mm: roundDisplay(r.mm, 3),
              lb: `${roundDisplay(r.lb, 1)} ${lbName(r.lbBasis)}`,
            }))}
            highlightRow={v.stocks.findIndex((r) => r.id === fields.stock)}
          />
        )}
        {v && (
          <div className={s.ctaRow}>
            <QuoteCTA
              label="Quote packaging in this board"
              prefill={{ tool: SLUG, material: "Folding Paperboard", details: quoteDetails }}
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
