// Step G content for tool 3. Every chart and FAQ number is computed by the
// engine from paper-grades.json, boards.json and flutes.json (section 13.4).
import { convertPaperWeight, fmtRange, type PaperWeightValue } from "@core/tools/paper-weight";
import { paperWeightInputSchema } from "@core/schemas/paper-weight";
import {
  BOARD_IDS,
  GRADE_IDS,
  boardRules,
  gsmPerLb,
  paperGradeRules,
  type GradeId,
} from "@core/schemas/paper";
import { FLUTE_IDS, fluteRules } from "@core/schemas/boxes";
import { roundDisplay } from "@core/lib/round";
import { CM_PER_IN, MM_PER_PT, UM_PER_PT } from "@core/lib/units";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const conv = (raw: Record<string, unknown>) =>
  convertPaperWeight(paperWeightInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => conv(raw).value as PaperWeightValue;
const lb = (v: PaperWeightValue, id: GradeId) => v.grades.find((g) => g.id === id)!.lb.typical;
const n = (x: number, dp = 1) => roundDisplay(x, dp);
const grades = paperGradeRules.grades;
const factor = (id: GradeId) => gsmPerLb(grades[id]);
const sbs = boardRules.boards.sbs;
const crb = boardRules.boards.crb;

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={conv(raw).explain} title={null} />
    </div>
  );
}

const CHART_GSM = [75, 90, 100, 120, 150, 176, 200, 216, 250, 270, 300, 350, 400];
const CHART_PT = [10, 12, 14, 16, 18, 20, 24];

const ex300 = val({ value: 300, from: "gsm" });
const ex350 = val({ value: 350, from: "gsm" });
const ptGsm = (pt: number, board = "sbs") => val({ value: pt, from: "pt", board }).gsm;
const text80 = val({ value: 80, from: "lb", grade: "text" }).gsm.typical;
const cover80 = val({ value: 80, from: "lb", grade: "cover" }).gsm.typical;
const bond80 = val({ value: 80, from: "lb", grade: "bond" }).gsm.typical;

const faq = [
  {
    q: "How many gsm is 18 pt?",
    a:
      `It depends on the board's density. For SBS paperboard (typical ${n(sbs.densityGcm3.typical, 2)} g/cm³), ` +
      [14, 16, 18, 24]
        .map((pt) => {
          const g = ptGsm(pt);
          return `${pt} pt is about ${n(g.typical, 0)} gsm (${n(g.min, 0)}–${n(g.max, 0)})`;
        })
        .join(", ") +
      `. Caliper (pt) measures thickness and gsm measures weight, so any single conversion number is an estimate. A mill's spec sheet gives the exact figure.`,
  },
  {
    q: "How do I convert gsm to lb?",
    a: `Divide gsm by the factor for the paper grade: ${(
      ["bond", "text", "cover", "index"] as const
    )
      .map((id) => `${grades[id].name.toLowerCase()} ${n(factor(id), 4)}`)
      .join(
        ", ",
      )}, and ${n(factor("paperboard"), 4)} for paperboard quoted in lb per 1,000 sq ft. To go from lb to gsm, multiply instead. Each factor is 453.59237 g (one pound) divided by the area of that grade's basis ream in square meters.`,
  },
  {
    q: "What is 350 gsm in lb?",
    a: `350 gsm is ${n(lb(ex350, "cover"))} lb cover, ${n(lb(ex350, "index"))} lb index, ${n(lb(ex350, "text"))} lb text, ${n(lb(ex350, "bond"))} lb bond, or ${n(lb(ex350, "paperboard"))} lb per 1,000 sq ft as paperboard. As SBS board it is about ${n(ex350.caliperPt.typical)} pt thick.`,
  },
  {
    q: "What does caliper (pt) mean?",
    a: `Caliper is the thickness of a sheet. In the US it is quoted in points: 1 pt = 0.001 in = ${MM_PER_PT} mm = ${UM_PER_PT} µm. So 18 pt board is 0.018 in (${n(18 * MM_PER_PT, 3)} mm) thick. Folding cartons are usually specified by caliper; paper is usually specified by weight.`,
  },
  {
    q: 'Why does "80 lb" mean different papers?',
    a: `US basis weight is the weight of a ream at the grade's own basis sheet size, and each grade uses a different size. 80 lb bond is ${n(bond80)} gsm, 80 lb text is ${n(text80)} gsm and 80 lb cover is ${n(cover80)} gsm. Always say which grade an lb number belongs to, or compare in gsm.`,
  },
  {
    q: "Why do other paper weight charts differ slightly?",
    a: `Many charts use rounded factors, such as 2.708 for cover or 1.813 for index. The exact factors from the basis ream sizes are ${n(factor("cover"), 4)} and ${n(factor("index"), 4)}, so ${n(300)} gsm is ${n(lb(ex300, "cover"))} lb cover rather than 110.8. The difference is about 0.1 %.`,
  },
];

export const paperWeightContent: ToolContent = {
  answer: (
    <>
      Convert paper and board between gsm, basis weight in lb (for each grade) and caliper in pt, mm
      or µm. Caliper is shown as a range from the board&apos;s density, because one fixed number
      would be wrong for most boards.
    </>
  ),
  ogLine: `300 gsm = ${n(lb(ex300, "cover"))} lb cover ≈ ${n(ex300.caliperPt.typical)} pt SBS`,
  keyTakeaway: (
    <p>
      To convert gsm to lb, divide by the grade&apos;s factor: {n(factor("cover"), 4)} for cover,{" "}
      {n(factor("text"), 4)} for text and {n(factor("bond"), 4)} for bond. So 300 gsm is{" "}
      {n(lb(ex300, "cover"))} lb cover but {n(lb(ex300, "bond"))} lb bond. Caliper (pt) measures
      thickness, so converting it to gsm needs the board&apos;s density: 300 gsm SBS is{" "}
      {fmtRange(ex300.caliperPt, 1, "pt")}. Pack Legacy confirms the exact board from the
      mill&apos;s spec sheet before printing.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>Basis weight to gsm.</strong> Each grade has a basis ream, for example cover is 500
        sheets of 20 × 26 in. The factor is 453.59237 g ÷ the ream&apos;s area in m², and gsm = lb ×
        factor. Factors are computed from the ream size, not copied from a chart.
      </li>
      <li>
        <strong>Paperboard</strong> is quoted in lb per 1,000 sq ft, so its factor is 453.59237 ÷
        92.90304 = {n(factor("paperboard"), 4)}.
      </li>
      <li>
        <strong>Caliper units</strong> are exact: 1 pt = 0.001 in = 25.4 µm, 1 mm = 1,000 µm.
      </li>
      <li>
        <strong>gsm to caliper</strong>: thickness (µm) = gsm ÷ density (g/cm³). Each board type has
        a minimum, typical and maximum density, so the result is a range with the typical value
        first.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example
        title="300 gsm to lb cover and pt"
        raw={{ value: 300, from: "gsm", grade: "cover" }}
      />
      <Example title="16 pt SBS to gsm" raw={{ value: 16, from: "pt", board: "sbs" }} />
      <Example title="100 lb cover to gsm" raw={{ value: 100, from: "lb", grade: "cover" }} />
    </>
  ),
  referenceTables: (
    <>
      <h3>Paper weight chart (gsm to lb by grade)</h3>
      <CompareTable
        caption={`Basis weight for common grammages; caliper for SBS at ${n(sbs.densityGcm3.typical, 2)} g/cm³ (typical)`}
        columns={[
          { key: "gsm", label: "gsm" },
          { key: "bond", label: "Bond (lb)" },
          { key: "text", label: "Text (lb)" },
          { key: "cover", label: "Cover (lb)" },
          { key: "index", label: "Index (lb)" },
          { key: "pt", label: "SBS caliper (pt)" },
        ]}
        rows={CHART_GSM.map((gsm) => {
          const v = val({ value: gsm, from: "gsm" });
          return {
            gsm: String(gsm),
            bond: n(lb(v, "bond")),
            text: n(lb(v, "text")),
            cover: n(lb(v, "cover")),
            index: n(lb(v, "index")),
            pt: `≈ ${n(v.caliperPt.typical)}`,
          };
        })}
      />
      <h3>Paperboard caliper chart (pt to gsm)</h3>
      <CompareTable
        caption="Estimated grammage by caliper; ranges come from each board's density range"
        columns={[
          { key: "pt", label: "Caliper" },
          { key: "mm", label: "mm" },
          { key: "sbs", label: "SBS (gsm)" },
          { key: "crb", label: "CRB (gsm)" },
          { key: "lbft", label: "SBS (lb / 1,000 sq ft)" },
        ]}
        rows={CHART_PT.map((pt) => {
          const s = ptGsm(pt, "sbs");
          const c = ptGsm(pt, "crb");
          return {
            pt: `${pt} pt`,
            mm: n(pt * MM_PER_PT, 3),
            sbs: `${n(s.typical, 0)} (${n(s.min, 0)}–${n(s.max, 0)})`,
            crb: `${n(c.typical, 0)} (${n(c.min, 0)}–${n(c.max, 0)})`,
            lbft: n(s.typical / factor("paperboard"), 0),
          };
        })}
      />
      <h3>Basis ream sizes and exact factors</h3>
      <CompareTable
        columns={[
          { key: "grade", label: "Grade" },
          { key: "basis", label: "Basis size" },
          { key: "factor", label: "gsm per lb" },
        ]}
        rows={GRADE_IDS.map((id) => {
          const g = grades[id];
          return {
            grade: g.name,
            basis:
              "basisAreaFt2" in g
                ? `${roundDisplay(g.basisAreaFt2, 0)} sq ft`
                : `${g.basisSheetIn.map((x) => n(x, 2)).join(" × ")} in, ${g.sheetsPerReam} sheets`,
            factor: n(factor(id), 4),
          };
        })}
      />
      <h3>Board density ranges used</h3>
      <CompareTable
        columns={[
          { key: "board", label: "Board" },
          { key: "density", label: "Density (g/cm³)" },
        ]}
        rows={BOARD_IDS.map((id) => {
          const d = boardRules.boards[id].densityGcm3;
          return {
            board: boardRules.boards[id].name,
            density: `${n(d.min, 2)}–${n(d.max, 2)}, typical ${n(d.typical, 2)}`,
          };
        })}
      />
      <h3>Corrugated flute thickness (reference)</h3>
      <CompareTable
        caption="Nominal board thickness by flute; corrugated is sold by flute and test, not gsm"
        columns={[
          { key: "flute", label: "Flute" },
          { key: "in", label: "Inches" },
          { key: "mm", label: "mm" },
        ]}
        rows={FLUTE_IDS.map((id) => {
          const fl = fluteRules.flutes[id];
          return {
            flute: fl.name,
            in: n(fl.caliperIn, 4),
            mm: n(fl.caliperIn * CM_PER_IN * 10, 1),
          };
        })}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Quoting lb without the grade.</strong> &ldquo;80 lb&rdquo; is {n(bond80, 0)} gsm as
        bond but {n(cover80, 0)} gsm as cover.
      </li>
      <li>
        <strong>Treating pt and gsm as the same thing.</strong> One is thickness, the other weight.
        A dense board is thinner at the same gsm.
      </li>
      <li>
        <strong>Trusting one fixed pt-to-gsm number.</strong> 16 pt SBS can be anywhere from{" "}
        {n(ptGsm(16).min, 0)} to {n(ptGsm(16).max, 0)} gsm depending on the mill.
      </li>
      <li>
        <strong>Using rounded factors as exact.</strong> 2.708 for cover is a rounding; the exact
        factor is {n(factor("cover"), 4)}.
      </li>
      <li>
        <strong>Assuming every board weighs the same at one caliper.</strong> At 16 pt, typical{" "}
        {sbs.name} is about {n(ptGsm(16, "sbs").typical, 0)} gsm and typical {crb.name} about{" "}
        {n(ptGsm(16, "crb").typical, 0)} gsm, because their densities differ.
      </li>
    </ul>
  ),
  faq,
  extraSources: [
    {
      source: "Wikipedia: Grammage (basis ream sizes)",
      sourceUrl: "https://en.wikipedia.org/wiki/Grammage",
    },
  ],
};
