// Tool 1: Dimensional Weight & Shipping Surcharge Calculator.
// Spec: specs/dimensional-weight-calculator.md. Pure: no React, DOM, network or clock.
// Every number comes from rules/carriers.json and rules/usps-cubic.json.

import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { ceilTo, ceilUnit, floorTo, roundDisplay, roundTo } from "../lib/round";
import { lengthPlusGirth, sortDesc, type Dims3 } from "../lib/geometry";
import { CM_PER_IN, IN3_PER_FT3, kgToLb, lbToKg } from "../lib/units";
import {
  carrierRules,
  uspsCubicRules,
  type CarrierId,
  type CarrierRule,
  type CarriersFile,
  type UspsCubicFile,
} from "../schemas/carriers";
import type { DimWeightInput } from "../schemas/dim-weight";

export type Surcharge = { code: string; label: string; reasons: string[] };

export type UspsCubic = {
  eligible: boolean;
  /** Cubic size after the 1/4 in round-down (boxes) or length+width (softpacks). */
  measured: number | null;
  measure: "ft3" | "length-plus-width-in";
  tierFt3: number | null;
  priorityMail: boolean;
  groundAdvantage: boolean;
  reason: string | null;
};

export type CarrierResult = {
  carrier: CarrierId;
  name: string;
  lengthUnit: "in" | "cm";
  weightUnit: "lb" | "kg";
  roundedDims: Dims3;
  volume: number;
  divisor: number;
  divisorSource: "published" | "contract";
  dimApplied: boolean;
  dimWeight: number | null;
  actual: number;
  /** null when the package is outside the carrier's limits (principle 10). */
  billable: number | null;
  /** Billable in lb for cross-carrier comparison. */
  billableLb: number | null;
  lengthPlusGirth: number;
  surcharges: Surcharge[];
  cubic: UspsCubic | null;
  flags: Flag[];
  verified: boolean;
};

export type RightSizeSuggestion = {
  side: "length" | "width" | "height";
  from: number;
  to: number;
  unit: "in" | "cm";
  savings: { carrier: CarrierId; name: string; before: number; after: number; unit: "lb" | "kg" }[];
};

export type DimWeightValue = {
  carriers: Partial<Record<CarrierId, CarrierResult>>;
  order: CarrierId[];
  lowest: {
    carrier: CarrierId;
    name: string;
    billable: number;
    unit: "lb" | "kg";
    billableLb: number;
  } | null;
  rightSize: RightSizeSuggestion[];
};

export type DimRules = { carriers: CarriersFile; cubic: UspsCubicFile };
type Rules = DimRules;
export const DEFAULT_DIM_RULES: Rules = { carriers: carrierRules, cubic: uspsCubicRules };

/** Input normalised to both systems, without round-tripping the user's own unit. */
type Normalised = { in: Dims3; cm: Dims3; lb: number; kg: number };

function normalise(i: Pick<DimWeightInput, "l" | "w" | "h" | "unit" | "weight">): Normalised {
  const raw: Dims3 = [i.l, i.w, i.h];
  if (i.unit === "in") {
    return {
      in: raw,
      cm: raw.map((x) => x * CM_PER_IN) as Dims3,
      lb: i.weight,
      kg: lbToKg(i.weight),
    };
  }
  return {
    in: raw.map((x) => x / CM_PER_IN) as Dims3,
    cm: raw,
    lb: kgToLb(i.weight),
    kg: i.weight,
  };
}

const n = (x: number, dp = 2) => roundDisplay(x, dp);
const dims = (d: readonly number[], u: string, dp = 3) =>
  `${d.map((x) => n(x, dp)).join(" x ")} ${u}`;

/** Poly mailers, envelopes and Mylar bags / pouches are USPS "soft packaging" for cubic pricing. */
const isSoftpack = (p: DimWeightInput["packaging"]) => p === "softpack" || p === "mylar";

function uspsCubic(
  measuredIn: Dims3,
  weightLb: number,
  packaging: DimWeightInput["packaging"],
  rules: UspsCubicFile["cubic"],
  explain: ExplainStep[],
): UspsCubic {
  const none = (reason: string, measured: number | null = null): UspsCubic => ({
    eligible: false,
    measured,
    measure: isSoftpack(packaging) ? "length-plus-width-in" : "ft3",
    tierFt3: null,
    priorityMail: false,
    groundAdvantage: false,
    reason,
  });
  if (rules.excludedPackaging.includes(packaging))
    return none("Rolls and tubes do not qualify for cubic pricing.");
  const maxWeight = Math.max(
    rules.priorityMailCubic.maxWeightLb,
    rules.groundAdvantageCubic.maxWeightLb,
  );
  if (weightLb > maxWeight) return none(`Cubic pricing is limited to ${maxWeight} lb.`);

  const step = rules.measuring.truncateEachSideToIn;
  const sorted = sortDesc(measuredIn).map((x) => floorTo(x, step)) as Dims3;

  if (isSoftpack(packaging)) {
    const lw = sorted[0] + sorted[1];
    explain.push({
      text: `USPS cubic (softpack): length + width rounded down to 1/4 in: ${n(sorted[0])} + ${n(sorted[1])} = ${n(lw)} in`,
      ruleRef: "usps-cubic.softpackTiers",
    });
    const tier = rules.softpackTiers.find((t) => lw <= t.maxLengthPlusWidthIn);
    if (!tier)
      return none(
        `Softpack length + width over ${rules.softpackTiers.at(-1)?.maxLengthPlusWidthIn} in.`,
        lw,
      );
    return {
      eligible: true,
      measured: lw,
      measure: "length-plus-width-in",
      tierFt3: tier.tierFt3,
      priorityMail: tier.tierFt3 <= rules.priorityMailCubic.maxFt3,
      groundAdvantage: tier.tierFt3 <= rules.groundAdvantageCubic.maxFt3,
      reason: null,
    };
  }

  const ft3 = (sorted[0] * sorted[1] * sorted[2]) / IN3_PER_FT3;
  const maxLongest = Math.max(
    rules.priorityMailCubic.maxLongestIn,
    rules.groundAdvantageCubic.maxLongestIn,
  );
  if (sorted[0] > maxLongest) return none(`Longest side over ${maxLongest} in.`, ft3);
  const tier = roundTo(
    Math.max(rules.measuring.tierStepFt3, ceilTo(ft3, rules.measuring.tierStepFt3)),
    2,
  );
  explain.push({
    text: `USPS cubic: sides rounded down to 1/4 in: ${dims(sorted, "in")} = ${n(ft3, 4)} cu ft, tier ${tier}`,
    formula: "L x W x H / 1,728",
    ruleRef: "usps-cubic.measuring",
  });
  const pm = tier <= rules.priorityMailCubic.maxFt3;
  const ga = tier <= rules.groundAdvantageCubic.maxFt3;
  if (!ga) return none(`Over ${rules.groundAdvantageCubic.maxFt3} cu ft.`, ft3);
  return {
    eligible: true,
    measured: ft3,
    measure: "ft3",
    tierFt3: tier,
    priorityMail: pm,
    groundAdvantage: ga,
    reason: null,
  };
}

/** Billable weight for one carrier. */
export function calcCarrier(
  input: DimWeightInput,
  norm: Normalised,
  rule: CarrierRule,
  cubicRules: UspsCubicFile["cubic"],
): { result: CarrierResult; explain: ExplainStep[] } {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const P = rule.name;
  // cm/kg input uses the carrier's published metric divisor (cm³ per kg) when it has one;
  // otherwise (USPS, and all in/lb input) the inch/pound rules apply.
  const metric = input.unit === "cm" && !!rule.dimDivisorCm;
  const lu = metric ? "cm" : "in";
  const wu = metric ? "kg" : "lb";
  const measured = metric ? norm.cm : norm.in;
  const isTube = input.packaging === "tube";
  const usps = rule.id === "usps";
  const roundSides = (d: Dims3) =>
    sortDesc(rule.dimRounding === "ceil-each-side-to-whole-unit" ? d.map(ceilUnit) : d);

  // 1-2. Round each side (rule), sort longest first.
  const rounded = roundSides(measured);
  explain.push({
    text: `${P}: sides rounded up to whole ${lu === "in" ? "inches" : "cm"}: ${dims(sortDesc(measured), lu)} → ${dims(rounded, lu)}`,
    ruleRef: `${rule.id}.dimRounding`,
  });
  // Size surcharges and USPS limits are published in inches, so they always use inch sides.
  const roundedIn = metric ? roundSides(norm.in) : rounded;
  const boxVolumeIn = roundedIn[0] * roundedIn[1] * roundedIn[2];

  // 3. Volume (USPS nonrectangular pieces use the 0.785 factor, DMM 283 1.4.3).
  const boxVolume = rounded[0] * rounded[1] * rounded[2];
  const nr = usps && isTube ? rule.nonrectangular : undefined;
  const volume = nr ? boxVolume * nr.factor : boxVolume;
  explain.push({
    text: nr
      ? `${P}: nonrectangular volume ${dims(rounded, lu)} x ${nr.factor} = ${n(volume)} ${lu}³`
      : `${P}: volume ${dims(rounded, lu)} = ${n(volume, 0)} ${lu}³`,
    ruleRef: nr ? "usps.nonrectangular" : undefined,
  });

  // Divisor: published, or the user's contract divisor where allowed.
  const published = metric
    ? rule.dimDivisorCm
    : nr
      ? nr.groundAdvantage.divisor
      : rule.dimDivisorIn;
  if (!published) throw new Error(`${rule.id}: no divisor for ${lu}`);
  const useContract = input.contractDivisor !== undefined && rule.contractDivisorAllowed && !metric;
  const divisor = useContract ? input.contractDivisor! : published;
  if (useContract) {
    flags.push(
      flag(
        "info",
        "CONTRACT_DIVISOR",
        `${P}: using your contract divisor ${divisor} instead of ${published}.`,
      ),
    );
  }

  // 4. Gate (USPS: only above 1 cu ft).
  const dimApplied = (metric ? boxVolumeIn : volume) > rule.dimAppliesAboveIn3;
  if (!dimApplied) {
    explain.push({
      text: `${P}: ${n(volume, 0)} in³ is not more than ${n(rule.dimAppliesAboveIn3, 0)} in³ (1 cu ft), so dimensional weight does not apply`,
      ruleRef: `${rule.id}.dimAppliesAboveIn3`,
    });
    flags.push(
      flag("info", "USPS_DIM_NOT_APPLIED", `${P}: 1 cu ft or smaller, billed on actual weight.`),
    );
  }

  // 5. DIM weight, rounded up (whole lb, or the carrier's metric step).
  const step = metric ? (rule.metricWeightStepKg ?? 1) : 1;
  let dimWeight: number | null = null;
  if (dimApplied) {
    dimWeight = ceilTo(volume / divisor, step);
    explain.push({
      text: `${P}: DIM weight ${n(volume, 0)} / ${n(divisor, 0)} = ${n(volume / divisor, 2)} → rounded up to ${n(dimWeight)} ${wu}`,
      formula: `L x W x H / ${n(divisor, 0)}`,
      ruleRef: `${rule.id}.${metric ? "dimDivisorCm" : "dimDivisorIn"}`,
    });
  }

  // 6. Actual weight, rounded up; minimum billable.
  const rawWeight = metric ? norm.kg : norm.lb;
  const minBillable = metric ? (rule.minBillableKg ?? 0) : (rule.minBillableLb ?? 0);
  const actual = Math.max(ceilTo(rawWeight, step), minBillable);
  explain.push({
    text: `${P}: actual weight ${n(rawWeight)} ${wu} → ${n(actual)} ${wu}${rawWeight < minBillable ? " (minimum billable)" : ""}`,
    ruleRef: `${rule.id}.weightRounding`,
  });

  // 7. Billable.
  let billable: number | null = Math.max(dimWeight ?? 0, actual);
  explain.push({
    text:
      dimWeight === null
        ? `${P}: billable = actual = ${n(billable)} ${wu}`
        : `${P}: billable = greater of ${n(dimWeight)} and ${n(actual)} = ${n(billable)} ${wu}`,
  });

  // 8. Length + girth: shown in the rule unit, checked in inches.
  const lgShown = lengthPlusGirth(rounded);
  const lg = lengthPlusGirth(roundedIn);
  const surcharges: Surcharge[] = [];
  const lbs = norm.lb;

  // 9-10. UPS / FedEx surcharges (inch rules, applied to any input unit).
  const s = rule.surcharges;
  if (
    s.overMax &&
    (roundedIn[0] > s.overMax.longestGt ||
      lg > s.overMax.lengthGirthGt ||
      lbs > s.overMax.weightGtLb)
  ) {
    flags.push(
      flag(
        "error",
        "OVER_MAX",
        `${P}: over the maximum (longest ${s.overMax.longestGt} in, length + girth ${s.overMax.lengthGirthGt} in, ${s.overMax.weightGtLb} lb). Not accepted as a parcel.`,
      ),
    );
    billable = null;
  } else {
    const lp = s.largePackage;
    let lpApplied = false;
    if (lp) {
      const reasons = [
        roundedIn[0] > lp.longestGt && `longest side ${roundedIn[0]} in > ${lp.longestGt}`,
        lg > lp.lengthGirthGt && `length + girth ${lg} in > ${lp.lengthGirthGt}`,
        boxVolumeIn > lp.volumeGtIn3 && `volume ${n(boxVolumeIn, 0)} in³ > ${n(lp.volumeGtIn3, 0)}`,
        lbs > lp.weightGtLb && `weight ${n(lbs)} lb > ${lp.weightGtLb}`,
      ].filter((r): r is string => !!r);
      if (reasons.length) {
        lpApplied = true;
        surcharges.push({ code: "LARGE_PACKAGE", label: lp.label, reasons });
        flags.push(flag("warn", "LARGE_PACKAGE", `${P}: ${lp.label} (${reasons.join("; ")}).`));
        // The minimum is published in lb; in kg it is converted and rounded up to the kg step.
        const minLp = metric ? ceilTo(lbToKg(lp.minBillableLb), step) : lp.minBillableLb;
        if (billable < minLp) {
          explain.push({
            text: `${P}: ${lp.label} minimum billable ${n(minLp)} ${wu}${metric ? ` (${lp.minBillableLb} lb)` : ""} replaces ${n(billable)} ${wu}`,
            ruleRef: `${rule.id}.surcharges.largePackage.minBillableLb`,
          });
          flags.push(
            flag("warn", "LARGE_PACKAGE_MIN_APPLIED", `${P}: billed at least ${n(minLp)} ${wu}.`),
          );
          billable = minLp;
        }
      }
    }
    const ah = s.additionalHandling;
    if (ah) {
      const reasons = [
        roundedIn[0] > ah.longestGt && `longest side ${roundedIn[0]} in > ${ah.longestGt}`,
        roundedIn[1] > ah.secondGt && `second-longest side ${roundedIn[1]} in > ${ah.secondGt}`,
        lg > ah.lengthGirthGt && `length + girth ${lg} in > ${ah.lengthGirthGt}`,
        lbs > ah.weightGtLb && `weight ${n(lbs)} lb > ${ah.weightGtLb}`,
        boxVolumeIn > ah.volumeGtIn3 && `volume ${n(boxVolumeIn, 0)} in³ > ${n(ah.volumeGtIn3, 0)}`,
      ].filter((r): r is string => !!r);
      if (reasons.length && lpApplied && ah.suppressedByLargePackage) {
        explain.push({ text: `${P}: ${ah.label} is not added on top of ${lp?.label}` });
      } else if (reasons.length) {
        surcharges.push({ code: "ADDITIONAL_HANDLING", label: ah.label, reasons });
        flags.push(
          flag("warn", "ADDITIONAL_HANDLING", `${P}: ${ah.label} (${reasons.join("; ")}).`),
        );
      }
    }
  }

  // DHL Express: published piece limits and the Oversize Piece trigger (cm / kg).
  if (rule.pieceLimits || rule.oversizePiece) {
    const cm = roundSides(norm.cm);
    const pl = rule.pieceLimits;
    if (
      pl &&
      (cm[0] > pl.maxCm[0] || cm[1] > pl.maxCm[1] || cm[2] > pl.maxCm[2] || norm.kg > pl.maxKg)
    ) {
      flags.push(
        flag(
          "error",
          "DHL_OVER_PIECE_LIMIT",
          `${P}: over the ${pl.maxCm.join(" x ")} cm / ${pl.maxKg} kg piece limit (this piece: ${dims(cm, "cm", 0)}, ${n(norm.kg)} kg). Not accepted as a standard express piece.`,
        ),
      );
      billable = null;
    } else if (
      rule.oversizePiece &&
      (cm[0] > rule.oversizePiece.longestGtCm || cm[1] > rule.oversizePiece.secondGtCm)
    ) {
      const op = rule.oversizePiece;
      const reasons = [
        cm[0] > op.longestGtCm && `longest side ${cm[0]} cm > ${op.longestGtCm}`,
        cm[1] > op.secondGtCm && `second-longest side ${cm[1]} cm > ${op.secondGtCm}`,
      ].filter((r): r is string => !!r);
      surcharges.push({ code: "DHL_OVERSIZE_PIECE", label: op.label, reasons });
      flags.push(flag("warn", "DHL_OVERSIZE_PIECE", `${P}: ${op.label} (${reasons.join("; ")}).`));
    }
  }

  // USPS limits and nonstandard fees.
  if (usps && rule.limits) {
    if (lbs > rule.limits.maxWeightLb || lg > rule.limits.maxLengthGirth) {
      flags.push(
        flag(
          "error",
          "USPS_OVER_MAX",
          `${P}: over ${rule.limits.maxWeightLb} lb or ${rule.limits.maxLengthGirth} in length + girth. Not mailable.`,
        ),
      );
      billable = null;
    } else if (lg > rule.limits.oversizedLengthGirthGt) {
      flags.push(
        flag(
          "warn",
          "USPS_OVERSIZED_TIER",
          `${P}: length + girth ${lg} in is over ${rule.limits.oversizedLengthGirthGt} in, so Ground Advantage charges its oversized price.`,
        ),
      );
    }
    const ns = rule.nonstandard;
    if (ns && billable !== null) {
      const over = [...ns.lengthGtIn].sort((a, b) => b - a).find((t) => roundedIn[0] > t);
      if (over !== undefined) {
        flags.push(
          flag(
            "warn",
            `USPS_NONSTANDARD_${over}`,
            `${P}: longest side over ${over} in adds a nonstandard fee.`,
          ),
        );
      }
      if (boxVolumeIn > ns.volumeGtIn3) {
        flags.push(
          flag(
            "warn",
            "USPS_NONSTANDARD_VOLUME",
            `${P}: over 2 cu ft (${n(ns.volumeGtIn3, 0)} in³) adds a nonstandard fee.`,
          ),
        );
      }
    }
    if (nr && billable !== null) {
      // Priority Mail rounds nonrectangular sides to the nearest inch and divides by 166 (DMM 223 1.4.3).
      const pmVol =
        sortDesc(norm.in.map((x) => Math.round(x))).reduce((a, b) => a * b, 1) * nr.factor;
      const pm =
        pmVol > rule.dimAppliesAboveIn3
          ? Math.max(ceilTo(pmVol / nr.priorityMail.divisor), actual)
          : actual;
      flags.push(
        flag(
          "info",
          "USPS_PRIORITY_NONRECT",
          `${P}: figures shown are Ground Advantage. Priority Mail uses a different tube rule: ${pm} lb.`,
        ),
      );
    }
  }

  // 11. USPS cubic.
  const cubic =
    usps && billable !== null
      ? uspsCubic(norm.in, lbs, input.packaging, cubicRules, explain)
      : null;
  if (cubic?.eligible) {
    const which = [
      cubic.priorityMail && "Priority Mail Cubic",
      cubic.groundAdvantage && "Ground Advantage Cubic",
    ]
      .filter(Boolean)
      .join(" and ");
    flags.push(
      flag("info", "USPS_CUBIC_ELIGIBLE", `${P}: qualifies for ${which}, tier ${cubic.tierFt3}.`),
    );
  }

  if (!rule.verifiedOn) {
    flags.push(
      flag(
        "info",
        "RULE_UNVERIFIED",
        `${P}: rules come from secondary sources and have not yet been checked against ${P}'s own pages.`,
      ),
    );
  }

  return {
    result: {
      carrier: rule.id,
      name: rule.name,
      lengthUnit: lu,
      weightUnit: wu,
      roundedDims: rounded,
      volume,
      divisor,
      divisorSource: useContract ? "contract" : "published",
      dimApplied,
      dimWeight,
      actual,
      billable,
      billableLb: billable === null ? null : metric ? kgToLb(billable) : billable,
      lengthPlusGirth: lgShown,
      surcharges,
      cubic,
      flags,
      verified: !!rule.verifiedOn,
    },
    explain,
  };
}

function computeAll(input: DimWeightInput, rules: Rules) {
  const norm = normalise(input);
  const carriers: Partial<Record<CarrierId, CarrierResult>> = {};
  const explain: ExplainStep[] = [];
  for (const id of input.carriers) {
    const r = calcCarrier(input, norm, rules.carriers.carriers[id], rules.cubic.cubic);
    carriers[id] = r.result;
    explain.push(...r.explain);
  }
  return { carriers, explain };
}

function lowestOf(
  carriers: Partial<Record<CarrierId, CarrierResult>>,
  order: CarrierId[],
): DimWeightValue["lowest"] {
  let best: DimWeightValue["lowest"] = null;
  for (const id of order) {
    const c = carriers[id];
    if (!c || c.billable === null || c.billableLb === null) continue;
    if (!best || c.billableLb < best.billableLb - 1e-9) {
      best = {
        carrier: id,
        name: c.name,
        billable: c.billable,
        unit: c.weightUnit,
        billableLb: c.billableLb,
      };
    }
  }
  return best;
}

const SIDES = [
  ["l", "length"],
  ["w", "width"],
  ["h", "height"],
] as const;

/** 12. Right-size: trim each side to the next whole unit below and report savings. */
function rightSize(
  input: DimWeightInput,
  base: Partial<Record<CarrierId, CarrierResult>>,
  rules: Rules,
): RightSizeSuggestion[] {
  const out: RightSizeSuggestion[] = [];
  const clearance = input.clearance ?? 0;
  for (const [key, side] of SIDES) {
    const from = input[key];
    const to = Number.isInteger(roundTo(from, 9)) ? roundTo(from, 9) - 1 : Math.floor(from);
    const floor = Math.max(1, input.product ? input.product[key] + 2 * clearance : 0);
    if (to < floor) continue;
    const { carriers } = computeAll({ ...input, [key]: to }, rules);
    const savings: RightSizeSuggestion["savings"] = [];
    for (const id of input.carriers) {
      const b = base[id];
      const a = carriers[id];
      if (b?.billable != null && a?.billable != null && a.billable < b.billable - 1e-9) {
        savings.push({
          carrier: id,
          name: b.name,
          before: b.billable,
          after: a.billable,
          unit: b.weightUnit,
        });
      }
    }
    if (savings.length) out.push({ side, from, to, unit: input.unit, savings });
  }
  return out;
}

export function calcDim(
  input: DimWeightInput,
  rules: Rules = DEFAULT_DIM_RULES,
  /** Callers that only need billable weight (e.g. the box finder) can skip right-size. */
  opts: { rightSize?: boolean } = {},
): ToolResult<DimWeightValue> {
  const explain: ExplainStep[] = [
    {
      text: `Box ${dims([input.l, input.w, input.h], input.unit)}, ${n(input.weight)} ${input.unit === "in" ? "lb" : "kg"}, packaging: ${input.packaging}`,
    },
  ];
  const { carriers, explain: steps } = computeAll(input, rules);
  explain.push(...steps);
  const order = input.carriers;
  const lowest = lowestOf(carriers, order);
  const flags = order.flatMap((id) => carriers[id]?.flags ?? []);
  const citations: RuleCitation[] = order.map((id) => cite(id, rules.carriers.carriers[id]));
  if (order.includes("usps")) citations.push(cite("usps-cubic", rules.cubic.cubic));

  const value: DimWeightValue = {
    carriers,
    order,
    lowest,
    rightSize: lowest && opts.rightSize !== false ? rightSize(input, carriers, rules) : [],
  };
  const result = okResult(value, explain, flags, citations);
  // Multi-carrier: the result is usable while at least one carrier can quote it.
  result.ok = lowest !== null;
  return result;
}
