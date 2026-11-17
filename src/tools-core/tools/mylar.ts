// Tool 8: Mylar Bag Size Finder. Spec: specs/mylar-bag-size-finder.md.
// Pure. Bag sizes from mylar-presets.json, densities from bulk-density.json.

import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { roundDisplay } from "../lib/round";
import {
  BAG_IDS,
  G_PER,
  densityRules,
  mylarRules,
  type BagId,
  type DensityFile,
  type MassUnit,
  type MylarFile,
  type MylarInput,
} from "../schemas/storage";

export type BagRow = {
  id: BagId;
  name: string;
  widthIn: number;
  heightIn: number;
  gussetIn: number;
  capacityL: number;
  fits: boolean;
  /** Product volume ÷ bag capacity (0-1+). */
  fill: number;
  /** Most of this product the bag holds, leaving the headspace, in the input unit. */
  holds: number;
};

export type MylarValue = {
  weight: number;
  unit: MassUnit;
  productName: string;
  densityKgM3: number;
  headspacePct: number;
  productL: number;
  requiredL: number;
  /** Smallest bag that fits; when none does, the largest bag and how many of them. */
  recommended: BagId;
  bagsNeeded: number;
  bags: BagRow[];
};

export type MylarRules = { bags: MylarFile; density: DensityFile };
export const DEFAULT_MYLAR_RULES: MylarRules = { bags: mylarRules, density: densityRules };

const n = (x: number, dp = 2) => roundDisplay(x, dp);
const QT_PER_L = 1 / 0.946352946;
const CUPS_PER_L = 4 * QT_PER_L;

export function findMylarBag(
  input: MylarInput,
  rules: MylarRules = DEFAULT_MYLAR_RULES,
): ToolResult<MylarValue> {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const cites: RuleCitation[] = [];
  const preset = input.product === "custom" ? null : rules.density.entries[input.product];
  const density = preset ? preset.kgM3 : input.density!;
  const productName = preset ? preset.name : "Your product";
  if (preset) cites.push(cite(`bulk-density.${preset.id}`, preset));
  const hs = input.headspace ?? rules.bags.defaultHeadspacePct;
  const grams = input.weight * G_PER[input.unit];

  // 1. Product volume from weight and bulk density (kg/m³ = g/L).
  const productL = grams / density;
  explain.push({
    text: `${productName}: ${n(input.weight)} ${input.unit} = ${n(grams, 1)} g ÷ ${n(density, 0)} g/L bulk density = ${n(productL, 3)} L (${n(productL * CUPS_PER_L, 1)} cups)`,
    formula: "volume = weight ÷ bulk density",
    ruleRef: preset ? `bulk-density.${preset.id}` : undefined,
  });

  // 2. Headspace for sealing and settling.
  const requiredL = productL * (1 + hs / 100);
  explain.push({
    text: `Add ${n(hs, 0)} % headspace for sealing: ${n(productL, 3)} × ${n(1 + hs / 100, 2)} = ${n(requiredL, 3)} L needed`,
  });

  // 3. Compare with each bag's nominal capacity.
  const L_PER_QT = rules.bags.litersPerQuart;
  const rows: BagRow[] = BAG_IDS.map((id) => {
    const b = rules.bags.bags[id];
    cites.push(cite(`mylar-presets.${id}`, b));
    const capacityL = b.capacityQt * L_PER_QT;
    return {
      id,
      name: b.name,
      widthIn: b.widthIn,
      heightIn: b.heightIn,
      gussetIn: b.gussetIn,
      capacityL,
      fits: capacityL + 1e-9 >= requiredL,
      fill: productL / capacityL,
      holds: ((capacityL / (1 + hs / 100)) * density) / G_PER[input.unit],
    };
  });
  const fitting = rows.filter((r) => r.fits);
  let recommended: BagRow;
  let bagsNeeded = 1;
  if (fitting.length) {
    const smallest = Math.min(...fitting.map((r) => r.capacityL));
    recommended = fitting.find((r) => r.capacityL === smallest)!;
    explain.push({
      text: `Smallest bag that holds ${n(requiredL, 3)} L: ${recommended.name} (${n(recommended.capacityL, 3)} L nominal), filled to ${n(recommended.fill * 100, 0)} %`,
    });
  } else {
    recommended = rows.reduce((a, b) => (b.capacityL > a.capacityL ? b : a));
    bagsNeeded = Math.ceil(requiredL / recommended.capacityL - 1e-9);
    flags.push(
      flag(
        "warn",
        "SPLIT_INTO_BAGS",
        `${n(input.weight)} ${input.unit} is more than one ${recommended.name} holds; split it into ${bagsNeeded} bags.`,
      ),
    );
    explain.push({
      text: `No single bag holds ${n(requiredL, 3)} L: ${n(requiredL, 3)} ÷ ${n(recommended.capacityL, 3)} L = ${bagsNeeded} × ${recommended.name}`,
    });
  }

  flags.push(
    flag(
      "info",
      "NOMINAL_CAPACITY",
      "Bags are compared by their sold capacity (quart, gallon). Dimensions and usable volume differ a little between makers.",
    ),
  );
  if (!preset)
    flags.push(
      flag(
        "info",
        "CUSTOM_DENSITY",
        "Weigh a level litre (or quart) of your product to find its bulk density.",
      ),
    );

  return okResult(
    {
      weight: input.weight,
      unit: input.unit,
      productName,
      densityKgM3: density,
      headspacePct: hs,
      productL,
      requiredL,
      recommended: recommended.id,
      bagsNeeded,
      bags: rows,
    },
    explain,
    flags,
    cites,
  );
}
