// Tool 2: Standard Box Sizes & Box Finder. Spec: specs/standard-box-sizes.md.
// Pure function. Box sizes, clearance presets, calipers and the exact-fit step
// come from rules files; billable weight comes from the tool 1 engine.

import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { ceilTo, roundDisplay } from "../lib/round";
import { fitsInside, volume, type Dims3 } from "../lib/geometry";
import { CM_PER_IN, toLb } from "../lib/units";
import {
  boxRules,
  fluteRules,
  type Box,
  type BoxSizesFile,
  type FlutesFile,
} from "../schemas/boxes";
import { CARRIER_IDS, type CarrierId } from "../schemas/carriers";
import type { BoxFinderInput } from "../schemas/box-finder";
import { calcDim, DEFAULT_DIM_RULES, type DimRules } from "./dim-weight";

export type CarrierWeight = {
  name: string;
  /** null when DIM does not apply (USPS 1 cu ft or less). */
  dimWeight: number | null;
  /** Only when a product weight was entered. */
  billable: number | null;
  unit: "lb" | "kg";
};

export type BoxCandidate = {
  id: string;
  family: Box["family"] | "exact-fit";
  label: string;
  insideIn: Dims3;
  outsideIn: Dims3;
  outsideSource: "published" | "computed";
  /** Share of the box's inside volume the product does not fill, 0–1. */
  waste: number;
  carriers: Partial<Record<CarrierId, CarrierWeight>>;
  /** UPS billable (or DIM when no weight) used for ranking ties and savings. */
  upsWeight: number | null;
  source: string;
  sourceUrl: string;
  plProductUrl?: string;
};

export type BoxFinderValue = {
  unit: "in" | "cm";
  productIn: Dims3;
  requiredIn: Dims3;
  clearanceIn: number;
  board: { id: string; name: string; caliperIn: number };
  matches: BoxCandidate[];
  totalFits: number;
  exactFit: BoxCandidate;
  /** UPS weight saved by the exact-fit box vs the best stock box (lb), when positive. */
  exactFitSavingLb: number | null;
};

export type BoxFinderRules = { boxes: BoxSizesFile; flutes: FlutesFile; dim: DimRules };
export const DEFAULT_BOX_RULES: BoxFinderRules = {
  boxes: boxRules,
  flutes: fluteRules,
  dim: DEFAULT_DIM_RULES,
};

const n = (x: number, dp = 3) => roundDisplay(x, dp);
const dims = (d: readonly number[], u = "in", dp = 3) =>
  `${d.map((x) => n(x, dp)).join(" x ")} ${u}`;

function outsideFor(
  inside: Dims3,
  style: "mailer" | "rsc",
  caliper: number,
  layers: BoxSizesFile["settings"]["caliperLayers"],
): Dims3 {
  const side = layers.sides * caliper;
  const height = (style === "rsc" ? layers.rscHeight : layers.sides) * caliper;
  return [inside[0] + side, inside[1] + side, inside[2] + height];
}

function weights(outsideIn: Dims3, weightLb: number | undefined, rules: DimRules) {
  const r = calcDim(
    {
      l: outsideIn[0],
      w: outsideIn[1],
      h: outsideIn[2],
      unit: "in",
      weight: weightLb ?? 0,
      carriers: [...CARRIER_IDS],
      packaging: "box",
    },
    rules,
    { rightSize: false },
  );
  const carriers: BoxCandidate["carriers"] = {};
  for (const id of CARRIER_IDS) {
    const c = r.value.carriers[id];
    if (!c) continue;
    carriers[id] = {
      name: c.name,
      dimWeight: c.dimWeight,
      billable: weightLb === undefined ? null : c.billable,
      unit: c.weightUnit,
    };
  }
  const ups = carriers.ups;
  const upsWeight = ups ? (weightLb === undefined ? ups.dimWeight : ups.billable) : null;
  return { carriers, upsWeight, explain: r.explain };
}

export function findBoxes(
  input: BoxFinderInput,
  rules: BoxFinderRules = DEFAULT_BOX_RULES,
): ToolResult<BoxFinderValue> {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const settings = rules.boxes.settings;
  const toIn = (x: number) => (input.unit === "in" ? x : x / CM_PER_IN);

  // 1. Required inside size = product + 2 x (clearance + insert) on every axis.
  const productIn: Dims3 = [toIn(input.l), toIn(input.w), toIn(input.h)];
  const clearanceIn =
    input.clearance === undefined ? settings.clearancePresetsIn.standard : toIn(input.clearance);
  const pad = 2 * (clearanceIn + toIn(input.insert));
  const requiredIn = productIn.map((x) => x + pad) as Dims3;
  explain.push({
    text: `Required inside size = product + 2 x (${n(clearanceIn)} in clearance${input.insert ? ` + ${n(toIn(input.insert))} in insert` : ""}): ${dims(productIn)} → ${dims(requiredIn)}`,
    formula: "product + 2 x (clearance + insert)",
    ruleRef:
      input.clearance === undefined ? "box-sizes.settings.clearancePresetsIn.standard" : undefined,
  });

  const flute = rules.flutes.flutes[input.board];
  const caliper = flute.caliperIn;
  const productVol = volume(productIn);
  const weightLb =
    input.weight === undefined ? undefined : toLb(input.weight, input.unit === "in" ? "lb" : "kg");
  if (weightLb === undefined) {
    flags.push(
      flag(
        "info",
        "WEIGHT_MISSING",
        "Enter the packed weight to see billable weight; the table shows dimensional weight.",
      ),
    );
  }

  // 2-3. Fit test and waste for every box in the chosen family.
  const mode = input.orientation === "upright" ? "upright" : "free";
  const pool = Object.values(rules.boxes.boxes).filter(
    (b) => input.family === "all" || b.family === input.family,
  );
  const fitting = pool
    .filter((b) => fitsInside(requiredIn, b.insideIn, mode))
    .map((b) => ({ box: b, waste: 1 - productVol / volume(b.insideIn) }));
  explain.push({
    text: `${fitting.length} of ${pool.length} boxes fit the required size${mode === "upright" ? " with the product kept upright (its height must fit the box height)" : " in any orientation"}`,
  });

  // 4-5. Outside size and weight per carrier; 6. rank by waste, then UPS weight.
  const candidates: BoxCandidate[] = fitting.map(({ box, waste }) => {
    const published = !!box.outsideIn;
    const outsideIn =
      box.outsideIn ??
      outsideFor(
        box.insideIn,
        box.family === "rsc" ? "rsc" : "mailer",
        caliper,
        settings.caliperLayers,
      );
    const w = weights(outsideIn, weightLb, rules.dim);
    return {
      id: box.id,
      family: box.family,
      label: box.label,
      insideIn: box.insideIn,
      outsideIn,
      outsideSource: published ? "published" : "computed",
      waste,
      carriers: w.carriers,
      upsWeight: w.upsWeight,
      source: box.source,
      sourceUrl: box.sourceUrl,
      plProductUrl: box.plProductUrl,
    };
  });
  candidates.sort(
    (a, b) => a.waste - b.waste || (a.upsWeight ?? Infinity) - (b.upsWeight ?? Infinity),
  );
  const matches = candidates.slice(0, settings.topResults);

  if (matches.length === 0) {
    flags.push(
      flag(
        "warn",
        "NO_STOCK_FIT",
        "No stock box in this list fits. The exact-fit box below is made to your size.",
      ),
    );
  } else {
    const best = matches[0]!;
    explain.push({
      text: `Best stock fit: ${best.label}, inside ${dims(best.insideIn)}, ${n(best.waste * 100, 1)}% empty space`,
      formula: "1 - product volume / box inside volume",
    });
    explain.push({
      text:
        best.outsideSource === "published"
          ? `Outside size as published: ${dims(best.outsideIn)}`
          : `Outside size = inside + ${flute.name} walls (${n(caliper, 4)} in each): ${dims(best.outsideIn)}`,
      ruleRef:
        best.outsideSource === "published"
          ? `box-sizes.${best.id}`
          : `flutes.${flute.id}.caliperIn`,
    });
  }
  if (matches.some((m) => m.family === "usps-flat-rate")) {
    flags.push(
      flag(
        "info",
        "FLAT_RATE_NOTE",
        "USPS Flat Rate boxes are priced by box, not weight or zone, up to 70 lb.",
      ),
    );
  }
  if (!flute.verifiedOn) {
    flags.push(
      flag(
        "info",
        "CALIPER_NOMINAL",
        `${flute.name} wall thickness is a nominal ${n(caliper, 4)} in; your supplier's figure may differ.`,
      ),
    );
  }

  // 7. Exact-fit box: required size rounded up to the exact-fit step.
  const step = settings.exactFitStepIn;
  const exactInside = requiredIn.map((x) => ceilTo(x, step)) as Dims3;
  const exactOutside = outsideFor(exactInside, "mailer", caliper, settings.caliperLayers);
  const ew = weights(exactOutside, weightLb, rules.dim);
  const exactFit: BoxCandidate = {
    id: "exact-fit",
    family: "exact-fit",
    label: "Box made to your exact size",
    insideIn: exactInside,
    outsideIn: exactOutside,
    outsideSource: "computed",
    waste: 1 - productVol / volume(exactInside),
    carriers: ew.carriers,
    upsWeight: ew.upsWeight,
    source: "Calculated from your product size",
    sourceUrl: "",
  };
  explain.push({
    text: `Exact-fit box: inside ${dims(requiredIn)} rounded up to ${n(step)} in = ${dims(exactInside)}; outside ${dims(exactOutside)}`,
    ruleRef: "box-sizes.settings.exactFitStepIn",
  });

  const bestUps = matches[0]?.upsWeight ?? null;
  const exactFitSavingLb =
    bestUps !== null && ew.upsWeight !== null && bestUps - ew.upsWeight > 1e-9
      ? bestUps - ew.upsWeight
      : null;
  if (bestUps !== null && ew.upsWeight !== null) {
    explain.push({
      text: `UPS ${weightLb === undefined ? "DIM" : "billable"} weight: best stock box ${n(bestUps)} lb, exact-fit box ${n(ew.upsWeight)} lb${exactFitSavingLb ? ` (saves ${n(exactFitSavingLb)} lb per parcel)` : ""}`,
      ruleRef: "ups.dimDivisorIn",
    });
  }

  // Citations: box sources actually used, the flute, and the carriers.
  const citations: RuleCitation[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    const box = rules.boxes.boxes[m.id];
    if (box && !seen.has(box.source)) {
      seen.add(box.source);
      citations.push(cite(`box-sizes.${box.family}`, box));
    }
  }
  citations.push(cite(`flutes.${flute.id}`, flute));
  for (const id of CARRIER_IDS) citations.push(cite(id, rules.dim.carriers.carriers[id]));

  return okResult(
    {
      unit: input.unit,
      productIn,
      requiredIn,
      clearanceIn,
      board: { id: flute.id, name: flute.name, caliperIn: caliper },
      matches,
      totalFits: candidates.length,
      exactFit,
      exactFitSavingLb,
    },
    explain,
    flags,
    citations,
  );
}
