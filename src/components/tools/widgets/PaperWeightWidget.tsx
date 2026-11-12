"use client";

import { useEffect, useMemo, useState } from "react";
import {
  convertPaperWeight,
  fmtRange,
  scaleRange,
  unitLabel,
  type PaperWeightValue,
  type Range,
} from "@core/tools/paper-weight";
import {
  PAPER_UNITS,
  paperWeightFromQuery,
  paperWeightInputSchema,
  paperWeightToQuery,
  type PaperUnit,
  type PaperWeightInput,
} from "@core/schemas/paper-weight";
import {
  BOARD_IDS,
  GRADE_IDS,
  boardRules,
  paperGradeRules,
  type BoardId,
  type GradeId,
} from "@core/schemas/paper";
import { roundDisplay } from "@core/lib/round";
import { UM_PER_MM, UM_PER_PT } from "@core/lib/units";
import type { ToolResult } from "@core/lib/result";
import { NumberField } from "../NumberField";
import { UnitToggle } from "../UnitToggle";
import { ToolForm } from "../ToolForm";
import { ResultCard, FlagList } from "../ResultCard";
import { CompareTable } from "../CompareTable";
import { ExplainSteps } from "../ExplainSteps";
import { QuoteCTA } from "../QuoteCTA";
import { hashInputs, track } from "../analytics";
import { readQuery, writeQuery } from "../urlState";
import type { WidgetProps } from "./index";
import f from "../form.module.css";
import s from "../tools.module.css";

const SLUG = "paper-weight-converter";

type Fields = { value: string; from: PaperUnit; grade: GradeId; board: BoardId };
const DEFAULT: Fields = { value: "300", from: "gsm", grade: "cover", board: "sbs" };
const DP: Record<PaperUnit, number> = { gsm: 1, lb: 1, pt: 1, mm: 3, um: 0 };

const gradeName = (id: GradeId) => paperGradeRules.grades[id].name;
const boardName = (id: BoardId) => boardRules.boards[id].name;

/** The typical value of a result in any unit (used when switching the from-unit). */
function inUnit(v: PaperWeightValue, unit: PaperUnit, grade: GradeId): Range {
  switch (unit) {
    case "gsm":
      return v.gsm;
    case "lb":
      return v.grades.find((g) => g.id === grade)!.lb;
    case "pt":
      return v.caliperPt;
    case "mm":
      return v.caliperMm;
    case "um":
      return v.caliperUm;
  }
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
    setFields({ value: String(i.value), from: i.from, grade: i.grade ?? "cover", board: i.board });
  }, []);

  const parsed = useMemo(() => paperWeightInputSchema.safeParse(fields), [fields]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: convertPaperWeight(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: PaperWeightInput;
    result: ToolResult<PaperWeightValue | null>;
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

  /** Switching the unit converts the current value (typical) so the answer stays the same paper. */
  function switchFrom(next: PaperUnit) {
    if (next === fields.from) return;
    const v = shown?.result.value;
    setFields((cur) => ({
      ...cur,
      from: next,
      value: v
        ? String(
            Number(roundDisplay(inUnit(v, next, cur.grade).typical, DP[next]).replace(/,/g, "")),
          )
        : cur.value,
    }));
    track({ name: "tool_unit_toggled", slug: SLUG, unit: next });
  }

  const v = shown?.result.value ?? null;
  const g = fields.grade;
  const lb = v ? inUnit(v, "lb", g) : null;
  const fromCaliper = v ? v.from === "pt" || v.from === "mm" || v.from === "um" : false;
  const bName = boardName(fields.board);

  let headline = "–";
  const values: { label: string; value: string }[] = [];
  if (v && lb) {
    if (v.from === "gsm") headline = `${fmtRange(lb, 1, "lb")} ${gradeName(g).toLowerCase()}`;
    else if (v.from === "lb") headline = fmtRange(v.gsm, 1, "gsm");
    else {
      headline = fmtRange(v.gsm, 0, "gsm");
      values.push({ label: `Basis weight (${gradeName(g)})`, value: fmtRange(lb, 1, "lb") });
    }
    values.push(
      { label: `Caliper (${bName})`, value: fmtRange(v.caliperPt, 1, "pt") },
      { label: "Thickness", value: fmtRange(v.caliperMm, 3, "mm") },
    );
  }

  const quoteDetails = v
    ? `Board spec: ${roundDisplay(v.caliperPt.typical, 1)} pt ${bName} (~${roundDisplay(v.gsm.typical, 0)} gsm typical` +
      (v.gsm.min !== v.gsm.max
        ? `, ${roundDisplay(v.gsm.min, 0)}–${roundDisplay(v.gsm.max, 0)} range)`
        : `, caliper ${roundDisplay(v.caliperPt.min, 1)}–${roundDisplay(v.caliperPt.max, 1)} pt)`) +
      ". Converted with the Pack Legacy paper weight converter."
    : "";

  return (
    <div className={f.widget}>
      <ToolForm label="Paper or board weight">
        <UnitToggle
          legend="Convert from"
          value={fields.from}
          onChange={switchFrom}
          options={PAPER_UNITS.map((u) => ({ value: u, label: unitLabel(u) }))}
        />
        <NumberField
          label="Weight or caliper"
          unit={unitLabel(fields.from)}
          value={fields.value}
          onChange={(x) => set("value", x)}
          error={errors.value}
          min={0}
        />
        <div className={f.fieldRow}>
          <div className={f.field}>
            <label className={f.label} htmlFor="pw-grade">
              Paper grade (for lb)
            </label>
            <select
              id="pw-grade"
              className={f.select}
              value={fields.grade}
              onChange={(e) => set("grade", e.target.value as GradeId)}
            >
              {GRADE_IDS.map((id) => (
                <option key={id} value={id}>
                  {gradeName(id)}
                </option>
              ))}
            </select>
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor="pw-board">
              Board type (for caliper)
            </label>
            <select
              id="pw-board"
              className={f.select}
              value={fields.board}
              onChange={(e) => set("board", e.target.value as BoardId)}
            >
              {BOARD_IDS.map((id) => (
                <option key={id} value={id}>
                  {boardName(id)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={
            current
              ? `${roundDisplay(Number(fields.value), DP[fields.from])} ${unitLabel(fields.from)}${fields.from === "lb" ? ` ${gradeName(g).toLowerCase()}` : ""} is`
              : "Fix the highlighted field (showing last result)"
          }
          headline={headline}
          values={values}
          flags={shown?.result.flags.filter((x) => x.level !== "info") ?? []}
        />
        {v && (
          <CompareTable
            caption={`The same ${fromCaliper ? "board" : "weight"} in every grade (why "80 lb" can mean different papers)`}
            columns={[
              { key: "grade", label: "Grade" },
              { key: "basis", label: "Basis size" },
              { key: "factor", label: "gsm per lb" },
              { key: "lb", label: "Basis weight" },
            ]}
            rows={v.grades.map((r) => ({
              grade: r.name,
              basis: r.basis,
              factor: roundDisplay(r.factor, 4),
              lb: fmtRange(r.lb, 1, "lb"),
            }))}
            highlightRow={v.grades.findIndex((r) => r.id === g)}
          />
        )}
        {v && (
          <CompareTable
            caption={
              fromCaliper
                ? "Grammage at this caliper by board type (density range)"
                : "Caliper at this weight by board type (density range)"
            }
            columns={[
              { key: "board", label: "Board" },
              { key: "density", label: "Density (g/cm³)" },
              { key: "pt", label: "Caliper (pt)" },
              { key: "mm", label: "Caliper (mm)" },
              { key: "gsm", label: "Grammage" },
            ]}
            rows={v.boards.map((b) => ({
              board: b.name,
              density: `${roundDisplay(b.density.min, 2)}–${roundDisplay(b.density.max, 2)} (typ. ${roundDisplay(b.density.typical, 2)})`,
              pt: fmtRange(scaleRange(b.caliperUm, 1 / UM_PER_PT), 1, "pt"),
              mm: fmtRange(scaleRange(b.caliperUm, 1 / UM_PER_MM), 3, "mm"),
              gsm: fmtRange(b.gsm, fromCaliper ? 0 : 1, "gsm"),
            }))}
            highlightRow={v.boards.findIndex((b) => b.id === fields.board)}
          />
        )}
        {v && (
          <div className={s.ctaRow}>
            <QuoteCTA
              label="Quote packaging in this board"
              prefill={{
                tool: SLUG,
                material: boardRules.boards[fields.board].material,
                details: quoteDetails,
              }}
            />
          </div>
        )}
        {shown && (
          <details className={f.more}>
            <summary>Show the working ({shown.result.explain.length} steps)</summary>
            <ExplainSteps steps={shown.result.explain} title="Step by step" />
            <FlagList flags={shown.result.flags.filter((x) => x.level === "info")} />
          </details>
        )}
      </div>
    </div>
  );
}
