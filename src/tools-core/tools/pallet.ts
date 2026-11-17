// Tool 7: Pallet & Container Load Calculator. Spec: specs/pallet-calculator.md.
// Pure. Pallet presets from pallets.json, containers from containers.json.
// Everything is worked in mm and kg, and shown in the input unit.

import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { roundDisplay } from "../lib/round";
import { bestLayer, type Block } from "../lib/packing";
import { KG_PER_LB } from "../lib/units";
import { containerRules, type ContainerId, type ContainersFile } from "../schemas/containers";
import { palletRules, type PalletInput, type PalletsFile } from "../schemas/pallets";

export type PalletLayer = {
  /** Carton sides lying along the pallet length and width, and the vertical side (input unit). */
  footprint: [number, number];
  vertical: number;
  perLayer: number;
  blocks: Block[];
};

export type ContainerLoad = {
  id: ContainerId;
  name: string;
  floor: number;
  levels: number;
  /** Pallets allowed by the container payload; null without carton weight. */
  weightCap: number | null;
  pallets: number;
  cartons: number;
  limit: "space" | "weight" | "none";
  needed: number | null;
  reason: "TOO_TALL_FOR_DOOR" | "TOO_TALL" | "NO_FLOOR_FIT" | null;
  blocks: Block[];
};

export type PalletValue = {
  unit: "in" | "cm";
  weightUnit: "lb" | "kg";
  pallet: {
    id: string;
    name: string;
    length: number;
    width: number;
    height: number;
    weight: number;
    maxLoad: number;
    maxHeight: number;
    overhang: number;
  };
  layer: PalletLayer | null;
  layersBySpace: number;
  spacePerPallet: number;
  /** Cartons allowed by the pallet's safe working load; null without carton weight. */
  weightCap: number | null;
  perPallet: number;
  limit: "space" | "weight" | "none";
  layersUsed: number;
  loadHeight: number;
  /** Pallet + cartons; null without carton weight. */
  grossWeight: number | null;
  /** Share of the pallet footprint covered by cartons (0-1). */
  areaUsed: number;
  palletsNeeded: number | null;
  lastHolds: number | null;
  containers: ContainerLoad[];
};

export type PalletRules = { pallets: PalletsFile; containers: ContainersFile };
export const DEFAULT_PALLET_RULES: PalletRules = {
  pallets: palletRules,
  containers: containerRules,
};

const n = (x: number, dp = 2) => roundDisplay(x, dp);
const fl = (x: number) => Math.floor(x + 1e-9);

export function calcPallet(
  input: PalletInput,
  rules: PalletRules = DEFAULT_PALLET_RULES,
): ToolResult<PalletValue> {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const cites: RuleCitation[] = [];
  const u = input.unit;
  const wu = u === "in" ? "lb" : "kg";
  const mmPer = u === "in" ? 25.4 : 10;
  const kgPer = u === "in" ? KG_PER_LB : 1;
  const toMm = (x: number) => x * mmPer;
  const fromMm = (x: number) => x / mmPer;
  const toKg = (x: number) => x * kgPer;
  const fromKg = (x: number) => x / kgPer;

  // Pallet preset, converted to mm/kg, then any user overrides.
  const p = rules.pallets.pallets[input.pallet];
  cites.push(cite(`pallets.${p.id}`, p));
  const pMm = p.unit === "in" ? 25.4 : 1;
  const pKg = p.unit === "in" ? KG_PER_LB : 1;
  const PL = input.palletL !== undefined ? toMm(input.palletL) : p.footprint[0] * pMm;
  const PW = input.palletW !== undefined ? toMm(input.palletW) : p.footprint[1] * pMm;
  const PH = input.palletH !== undefined ? toMm(input.palletH) : p.height * pMm;
  const PKG = input.palletWeight !== undefined ? toKg(input.palletWeight) : p.weight * pKg;
  const LOAD = input.maxLoad !== undefined ? toKg(input.maxLoad) : p.maxLoad * pKg;
  const MAXH =
    input.maxHeight !== undefined
      ? toMm(input.maxHeight)
      : rules.pallets.defaults.maxLoadHeightIn * 25.4;
  const OH = input.overhang !== undefined ? toMm(input.overhang) : 0;
  // Preset values in the input unit, converted once (48 in stays 48, not 47.999…).
  const presetLen = (x: number) =>
    p.unit === "in" ? (u === "in" ? x : x * 2.54) : u === "cm" ? x / 10 : x / 25.4;
  const presetWt = (x: number) =>
    p.unit === "in" ? (u === "in" ? x : x * KG_PER_LB) : u === "cm" ? x : x / KG_PER_LB;
  if (!p.verifiedOn) {
    flags.push(
      flag(
        "info",
        "PALLET_TYPICAL",
        `${p.name}: height, weight and load rating are typical values. Check your pallet supplier's figures and edit them if they differ.`,
      ),
    );
  }

  const area = [PL + 2 * OH, PW + 2 * OH] as const;
  explain.push({
    text: `Pallet ${p.name}: ${n(fromMm(PL))} × ${n(fromMm(PW))} ${u}${OH > 0 ? `, plus ${n(fromMm(OH))} ${u} overhang per side = ${n(fromMm(area[0]))} × ${n(fromMm(area[1]))} ${u}` : ""}, ${n(fromMm(PH))} ${u} tall. Load height limit ${n(fromMm(MAXH))} ${u} including the pallet, so ${n(fromMm(Math.max(0, MAXH - PH)))} ${u} for cartons`,
    ruleRef: `pallets.${p.id}`,
  });

  // Carton orientations: the vertical side is h when upright, or any side.
  const c = [input.l, input.w, input.h].map(toMm);
  const verticals = input.upright ? [2] : [2, 1, 0];
  const avail = MAXH - PH;
  let best: { layer: PalletLayer; layers: number; total: number; vMm: number } | null = null;
  for (const vi of verticals) {
    const [a, b] = [0, 1, 2].filter((i) => i !== vi).map((i) => c[i]!) as [number, number];
    const lay = bestLayer(area[0], area[1], a, b);
    const layers = avail > 0 ? fl(avail / c[vi]!) : 0;
    const total = lay.count * layers;
    if (!best || total > best.total) {
      const blk = lay.blocks[0];
      best = {
        layer: {
          footprint: blk ? [fromMm(blk.w), fromMm(blk.d)] : [fromMm(a), fromMm(b)],
          vertical: fromMm(c[vi]!),
          perLayer: lay.count,
          blocks: lay.blocks.map((x) => ({
            ...x,
            x: fromMm(x.x),
            y: fromMm(x.y),
            w: fromMm(x.w),
            d: fromMm(x.d),
          })),
        },
        layers,
        total,
        vMm: c[vi]!,
      };
    }
  }

  const layer = best && best.total > 0 ? best.layer : null;
  const spacePerPallet = best?.total ?? 0;
  if (!layer || !best) {
    flags.push(
      flag(
        "error",
        "NO_PALLET_FIT",
        `The carton does not fit on this pallet within the ${n(fromMm(MAXH))} ${u} height limit${input.upright ? " standing upright" : ""}.`,
      ),
    );
  } else {
    explain.push({
      text: `Layer: cartons ${n(layer.footprint[0])} × ${n(layer.footprint[1])} ${u} on the floor, ${n(layer.vertical)} ${u} tall. Best pattern: ${layer.blocks.map((b) => `${b.nx} × ${b.ny}`).join(" + ")} = ${layer.perLayer} per layer`,
      formula: "⌊L ÷ l⌋ × ⌊W ÷ w⌋ (+ a rotated block in the leftover band)",
    });
    explain.push({
      text: `Layers: ${n(fromMm(avail))} ÷ ${n(layer.vertical)} ${u} = ${best.layers}; ${layer.perLayer} × ${best.layers} = ${spacePerPallet} cartons by space`,
    });
  }

  // Weight: the pallet's safe working load is cargo only.
  const cartonKg = input.weight !== undefined && input.weight > 0 ? toKg(input.weight) : null;
  let weightCap: number | null = null;
  let perPallet = spacePerPallet;
  let limit: PalletValue["limit"] = spacePerPallet > 0 ? "space" : "none";
  if (cartonKg !== null && spacePerPallet > 0) {
    weightCap = fl(LOAD / cartonKg);
    explain.push({
      text: `Weight: load limit ${n(fromKg(LOAD))} ${wu} ÷ ${n(input.weight!)} ${wu} = ${weightCap} cartons. ${weightCap < spacePerPallet ? `Weight sets the count: ${weightCap}` : `Space sets the count: ${spacePerPallet}`}`,
      ruleRef: `pallets.${p.id}.maxLoad`,
    });
    if (weightCap < spacePerPallet) {
      perPallet = weightCap;
      limit = "weight";
      flags.push(
        flag(
          "warn",
          "PALLET_WEIGHT_LIMITED",
          `The ${n(fromKg(LOAD))} ${wu} load limit allows ${weightCap} cartons (space allows ${spacePerPallet}).`,
        ),
      );
    }
  }

  const layersUsed = layer && perPallet > 0 ? Math.ceil(perPallet / layer.perLayer) : 0;
  const loadHeightMm = PH + layersUsed * (best?.vMm ?? 0);
  const grossKg = cartonKg !== null ? PKG + perPallet * cartonKg : null;
  const areaUsed =
    layer && layer.perLayer > 0
      ? (layer.perLayer * toMm(layer.footprint[0]) * toMm(layer.footprint[1])) / (PL * PW)
      : 0;
  if (perPallet > 0) {
    explain.push({
      text: `Loaded pallet: ${layersUsed} layer${layersUsed === 1 ? "" : "s"} → ${n(fromMm(loadHeightMm))} ${u} tall${grossKg !== null ? `; ${n(fromKg(PKG))} ${wu} pallet + ${perPallet} × ${n(input.weight!)} ${wu} = ${n(fromKg(grossKg))} ${wu}` : ""}`,
    });
  }
  if (OH > 0) {
    flags.push(
      flag(
        "info",
        "OVERHANG",
        "Overhang lets cartons stick out past the pallet edge; it weakens cartons and some carriers refuse it.",
      ),
    );
  }

  let palletsNeeded: number | null = null;
  let lastHolds: number | null = null;
  if (perPallet > 0) {
    palletsNeeded = Math.ceil(input.qty / perPallet);
    lastHolds = input.qty - (palletsNeeded - 1) * perPallet;
    if (input.qty > 1)
      explain.push({
        text: `${n(input.qty, 0)} cartons ÷ ${perPallet} per pallet = ${palletsNeeded} pallet${palletsNeeded === 1 ? "" : "s"}${palletsNeeded > 1 || lastHolds < perPallet ? `, the last with ${lastHolds}` : ""}`,
      });
  }

  // Pallets in containers (single tier unless stacking is allowed).
  const containers: ContainerLoad[] = [];
  if (perPallet > 0) {
    for (const id of input.containers) {
      const ct = rules.containers.containers[id];
      cites.push(cite(`containers.${id}`, ct));
      const [IL, IW, IH] = ct.insideMm;
      const [, doorH] = ct.doorMm;
      const floorLayer = bestLayer(IL, IW, area[0], area[1]);
      let reason: ContainerLoad["reason"] = null;
      if (loadHeightMm > IH) reason = "TOO_TALL";
      else if (loadHeightMm > doorH) reason = "TOO_TALL_FOR_DOOR";
      else if (floorLayer.count === 0) reason = "NO_FLOOR_FIT";
      const levels = reason ? 0 : input.stack ? fl(IH / loadHeightMm) : 1;
      const space = floorLayer.count * levels;
      const wcap = grossKg !== null ? fl(ct.payloadKg / grossKg) : null;
      const pallets = wcap !== null ? Math.min(space, wcap) : space;
      const lim: ContainerLoad["limit"] =
        pallets === 0 ? "none" : wcap !== null && wcap < space ? "weight" : "space";
      const needed =
        pallets > 0 && palletsNeeded !== null ? Math.ceil(palletsNeeded / pallets) : null;
      if (reason) {
        flags.push(
          flag(
            "warn",
            reason,
            reason === "TOO_TALL_FOR_DOOR"
              ? `${ct.name}: the ${n(fromMm(loadHeightMm))} ${u} loaded pallet is taller than the ${n(fromMm(doorH))} ${u} door opening.`
              : reason === "TOO_TALL"
                ? `${ct.name}: the loaded pallet is taller than the inside height.`
                : `${ct.name}: the pallet does not fit on the floor.`,
          ),
        );
      } else {
        explain.push({
          text: `${ct.name}: floor ${n(fromMm(IL))} × ${n(fromMm(IW))} ${u} takes ${floorLayer.blocks.map((b) => `${b.nx} × ${b.ny}`).join(" + ")} = ${floorLayer.count} pallets${input.stack ? `, ${levels} high` : ""}${wcap !== null ? `; payload ${n(ct.payloadKg, 0)} kg ÷ ${n(grossKg!, 1)} kg = ${wcap}` : ""} → ${pallets} pallets, ${pallets * perPallet} cartons`,
          ruleRef: `containers.${id}`,
        });
      }
      containers.push({
        id,
        name: ct.name,
        floor: floorLayer.count,
        levels,
        weightCap: wcap,
        pallets,
        cartons: pallets * perPallet,
        limit: lim,
        needed,
        reason,
        blocks: floorLayer.blocks.map((x) => ({
          ...x,
          x: fromMm(x.x),
          y: fromMm(x.y),
          w: fromMm(x.w),
          d: fromMm(x.d),
        })),
      });
    }
  }

  flags.push(
    flag(
      "info",
      "PATTERN_NOTE",
      "Layer counts use a uniform grid or a two-block pattern (one block turned 90°). Pallet-pattern software can sometimes fit more with interlocked patterns.",
    ),
  );

  return okResult(
    {
      unit: u,
      weightUnit: wu,
      pallet: {
        id: p.id,
        name: p.name,
        length: input.palletL ?? presetLen(p.footprint[0]),
        width: input.palletW ?? presetLen(p.footprint[1]),
        height: input.palletH ?? presetLen(p.height),
        weight: input.palletWeight ?? presetWt(p.weight),
        maxLoad: input.maxLoad ?? presetWt(p.maxLoad),
        maxHeight: input.maxHeight ?? fromMm(MAXH),
        overhang: input.overhang ?? fromMm(OH),
      },
      layer,
      layersBySpace: best?.layers ?? 0,
      spacePerPallet,
      weightCap,
      perPallet,
      limit,
      layersUsed,
      loadHeight: fromMm(loadHeightMm),
      grossWeight: grossKg === null ? null : fromKg(grossKg),
      areaUsed,
      palletsNeeded,
      lastHolds,
      containers,
    },
    explain,
    flags,
    cites,
  );
}
