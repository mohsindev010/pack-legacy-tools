// Tool 3: Paper Weight Converter (GSM, lb, pt, mm). Spec: specs/paper-weight-converter.md.
// Pure function. Uses the stock-based factors of the Custom Box Makers paper weight
// chart (Pack Legacy tester requirement, 17 Nov 2026), from paper-conversion.json.

import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { roundDisplay } from "../lib/round";
import {
  STOCK_IDS,
  paperRules,
  type LbBasis,
  type PaperConversionFile,
  type StockId,
} from "../schemas/paper";
import type { PaperUnit, PaperWeightInput } from "../schemas/paper-weight";

/** One stock type's equivalents for the same GSM. */
export type StockRow = {
  id: StockId;
  name: string;
  gsmPerPt: number;
  lbBasis: LbBasis;
  pt: number;
  mm: number;
  lb: number;
};

export type PaperWeightValue = {
  from: PaperUnit;
  value: number;
  stock: StockId;
  gsm: number;
  pt: number;
  mm: number;
  lb: number;
  lbBasis: LbBasis;
  /** Same GSM on every stock type (why pt depends on the stock). */
  stocks: StockRow[];
};

export type PaperRules = PaperConversionFile;
export const DEFAULT_PAPER_RULES: PaperRules = paperRules;

const n = (x: number, dp = 1) => roundDisplay(x, dp);
export const UNIT_LABEL: Record<PaperUnit, string> = { gsm: "GSM", lb: "lb", pt: "pt", mm: "mm" };

export function convertPaperWeight(
  input: PaperWeightInput,
  rules: PaperRules = DEFAULT_PAPER_RULES,
): ToolResult<PaperWeightValue> {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const st = rules.stocks[input.stock];
  const lbRule = rules.lb[st.lbBasis];
  const mmPerPt = rules.mmPerPt;
  const v = input.value;

  // 1. Everything goes through GSM.
  let gsm: number;
  switch (input.from) {
    case "gsm":
      gsm = v;
      break;
    case "pt":
      gsm = v * st.gsmPerPt;
      explain.push({
        text: `${st.name}: ${n(v, 2)} pt × ${n(st.gsmPerPt, 1)} = ${n(gsm)} GSM`,
        formula: st.formula,
        ruleRef: `paper-conversion.stocks.${st.id}`,
      });
      break;
    case "mm": {
      const pt = v / mmPerPt;
      gsm = pt * st.gsmPerPt;
      explain.push({
        text: `${n(v, 3)} mm ÷ ${mmPerPt} = ${n(pt, 2)} pt (1 pt = 0.001 in = 0.0254 mm)`,
        ruleRef: "paper-conversion.mmPerPt",
      });
      explain.push({
        text: `${st.name}: ${n(pt, 2)} pt × ${n(st.gsmPerPt, 1)} = ${n(gsm)} GSM`,
        formula: st.formula,
        ruleRef: `paper-conversion.stocks.${st.id}`,
      });
      break;
    }
    case "lb":
      gsm = v * lbRule.gsmPerLb;
      explain.push({
        text: `${st.name} is quoted in ${lbRule.name}: ${n(v)} lb × ${lbRule.gsmPerLb} = ${n(gsm)} GSM`,
        formula: lbRule.formula,
        ruleRef: `paper-conversion.lb.${lbRule.id}`,
      });
      break;
  }

  // 2. GSM to the other units for the chosen stock.
  const row = (id: StockId): StockRow => {
    const s = rules.stocks[id];
    const pt = gsm / s.gsmPerPt;
    return {
      id,
      name: s.name,
      gsmPerPt: s.gsmPerPt,
      lbBasis: s.lbBasis,
      pt,
      mm: pt * mmPerPt,
      lb: gsm / rules.lb[s.lbBasis].gsmPerLb,
    };
  };
  const mine = row(input.stock);
  if (input.from !== "pt" && input.from !== "mm") {
    explain.push({
      text: `Caliper: ${n(gsm)} GSM ÷ ${n(st.gsmPerPt, 1)} = ${n(mine.pt)} pt`,
      formula: "PT ≈ GSM ÷ factor",
      ruleRef: `paper-conversion.stocks.${st.id}`,
    });
  }
  if (input.from !== "mm") {
    explain.push({
      text: `Thickness: ${n(mine.pt, 2)} pt × ${mmPerPt} = ${n(mine.mm, 3)} mm`,
      ruleRef: "paper-conversion.mmPerPt",
    });
  }
  if (input.from !== "lb") {
    explain.push({
      text: `Basis weight: ${n(gsm)} GSM ÷ ${lbRule.gsmPerLb} = ${n(mine.lb)} lb (${lbRule.name.replace(" (lb)", "").toLowerCase()})`,
      formula: lbRule.formula.replace("GSM ≈ lbs × ", "lbs ≈ GSM ÷ "),
      ruleRef: `paper-conversion.lb.${lbRule.id}`,
    });
  }

  flags.push(
    flag(
      "info",
      "APPROXIMATE",
      "These are standard approximations by stock type. The mill's spec sheet gives the exact figure for a particular board.",
    ),
  );

  const rules_: RuleCitation[] = [cite(`paper-conversion.stocks.${st.id}`, st)];
  return okResult(
    {
      from: input.from,
      value: v,
      stock: input.stock,
      gsm,
      pt: mine.pt,
      mm: mine.mm,
      lb: mine.lb,
      lbBasis: st.lbBasis,
      stocks: STOCK_IDS.map(row),
    },
    explain,
    flags,
    rules_,
  );
}
