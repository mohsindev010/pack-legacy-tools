// Tool 9: Oxygen Absorber Calculator. Spec: specs/oxygen-absorber-calculator.md.
// Pure. Method and container volumes from o2-absorbers.json (Sorbent Systems);
// mylar bag volumes from mylar-presets.json.

import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { roundDisplay } from "../lib/round";
import {
  CC_PER,
  G_PER,
  mylarRules,
  o2Rules,
  type MylarFile,
  type O2File,
  type O2Input,
} from "../schemas/storage";

export type PacketPlan = { sizes: number[]; totalCc: number };

export type O2Value = {
  containerName: string;
  containerCc: number;
  productCc: number;
  airCc: number;
  oxygenCc: number;
  /** Fewest packets per container, then the smallest total. */
  perContainer: PacketPlan;
  count: number;
  totalOxygenCc: number;
  /** Packets for all containers, grouped by size. */
  shoppingList: { sizeCc: number; packets: number }[];
  /** If you only stock one size: packets of each size per container. */
  singleSize: { sizeCc: number; packets: number }[];
};

export type O2Rules = { o2: O2File; bags: MylarFile };
export const DEFAULT_O2_RULES: O2Rules = { o2: o2Rules, bags: mylarRules };

const n = (x: number, dp = 1) => roundDisplay(x, dp);

/** Fewest packets whose total covers `need`, then the smallest total (ties: larger first). */
export function planPackets(need: number, sizesCc: number[]): PacketPlan {
  const sizes = [...sizesCc].sort((a, b) => b - a);
  const max = sizes[0]!;
  if (need <= 0) return { sizes: [], totalCc: 0 };
  // Cover anything above three of the largest with whole large packets first.
  const big = Math.max(0, Math.ceil((need - 3 * max) / max));
  const rest = need - big * max;
  let best: PacketPlan | null = null;
  const consider = (combo: number[]) => {
    const total = combo.reduce((a, b) => a + b, 0);
    if (total + 1e-9 < rest) return;
    if (
      !best ||
      combo.length < best.sizes.length ||
      (combo.length === best.sizes.length && total < best.totalCc)
    )
      best = { sizes: combo, totalCc: total };
  };
  for (let k = 1; k <= 4 && !best; k++) {
    const walk = (start: number, combo: number[]) => {
      if (combo.length === k) return consider(combo);
      for (let i = start; i < sizes.length; i++) walk(i, [...combo, sizes[i]!]);
    };
    walk(0, []);
  }
  const plan = best ?? { sizes: [max], totalCc: max };
  const all = [...Array<number>(big).fill(max), ...plan.sizes];
  return { sizes: all, totalCc: all.reduce((a, b) => a + b, 0) };
}

export function calcOxygen(input: O2Input, rules: O2Rules = DEFAULT_O2_RULES): ToolResult<O2Value> {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const m = rules.o2.method;
  const cites: RuleCitation[] = [cite("o2-absorbers.method", m)];

  // 1. Container volume.
  let containerCc: number;
  let containerName: string;
  if (input.container === "custom") {
    containerCc = input.volume! * CC_PER[input.volumeUnit];
    containerName = `Container of ${n(input.volume!, 2)} ${input.volumeUnit}`;
  } else if (input.container in rules.o2.containers) {
    const c = rules.o2.containers[input.container as keyof O2File["containers"]];
    containerCc = c.volumeCc;
    containerName = c.name;
    cites.push(cite(`o2-absorbers.containers.${c.id}`, c));
  } else {
    const b = rules.bags.bags[input.container as keyof MylarFile["bags"]];
    containerCc = b.capacityQt * rules.bags.litersPerQuart * 1000;
    containerName = `${b.name} mylar bag`;
    cites.push(cite(`mylar-presets.${b.id}`, b));
  }
  explain.push({ text: `${containerName}: ${n(containerCc, 0)} cc` });

  // 2. Product volume: 1 g counted as 1 cc (Sorbent Systems method).
  const grams = input.weight !== undefined ? input.weight * G_PER[input.weightUnit] : 0;
  const productCc = grams / m.productGramsPerCc;
  if (grams > 0)
    explain.push({
      text: `Product: ${n(input.weight!, 2)} ${input.weightUnit} = ${n(grams, 0)} g, counted as ${n(productCc, 0)} cc`,
      formula: "1 g ≈ 1 cc",
      ruleRef: "o2-absorbers.method.productGramsPerCc",
    });
  else
    flags.push(
      flag(
        "info",
        "EMPTY_CONTAINER",
        "No product weight entered, so the whole container is treated as air (most absorber needed).",
      ),
    );

  // 3. Residual air and its oxygen.
  let airCc = containerCc - productCc;
  if (airCc < 0) {
    flags.push(
      flag(
        "error",
        "OVERFULL",
        "The product weighs more in grams than the container's volume in cc, so the 1 g = 1 cc estimate does not apply. Check the weight and container, or measure the headspace.",
      ),
    );
    airCc = 0;
  }
  const oxygenCc = airCc * m.oxygenFraction;
  explain.push({
    text: `Residual air (headspace + voidspace): ${n(containerCc, 0)} − ${n(productCc, 0)} = ${n(airCc, 0)} cc; × ${m.oxygenFraction} oxygen = ${n(oxygenCc, 1)} cc`,
    formula: m.formula,
    ruleRef: "o2-absorbers.method",
  });

  // 4. Packets.
  const sizes = rules.o2.packets.sizesCc;
  const perContainer = planPackets(oxygenCc, sizes);
  if (perContainer.sizes.length)
    explain.push({
      text: `Round up to packets: ${perContainer.sizes.map((s) => `${s} cc`).join(" + ")} = ${n(perContainer.totalCc, 0)} cc ≥ ${n(oxygenCc, 1)} cc`,
      ruleRef: "o2-absorbers.packets",
    });
  const count = input.count;
  const totalOxygenCc = oxygenCc * count;
  const tally = new Map<number, number>();
  for (const s of perContainer.sizes) tally.set(s, (tally.get(s) ?? 0) + count);
  const shoppingList = [...tally].map(([sizeCc, packets]) => ({ sizeCc, packets }));
  if (count > 1)
    explain.push({
      text: `${count} containers: ${shoppingList.map((x) => `${x.packets} × ${x.sizeCc} cc`).join(", ")}`,
    });
  const singleSize = [...sizes]
    .sort((a, b) => a - b)
    .map((s) => ({ sizeCc: s, packets: oxygenCc > 0 ? Math.ceil(oxygenCc / s - 1e-9) : 0 }));

  flags.push(
    flag(
      "info",
      "DRY_FOODS_ONLY",
      "Oxygen absorbers are for dry, low-moisture foods. Seal the container soon after adding them, as they start working in open air.",
    ),
  );
  if (!rules.o2.packets.verifiedOn)
    flags.push(
      flag(
        "info",
        "PACKET_SIZES",
        "Packet sizes are common retail sizes; check what your supplier stocks.",
      ),
    );

  return okResult(
    {
      containerName,
      containerCc,
      productCc,
      airCc,
      oxygenCc,
      perContainer,
      count,
      totalOxygenCc,
      shoppingList,
      singleSize,
    },
    explain,
    flags,
    cites,
  );
}
