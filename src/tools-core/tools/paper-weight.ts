// Tool 3: Paper Weight Converter. Spec: specs/paper-weight-converter.md.
// Pure function. Basis reams and board densities come from rules files; the
// gsm-per-lb factors are derived from the ream size, never typed in (D1).

import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { roundDisplay } from "../lib/round";
import { G_PER_LB, UM_PER_MM, UM_PER_PT } from "../lib/units";
import {
  BOARD_IDS,
  GRADE_IDS,
  basisAreaM2,
  boardRules,
  gsmPerLb,
  paperGradeRules,
  type BoardId,
  type BoardsFile,
  type GradeId,
  type PaperGradesFile,
} from "../schemas/paper";
import {
  isCaliperUnit,
  toUm,
  type PaperUnit,
  type PaperWeightInput,
} from "../schemas/paper-weight";

/** A value that is exact (min = typical = max) or estimated from a density range. */
export type Range = { min: number; typical: number; max: number };
const exact = (x: number): Range => ({ min: x, typical: x, max: x });
export const scaleRange = (r: Range, k: number): Range => ({
  min: r.min * k,
  typical: r.typical * k,
  max: r.max * k,
});
export const isExact = (r: Range) => r.max - r.min < 1e-9;

/** "110.9 lb" when exact; "≈ 14.1 pt (13.6–16.2)" when estimated from a range. */
export function fmtRange(r: Range, dp: number, unit: string): string {
  const n = (x: number) => roundDisplay(x, dp);
  return isExact(r)
    ? `${n(r.typical)} ${unit}`
    : `≈ ${n(r.typical)} ${unit} (${n(r.min)}–${n(r.max)})`;
}

/** Caliper in pt from grammage and density: µm = gsm / ρ, pt = µm / 25.4. */
export const ptFromGsm = (gsm: number, densityGcm3: number) => gsm / densityGcm3 / UM_PER_PT;
/** Grammage from caliper in µm and density. */
export const gsmFromUm = (um: number, densityGcm3: number) => um * densityGcm3;

export type GradeRow = {
  id: GradeId;
  name: string;
  /** "17 x 22 in, 500 sheets" or "1,000 sq ft". */
  basis: string;
  factor: number;
  lb: Range;
};

export type BoardRow = {
  id: BoardId;
  name: string;
  material: string;
  density: Range;
  gsm: Range;
  caliperUm: Range;
};

export type PaperWeightValue = {
  from: PaperUnit;
  value: number;
  gradeId: GradeId | null;
  boardId: BoardId;
  /** Grammage: exact for gsm / lb input, a range for caliper input. */
  gsm: Range;
  /** Caliper in µm: exact for caliper input, a range for weight input. */
  caliperUm: Range;
  caliperPt: Range;
  caliperMm: Range;
  grades: GradeRow[];
  boards: BoardRow[];
};

export type PaperRules = { grades: PaperGradesFile; boards: BoardsFile };
export const DEFAULT_PAPER_RULES: PaperRules = { grades: paperGradeRules, boards: boardRules };

const n = (x: number, dp = 1) => roundDisplay(x, dp);
const UNIT_LABEL: Record<PaperUnit, string> = {
  gsm: "gsm",
  lb: "lb",
  pt: "pt",
  mm: "mm",
  um: "µm",
};
export const unitLabel = (u: PaperUnit) => UNIT_LABEL[u];

function basisText(g: PaperGradesFile["grades"][GradeId]): string {
  return "basisAreaFt2" in g
    ? `${n(g.basisAreaFt2, 0)} sq ft`
    : `${g.basisSheetIn.map((x) => n(x, 2)).join(" x ")} in, ${g.sheetsPerReam} sheets`;
}

export function convertPaperWeight(
  input: PaperWeightInput,
  rules: PaperRules = DEFAULT_PAPER_RULES,
): ToolResult<PaperWeightValue | null> {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const citations: RuleCitation[] = [];
  const board = rules.boards.boards[input.board];
  const rho = board.densityGcm3;
  const density: Range = { min: rho.min, typical: rho.typical, max: rho.max };

  if (input.from === "lb" && !input.grade) {
    flags.push(
      flag(
        "error",
        "GRADE_REQUIRED",
        "Choose a paper grade: the same lb number means a different weight in bond, text, cover or board.",
      ),
    );
    return okResult(null, explain, flags, citations);
  }

  // 1. Everything goes through grammage (gsm) and caliper (µm).
  let gsm: Range;
  let caliperUm: Range = exact(0);
  if (input.from === "gsm") {
    gsm = exact(input.value);
  } else if (input.from === "lb") {
    const g = rules.grades.grades[input.grade!];
    const f = gsmPerLb(g);
    gsm = exact(input.value * f);
    explain.push({
      text: `${n(input.value, 2)} lb ${g.name} x ${n(f, 4)} = ${n(gsm.typical, 1)} gsm`,
      formula: "gsm = lb x factor",
      ruleRef: `paper-grades.${g.id}`,
    });
  } else {
    // Caliper input: thickness is exact, grammage depends on density.
    const um = toUm(input.value, input.from as "pt" | "mm" | "um");
    caliperUm = exact(um);
    if (input.from !== "um")
      explain.push({
        text: `${n(input.value, 3)} ${unitLabel(input.from)} = ${n(um, 1)} µm`,
        formula: input.from === "pt" ? "1 pt = 0.001 in = 25.4 µm" : "1 mm = 1,000 µm",
      });
    gsm = scaleRange(density, um);
    explain.push({
      text: `${board.name}: ${n(um, 1)} µm x density ${n(rho.min, 2)}–${n(rho.max, 2)} g/cm³ (typical ${n(rho.typical, 2)}) = ${n(gsm.min, 0)}–${n(gsm.max, 0)} gsm, typical ${n(gsm.typical, 0)} gsm`,
      formula: "gsm = µm x density (g/cm³)",
      ruleRef: `boards.${board.id}.densityGcm3`,
    });
  }

  if (!isCaliperUnit(input.from)) {
    // Weight input: caliper is a range. Higher density = thinner sheet.
    caliperUm = {
      min: gsm.typical / rho.max,
      typical: gsm.typical / rho.typical,
      max: gsm.typical / rho.min,
    };
    explain.push({
      text: `${board.name}: ${n(gsm.typical, 1)} gsm ÷ density ${n(rho.min, 2)}–${n(rho.max, 2)} g/cm³ = ${n(caliperUm.min, 0)}–${n(caliperUm.max, 0)} µm; typical ${n(caliperUm.typical, 0)} µm = ${n(caliperUm.typical / UM_PER_PT, 1)} pt`,
      formula: "µm = gsm ÷ density; pt = µm ÷ 25.4",
      ruleRef: `boards.${board.id}.densityGcm3`,
    });
  }

  // 2. Basis weight in every grade (why "80 lb" is ambiguous).
  const grades: GradeRow[] = GRADE_IDS.map((id) => {
    const g = rules.grades.grades[id];
    const factor = gsmPerLb(g);
    return { id, name: g.name, basis: basisText(g), factor, lb: scaleRange(gsm, 1 / factor) };
  });
  const shownGrade = input.grade ?? "cover";
  const sg = rules.grades.grades[shownGrade];
  const area = basisAreaM2(sg);
  explain.push({
    text: `${sg.name} basis: ${basisText(sg)} = ${n(area, 2)} m². 1 lb = ${G_PER_LB} g, so 1 lb ${sg.name} = ${G_PER_LB} ÷ ${n(area, 2)} = ${n(gsmPerLb(sg), 4)} gsm`,
    formula: "factor = 453.59237 g ÷ basis area (m²)",
    ruleRef: `paper-grades.${sg.id}`,
  });
  if (input.from !== "lb") {
    const lb = grades.find((g) => g.id === shownGrade)!.lb;
    explain.push({
      text: `${isExact(gsm) ? n(gsm.typical, 1) : `${n(gsm.typical, 0)} (typical)`} gsm ÷ ${n(gsmPerLb(sg), 4)} = ${n(lb.typical, 1)} lb ${sg.name}`,
      formula: "lb = gsm ÷ factor",
      ruleRef: `paper-grades.${sg.id}`,
    });
  }

  // 3. The same weight (or caliper) across every board type.
  const boards: BoardRow[] = BOARD_IDS.map((id) => {
    const b = rules.boards.boards[id];
    const d = b.densityGcm3;
    const dr: Range = { min: d.min, typical: d.typical, max: d.max };
    return isCaliperUnit(input.from)
      ? {
          id,
          name: b.name,
          material: b.material,
          density: dr,
          caliperUm,
          gsm: scaleRange(dr, caliperUm.typical),
        }
      : {
          id,
          name: b.name,
          material: b.material,
          density: dr,
          gsm,
          caliperUm: {
            min: gsm.typical / d.max,
            typical: gsm.typical / d.typical,
            max: gsm.typical / d.min,
          },
        };
  });

  flags.push(
    flag(
      "info",
      "DENSITY_ESTIMATE",
      `${isCaliperUnit(input.from) ? "Grammage" : "Caliper"} is estimated from ${board.name} density (${n(rho.min, 2)}–${n(rho.max, 2)} g/cm³), so it is shown as a range.`,
    ),
    flag(
      "info",
      "MILL_SPEC_WINS",
      "A mill's spec sheet for the exact board beats any estimate. Ask your supplier for the caliper and basis weight.",
    ),
  );

  citations.push(cite(`paper-grades.${sg.id}`, sg));
  citations.push(cite(`boards.${board.id}`, board));

  return okResult(
    {
      from: input.from,
      value: input.value,
      gradeId: input.grade ?? null,
      boardId: board.id as BoardId,
      gsm,
      caliperUm,
      caliperPt: scaleRange(caliperUm, 1 / UM_PER_PT),
      caliperMm: scaleRange(caliperUm, 1 / UM_PER_MM),
      grades,
      boards,
    },
    explain,
    flags,
    citations,
  );
}
