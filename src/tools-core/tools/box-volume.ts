// Tool 6: Box Volume & CBM Calculator. Spec: specs/box-volume-calculator.md.
// Pure: no React, DOM, network or clock. Container sizes come from containers.json.

import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { floorTo, roundDisplay } from "../lib/round";
import { orientations, type Dims3 } from "../lib/geometry";
import { CM_PER_IN, IN3_PER_FT3, KG_PER_LB, M3_PER_FT3, M3_PER_IN3 } from "../lib/units";
import { containerRules, type ContainerId, type ContainersFile } from "../schemas/containers";
import { bvWeightUnit, type BoxVolumeInput, type BvUnit } from "../schemas/box-volume";

export type Volumes = { in3: number; ft3: number; liters: number; m3: number };

export type ContainerFit = {
  id: ContainerId;
  name: string;
  insideMm: Dims3;
  /** Whole cartons that fit by space (uniform stacking). */
  spaceCount: number;
  /** Cartons allowed by payload; null when no weight was entered. */
  weightCap: number | null;
  /** min(space, weight). */
  fit: number;
  /** Cartons along the container's length, width, height. */
  grid: Dims3 | null;
  /** Carton sides along the container's length, width, height, in the input unit. */
  orientation: Dims3 | null;
  limit: "space" | "weight" | "none";
  /** Containers needed for the quantity; null when nothing fits. */
  needed: number | null;
  /** Cartons in the last container. */
  lastHolds: number | null;
  /** Share of the inside volume the cartons fill (0-1). */
  utilisation: number;
  /** Container capacity ÷ carton volume: the shortcut that overcounts. */
  nominalCount: number;
  /** Load weight of one full container in kg; null without a weight. */
  loadKg: number | null;
  /** The container's maximum cargo weight (kg). */
  payloadKg: number;
  /** Share of the payload a full container uses (0-1); null without a weight. */
  payloadUsed: number | null;
  reason: "NO_CONTAINER_FIT" | "NO_DOOR_FIT" | null;
};

export type BoxVolumeValue = {
  unit: BvUnit;
  dims: Dims3;
  qty: number;
  upright: boolean;
  weightUnit: "lb" | "kg";
  perCarton: Volumes;
  total: Volumes;
  /** Total weight in the weight unit; null without a weight. */
  totalWeight: number | null;
  /** Total weight in kg; null without a weight. */
  totalWeightKg: number | null;
  containers: ContainerFit[];
};

export type BoxVolumeRules = ContainersFile;
export const DEFAULT_BV_RULES: BoxVolumeRules = containerRules;

const MM_PER: Record<BvUnit, number> = { in: CM_PER_IN * 10, cm: 10, mm: 1 };
const n = (x: number, dp = 2) => roundDisplay(x, dp);
const dimsText = (d: readonly number[], u: string, dp = 2) =>
  `${d.map((x) => n(x, dp)).join(" × ")} ${u}`;

/** Every volume unit from one volume in m³. */
export function volumesFromM3(m3: number): Volumes {
  return { in3: m3 / M3_PER_IN3, ft3: m3 / M3_PER_FT3, liters: m3 * 1000, m3 };
}

/** Carton volume in m³ from sides in the input unit. */
export function cartonM3(dims: Dims3, unit: BvUnit): number {
  const k = MM_PER[unit];
  return (dims[0] * k * (dims[1] * k) * (dims[2] * k)) / 1e9;
}

/** The carton orientations allowed: all 6, or only those keeping the entered height vertical. */
function allowedOrientations(d: Dims3, upright: boolean): Dims3[] {
  const all = orientations(d[0], d[1], d[2]);
  return upright ? all.filter((o) => o[2] === d[2]) : all;
}

function fitContainer(
  input: BoxVolumeInput,
  cartonVolM3: number,
  weightKg: number | null,
  c: ContainersFile["containers"][ContainerId],
  roadInfoKg: number,
  explain: ExplainStep[],
  flags: Flag[],
): ContainerFit {
  const inside = c.insideMm as Dims3;
  const [doorW, doorH] = c.doorMm;
  const insideM3 = (inside[0] * inside[1] * inside[2]) / 1e9;
  const nominalCount = c.capacityM3 / cartonVolM3;
  const k = MM_PER[input.unit];

  // Orientations are built from the entered sides, so the reported orientation is exact.
  let best: { count: number; grid: Dims3; o: Dims3 } | null = null;
  let fitsInsideAny = false;
  for (const ou of allowedOrientations([input.l, input.w, input.h], input.upright)) {
    const o = ou.map((x) => x * k) as Dims3;
    const grid: Dims3 = [
      floorTo(inside[0] / o[0]),
      floorTo(inside[1] / o[1]),
      floorTo(inside[2] / o[2]),
    ];
    const count = grid[0] * grid[1] * grid[2];
    if (count === 0) continue;
    fitsInsideAny = true;
    // Loaded through the end door: the carton's width and height must clear the opening.
    if (o[1] > doorW + 1e-9 || o[2] > doorH + 1e-9) continue;
    if (!best || count > best.count) best = { count, grid, o: ou };
  }

  const P = c.name;
  if (!best) {
    const reason = fitsInsideAny ? "NO_DOOR_FIT" : "NO_CONTAINER_FIT";
    flags.push(
      flag(
        "warn",
        reason,
        reason === "NO_DOOR_FIT"
          ? `${P}: the carton fits inside but cannot pass the ${dimsText([doorW, doorH], "mm", 0)} door${input.upright ? " standing upright" : ""}.`
          : `${P}: the carton is larger than the inside (${dimsText(inside, "mm", 0)})${input.upright ? " when kept upright" : ""}.`,
      ),
    );
    explain.push({
      text: `${P}: no carton fits (${reason === "NO_DOOR_FIT" ? "door" : "inside size"})`,
    });
    return {
      id: c.id,
      name: P,
      insideMm: inside,
      spaceCount: 0,
      weightCap: null,
      fit: 0,
      grid: null,
      orientation: null,
      limit: "none",
      needed: null,
      lastHolds: null,
      utilisation: 0,
      nominalCount,
      loadKg: null,
      payloadKg: c.payloadKg,
      payloadUsed: null,
      reason,
    };
  }

  const o = best.o;
  explain.push({
    text: `${P}: inside ${dimsText(inside, "mm", 0)}. Best stacking puts the carton as ${dimsText(o, input.unit)} (length × width × height): ${best.grid.join(" × ")} = ${n(best.count, 0)} cartons`,
    formula: "⌊L ÷ l⌋ × ⌊W ÷ w⌋ × ⌊H ÷ h⌋",
    ruleRef: `containers.${c.id}.insideMm`,
  });

  let weightCap: number | null = null;
  let fit = best.count;
  let limit: ContainerFit["limit"] = "space";
  if (weightKg !== null && weightKg > 0) {
    weightCap = floorTo(c.payloadKg / weightKg);
    explain.push({
      text: `${P}: payload ${n(c.payloadKg, 0)} kg ÷ ${n(weightKg, 3)} kg per carton = ${n(weightCap, 0)} cartons`,
      ruleRef: `containers.${c.id}.payloadKg`,
    });
    explain.push({
      text:
        weightCap < best.count
          ? `${P}: space allows ${n(best.count, 0)} but weight allows only ${n(weightCap, 0)}, so weight sets the count: ${n(weightCap, 0)} cartons`
          : `${P}: weight allows ${n(weightCap, 0)} and space allows ${n(best.count, 0)}, so space sets the count. A full container carries ${n(best.count * weightKg, 0)} kg of its ${n(c.payloadKg, 0)} kg payload (${n((best.count * weightKg * 100) / c.payloadKg, 1)} %)`,
    });
    if (weightCap < best.count) {
      fit = weightCap;
      limit = "weight";
      flags.push(
        flag(
          "warn",
          "WEIGHT_LIMITED",
          `${P}: weight, not space, sets the count: ${n(fit, 0)} cartons reach the ${n(c.payloadKg, 0)} kg payload (space allows ${n(best.count, 0)}).`,
        ),
      );
    }
  }

  const loadKg = weightKg !== null && weightKg > 0 ? fit * weightKg : null;
  if (loadKg !== null && loadKg > roadInfoKg) {
    flags.push(
      flag(
        "info",
        "ROAD_WEIGHT",
        `${P}: a full load is ${n(loadKg, 0)} kg of cargo. Road weight limits in many countries are lower than the container maximum. Check with your forwarder.`,
      ),
    );
  }

  const utilisation = fit === 0 ? 0 : (fit * cartonVolM3) / insideM3;
  let needed: number | null = null;
  let lastHolds: number | null = null;
  if (fit > 0) {
    needed = Math.ceil(input.qty / fit);
    lastHolds = input.qty - (needed - 1) * fit;
    explain.push({
      text: `${P}: ${n(input.qty, 0)} cartons ÷ ${n(fit, 0)} per container = ${n(needed, 0)} container${needed === 1 ? "" : "s"}${needed > 1 || lastHolds < fit ? `, the last holding ${n(lastHolds, 0)}` : ""}. Fill ${n(utilisation * 100, 1)} % of the inside volume`,
    });
  }
  explain.push({
    text: `${P}: by volume alone, ${n(c.capacityM3, 1)} m³ ÷ ${n(cartonVolM3, 4)} m³ = ${n(nominalCount, 0)} cartons. Whole cartons cannot fill every gap, so the real count is lower`,
    ruleRef: `containers.${c.id}.capacityM3`,
  });

  return {
    id: c.id,
    name: P,
    insideMm: inside,
    spaceCount: best.count,
    weightCap,
    fit,
    grid: best.grid,
    orientation: o,
    limit,
    needed,
    lastHolds,
    utilisation,
    nominalCount,
    loadKg,
    payloadKg: c.payloadKg,
    payloadUsed: loadKg === null ? null : loadKg / c.payloadKg,
    reason: null,
  };
}

export function calcBoxVolume(
  input: BoxVolumeInput,
  rules: BoxVolumeRules = DEFAULT_BV_RULES,
): ToolResult<BoxVolumeValue> {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const citations: RuleCitation[] = [];
  const u = input.unit;
  const dims: Dims3 = [input.l, input.w, input.h];
  const wu = bvWeightUnit(u);

  // 1-2. Volume per carton, from the input unit, with exact constants.
  const m3 = cartonM3(dims, u);
  const perCarton = volumesFromM3(m3);
  if (u === "in") {
    const in3 = input.l * input.w * input.h;
    perCarton.in3 = in3;
    perCarton.ft3 = in3 / IN3_PER_FT3;
    explain.push({
      text: `Volume: ${dimsText(dims, "in")} = ${n(in3)} in³; ÷ 1,728 = ${n(perCarton.ft3, 3)} ft³; × 0.016387 = ${n(perCarton.liters)} L = ${n(m3, 4)} m³`,
      formula: "L × W × H",
    });
  } else {
    const raw = input.l * input.w * input.h;
    explain.push({
      text: `Volume: ${dimsText(dims, u)} = ${n(raw, u === "mm" ? 0 : 2)} ${u}³ = ${n(m3, 4)} m³ (${n(perCarton.liters)} L); = ${n(perCarton.ft3, 3)} ft³ = ${n(perCarton.in3)} in³`,
      formula: u === "cm" ? "L × W × H ÷ 1,000,000" : "L × W × H ÷ 1,000,000,000",
    });
  }

  // 3. Totals.
  const total = volumesFromM3(m3 * input.qty);
  if (u === "in") {
    total.in3 = perCarton.in3 * input.qty;
    total.ft3 = perCarton.ft3 * input.qty;
  }
  const hasWeight = input.weight !== undefined && input.weight > 0;
  const totalWeight = hasWeight ? input.weight! * input.qty : null;
  if (input.qty > 1) {
    explain.push({
      text: `Total for ${n(input.qty, 0)} cartons: ${n(total.ft3, 3)} ft³ = ${n(total.m3, 4)} m³`,
    });
  }
  const totalWeightKg =
    totalWeight === null ? null : wu === "lb" ? totalWeight * KG_PER_LB : totalWeight;
  if (totalWeight !== null && totalWeightKg !== null) {
    explain.push({
      text: `Weight: ${n(input.qty, 0)} × ${n(input.weight!)} ${wu} = ${n(totalWeight)} ${wu}${wu === "lb" ? ` = ${n(totalWeightKg)} kg` : ` = ${n(totalWeightKg / KG_PER_LB)} lb`}`,
    });
  }

  // 4-8. Container fit.
  const weightKg = hasWeight ? (wu === "lb" ? input.weight! * KG_PER_LB : input.weight!) : null;
  if (input.upright) {
    explain.push({ text: `This side up: the ${n(input.h)} ${u} side stays vertical` });
  }
  const containers = input.containers.map((id) => {
    const c = rules.containers[id];
    citations.push(cite(`containers.${id}`, c));
    return fitContainer(input, m3, weightKg, c, rules.settings.roadWeightInfoKg, explain, flags);
  });

  flags.push(
    flag(
      "info",
      "UNIFORM_STACK",
      "Counts assume every carton is stacked the same way. A load plan that mixes orientations can sometimes fit more.",
    ),
    flag(
      "info",
      "CONTAINER_VARIES",
      "Container sizes are Evergreen Line's published figures; individual containers vary slightly by builder.",
    ),
  );

  return okResult(
    {
      unit: u,
      dims,
      qty: input.qty,
      upright: input.upright,
      weightUnit: wu,
      perCarton,
      total,
      totalWeight,
      totalWeightKg,
      containers,
    },
    explain,
    flags,
    citations,
  );
}
