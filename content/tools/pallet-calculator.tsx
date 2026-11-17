// Step G content for tool 7. Every number is computed by the engine from
// pallets.json and containers.json (section 13.4).
import Link from "next/link";
import { calcPallet, type PalletValue } from "@core/tools/pallet";
import { PALLET_IDS, palletInputSchema, palletRules } from "@core/schemas/pallets";
import { CONTAINER_IDS, containerRules } from "@core/schemas/containers";
import { bestLayer } from "@core/lib/packing";
import { roundDisplay } from "@core/lib/round";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const run = (raw: Record<string, unknown>) => calcPallet(palletInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as PalletValue;
const n = (x: number, dp = 2) => roundDisplay(x, dp);
const P = palletRules.pallets;
const C = containerRules.containers;
const mm = (p: (typeof P)[keyof typeof P]) => (p.unit === "in" ? 25.4 : 1);

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={run(raw).explain} title={null} />
    </div>
  );
}

const A = val({ l: 12, w: 10, h: 8, unit: "in" });
const Aup = val({ l: 12, w: 10, h: 8, unit: "in", upright: true });
const heavy = val({ l: 12, w: 10, h: 8, unit: "in", weight: 40 });
const two = bestLayer(48, 40, 16, 12).count;
const uni = Math.max(
  Math.floor(48 / 16) * Math.floor(40 / 12),
  Math.floor(48 / 12) * Math.floor(40 / 16),
);
const floor = (id: (typeof PALLET_IDS)[number], c: (typeof CONTAINER_IDS)[number]) => {
  const p = P[id];
  return bestLayer(
    C[c].insideMm[0],
    C[c].insideMm[1],
    p.footprint[0] * mm(p),
    p.footprint[1] * mm(p),
  ).count;
};

const faq = [
  {
    q: "How many boxes fit on a pallet?",
    a: `It depends on the box. A 12 × 10 × 8 in carton fits ${A.perPallet} on a 48 × 40 in pallet stacked to ${n(A.pallet.maxHeight, 0)} in (${A.layer!.perLayer} per layer × ${A.layersUsed} layers), or ${Aup.perPallet} if it must stay upright. Enter your carton above for an exact count.`,
  },
  {
    q: "What size is a standard pallet?",
    a: `In North America the GMA pallet is 48 × 40 in. In Europe the EPAL 1 (EUR) pallet is 1200 × 800 mm, ${P["epal-1"].height} mm tall, about ${P["epal-1"].weight} kg, with a safe working load of ${n(P["epal-1"].maxLoad, 0)} kg. The EPAL 2 and 3 are 1200 × 1000 mm.`,
  },
  {
    q: "How many pallets fit in a 20 ft container?",
    a: `On the floor, single tier: ${floor("gma-48x40", "20ft")} GMA 48 × 40 in pallets or ${floor("epal-1", "20ft")} EUR pallets in a 20 ft container, and ${floor("gma-48x40", "40ft")} GMA or ${floor("epal-1", "40ft")} EUR pallets in a 40 ft container (Evergreen Line inside sizes). Stacking doubles that when the loaded pallets are short and strong enough.`,
  },
  {
    q: "How tall can a pallet be stacked?",
    a: `It depends on the warehouse racking, the truck and the carrier. This calculator uses ${n(palletRules.defaults.maxLoadHeightIn, 0)} in including the pallet unless you enter another limit. For containers, the loaded pallet must also clear the door: ${n(C["20ft"].doorMm[1], 0)} mm on a 20 ft or 40 ft standard, ${n(C["40hc"].doorMm[1], 0)} mm on a 40 ft high cube.`,
  },
  {
    q: "What is a two-block pallet pattern?",
    a: `Instead of turning every carton the same way, part of the layer is turned 90°. For 16 × 12 in cartons on a 48 × 40 in pallet, the best single orientation fits ${uni} per layer; a two-block pattern fits ${two}.`,
  },
  {
    q: "How much weight can a pallet hold?",
    a: `Each pallet has a safe working load for the cargo. EPAL publishes ${n(P["epal-1"].maxLoad, 0)} kg for the EPAL 1 and ${n(P["epal-2"].maxLoad, 0)} kg for the EPAL 2. At 40 lb per carton, a ${n(P["gma-48x40"].maxLoad, 0)} lb limit allows ${heavy.perPallet} cartons on a GMA pallet, fewer than the ${A.perPallet} that fit by space.`,
  },
];

export const palletContent: ToolContent = {
  answer: (
    <>
      Enter a carton size to see how many fit on a GMA, 48 × 48 or EPAL pallet, layer by layer, with
      a top-view diagram, then how many loaded pallets fit in a 20 ft, 40 ft or 40 ft high cube
      container.
    </>
  ),
  ogLine: `12 × 10 × 8 in cartons: ${A.perPallet} per 48 × 40 in pallet`,
  keyTakeaway: (
    <p>
      Cartons per pallet = cartons per layer × layers. Cartons per layer is the best arrangement of
      the carton footprint on the pallet, sometimes with part of the layer turned 90°. Layers = the
      height you can stack ÷ the carton height. Weight can cap it below that: a pallet&apos;s safe
      working load divided by the carton weight. A 12 × 10 × 8 in carton fits {A.perPallet} on a 48
      × 40 in pallet stacked to {n(A.pallet.maxHeight, 0)} in. Pack Legacy can size cartons to fill
      the pallet better.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>Usable area</strong> = pallet length and width plus any overhang on each side.
      </li>
      <li>
        <strong>Each carton side is tried as the height</strong> (only the entered height for
        &ldquo;this side up&rdquo;). For each, the layer count is the best of a uniform grid in
        either direction and two-block patterns where the leftover band holds cartons turned 90°.
      </li>
      <li>
        <strong>Layers</strong> = ⌊(height limit − pallet height) ÷ carton height⌋. The orientation
        with the most cartons wins.
      </li>
      <li>
        <strong>Weight</strong>: if you enter a carton weight, the count is capped at ⌊load limit ÷
        carton weight⌋, and the gross weight adds the pallet.
      </li>
      <li>
        <strong>Containers</strong>: the same pattern search places pallets on the container floor.
        A loaded pallet must fit under the inside height and through the door; stacking adds levels
        when you allow it; the container payload can cap the count.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example
        title="12 × 10 × 8 in cartons on a GMA pallet"
        raw={{ l: 12, w: 10, h: 8, unit: "in", containers: "20ft" }}
      />
      <Example
        title="Same cartons at 40 lb each"
        raw={{ l: 12, w: 10, h: 8, unit: "in", weight: 40, containers: "" }}
      />
      <Example
        title="40 × 30 × 25 cm, this side up, EPAL 1"
        raw={{
          l: 40,
          w: 30,
          h: 25,
          unit: "cm",
          upright: true,
          pallet: "epal-1",
          containers: "20ft",
        }}
      />
    </>
  ),
  referenceTables: (
    <>
      <h3>Pallet sizes</h3>
      <CompareTable
        caption="EPAL values from EPAL data sheets; GMA and 48 × 48 values are typical and editable in the calculator"
        columns={[
          { key: "name", label: "Pallet" },
          { key: "size", label: "Footprint" },
          { key: "h", label: "Height" },
          { key: "wt", label: "Weight" },
          { key: "load", label: "Load limit" },
        ]}
        rows={PALLET_IDS.map((id) => {
          const p = P[id];
          const u = p.unit;
          const wu = u === "in" ? "lb" : "kg";
          return {
            name: p.name,
            size: `${p.footprint.join(" × ")} ${u}`,
            h: `${p.height} ${u}`,
            wt: `${p.weight} ${wu}`,
            load: `${n(p.maxLoad, 0)} ${wu}`,
          };
        })}
      />
      <h3>Pallets per container (single tier, floor only)</h3>
      <CompareTable
        columns={[
          { key: "name", label: "Pallet" },
          ...CONTAINER_IDS.map((c) => ({ key: c, label: C[c].name })),
        ]}
        rows={PALLET_IDS.map((id) => ({
          name: P[id].name,
          ...Object.fromEntries(CONTAINER_IDS.map((c) => [c, String(floor(id, c))])),
        }))}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Only trying one orientation.</strong> Turning part of a layer often adds cartons:{" "}
        {uni} vs {two} for 16 × 12 in cartons on a 48 × 40 in pallet.
      </li>
      <li>
        <strong>Forgetting the pallet height.</strong> A {n(P["gma-48x40"].height, 1)} in pallet
        uses part of the height limit.
      </li>
      <li>
        <strong>Ignoring weight.</strong> Heavy cartons reach the load limit before the pallet is
        full.
      </li>
      <li>
        <strong>Loading too tall for the door.</strong> A 20 ft or 40 ft standard door is{" "}
        {n(C["20ft"].doorMm[1], 0)} mm high, lower than the inside height.
      </li>
      <li>
        <strong>Using inside carton sizes.</strong> Use outside dimensions. For the space a load
        takes, see the <Link href="/tools/box-volume-calculator/">box volume calculator</Link>.
      </li>
    </ul>
  ),
  faq,
};
