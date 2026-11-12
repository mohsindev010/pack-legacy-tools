// Step G content for tool 6. Every number is computed by the engine from
// containers.json or exact unit definitions (section 13.4).
import Link from "next/link";
import { calcBoxVolume, type BoxVolumeValue, type ContainerFit } from "@core/tools/box-volume";
import { boxVolumeInputSchema } from "@core/schemas/box-volume";
import { CONTAINER_IDS, containerRules } from "@core/schemas/containers";
import { roundDisplay } from "@core/lib/round";
import { M3_PER_FT3 } from "@core/lib/units";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const run = (raw: Record<string, unknown>) => calcBoxVolume(boxVolumeInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as BoxVolumeValue;
const fit = (v: BoxVolumeValue, id: string) =>
  v.containers.find((c) => c.id === id) as ContainerFit;
const n = (x: number, dp = 2) => roundDisplay(x, dp);
const C = containerRules.containers;
const ft3 = (m3: number) => m3 / M3_PER_FT3;

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={run(raw).explain} title={null} />
    </div>
  );
}

const A = val({ l: 24, w: 18, h: 12, unit: "in" });
const A20 = fit(A, "20ft");
const A40 = fit(A, "40ft");
const AHC = fit(A, "40hc");
const M = val({ l: 60, w: 40, h: 30, unit: "cm" });
const heavy20 = fit(val({ l: 60, w: 40, h: 30, unit: "cm", weight: 120 }), "20ft");
const B = { l: 16, w: 12, h: 10, unit: "in" };
const bFree = fit(val(B), "40hc");
const bUp = fit(val({ ...B, upright: true }), "40hc");

const COMMON: [number, number, number][] = [
  [12, 12, 12],
  [16, 12, 10],
  [18, 18, 16],
  [20, 20, 20],
  [24, 18, 12],
  [24, 18, 18],
];

const faq = [
  {
    q: "How do I calculate the volume of a box?",
    a: "Multiply length × width × height. With inches you get cubic inches; divide by 1,728 for cubic feet. With centimeters, divide by 1,000,000 for cubic meters (CBM). Measure the outside of the carton, because freight is charged on the space it takes up.",
  },
  {
    q: "What is CBM and how is it calculated?",
    a: `CBM means cubic meters, the volume unit used for sea and air freight. A 60 × 40 × 30 cm carton is 0.6 × 0.4 × 0.3 m = ${n(M.perCarton.m3, 3)} CBM. One CBM is ${n(1 / M3_PER_FT3, 3)} cubic feet.`,
  },
  {
    q: "How many cubic feet are in a 20 ft container?",
    a: `Evergreen Line lists a 20 ft standard container at ${n(C["20ft"].capacityM3, 1)} m³, about ${n(ft3(C["20ft"].capacityM3), 0)} ft³. A 40 ft standard is ${n(C["40ft"].capacityM3, 1)} m³ (${n(ft3(C["40ft"].capacityM3), 0)} ft³) and a 40 ft high cube ${n(C["40hc"].capacityM3, 1)} m³ (${n(ft3(C["40hc"].capacityM3), 0)} ft³). You cannot fill all of it with cartons.`,
  },
  {
    q: "How many boxes fit in a 40 ft container?",
    a: `It depends on the carton. A 24 × 18 × 12 in carton fits ${n(A40.fit, 0)} in a 40 ft standard and ${n(AHC.fit, 0)} in a 40 ft high cube, stacked the same way. Enter your own size above for an exact count by container.`,
  },
  {
    q: "Why does my forwarder's carton count differ from the CBM estimate?",
    a: `Dividing container volume by carton volume assumes the cartons fill every gap. They don't. For 24 × 18 × 12 in cartons, ${n(C["20ft"].capacityM3, 1)} m³ ÷ ${n(A.perCarton.m3, 4)} m³ suggests ${n(Math.floor(A20.nominalCount), 0)} in a 20 ft container, but only ${n(A20.fit, 0)} whole cartons fit. Forwarders may also leave room for bracing or allow for pallets.`,
  },
  {
    q: "Can heavy cartons fill a container?",
    a: `Not always. A 20 ft container can carry ${n(C["20ft"].payloadKg, 0)} kg of cargo. At 120 kg each, ${n(heavy20.fit, 0)} cartons of 60 × 40 × 30 cm reach that limit, though ${n(heavy20.spaceCount, 0)} would fit by space. Road weight limits are often lower still.`,
  },
];

export const boxVolumeContent: ToolContent = {
  answer: (
    <>
      Get the volume of any carton or order in cubic inches, cubic feet, liters and CBM, then see
      how many whole cartons fit in a 20 ft, 40 ft or 40 ft high cube container, by space and by
      weight.
    </>
  ),
  ogLine: `24 × 18 × 12 in = 3 ft³ = ${n(A.perCarton.m3, 4)} CBM; ${n(AHC.fit, 0)} per 40 ft HC`,
  keyTakeaway: (
    <p>
      Box volume is length × width × height. In inches, divide by 1,728 for cubic feet; in
      centimeters, divide by 1,000,000 for cubic meters (CBM). A 24 × 18 × 12 in carton is 3 ft³ or{" "}
      {n(A.perCarton.m3, 4)} CBM. For container loads, count whole cartons instead of dividing
      volumes: that carton fits {n(A20.fit, 0)} in a 20 ft container, not the{" "}
      {n(Math.floor(A20.nominalCount), 0)} the volume shortcut suggests. Pack Legacy can size your
      cartons to load more efficiently.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>Volume</strong> = L × W × H in the unit you enter, converted with exact definitions:
        1 in = 2.54 cm, so 1 ft³ = 1,728 in³ = {n(M3_PER_FT3 * 1000, 4)} L.
      </li>
      <li>
        <strong>Container fit</strong> tries each way the carton can lie (or only the upright ways
        for &ldquo;this side up&rdquo;). For each, it counts whole cartons along the
        container&apos;s inside length, width and height and multiplies. The best of these is the
        answer.
      </li>
      <li>
        <strong>Door check</strong>: cartons go in through the end door, so the carton&apos;s width
        and height must also clear the door opening.
      </li>
      <li>
        <strong>Weight check</strong>: if you enter a weight, the count is capped at the
        container&apos;s maximum payload divided by the carton weight.
      </li>
      <li>
        <strong>Containers needed</strong> = quantity ÷ cartons per container, rounded up.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example
        title="24 × 18 × 12 in cartons, 1,000 of them"
        raw={{ l: 24, w: 18, h: 12, unit: "in", qty: 1000, containers: "20ft,40hc" }}
      />
      <Example
        title="Heavy 60 × 40 × 30 cm cartons at 120 kg"
        raw={{ l: 60, w: 40, h: 30, unit: "cm", weight: 120, containers: "20ft" }}
      />
      <Example
        title="16 × 12 × 10 in, this side up, 40 ft high cube"
        raw={{ ...B, upright: true, containers: "40hc" }}
      />
    </>
  ),
  referenceTables: (
    <>
      <h3>Shipping container dimensions (Evergreen Line)</h3>
      <CompareTable
        caption="Dry containers; individual containers vary slightly by builder"
        columns={[
          { key: "name", label: "Container" },
          { key: "inside", label: "Inside L × W × H (mm)" },
          { key: "door", label: "Door W × H (mm)" },
          { key: "cap", label: "Capacity" },
          { key: "payload", label: "Max payload" },
        ]}
        rows={CONTAINER_IDS.map((id) => {
          const c = C[id];
          return {
            name: c.name,
            inside: c.insideMm.map((x) => n(x, 0)).join(" × "),
            door: c.doorMm.map((x) => n(x, 0)).join(" × "),
            cap: `${n(c.capacityM3, 1)} m³ (${n(ft3(c.capacityM3), 0)} ft³)`,
            payload: `${n(c.payloadKg, 0)} kg`,
          };
        })}
      />
      <h3>Common carton sizes: volume and cartons per container</h3>
      <CompareTable
        caption="Outside dimensions; uniform stacking, best orientation, no weight limit"
        columns={[
          { key: "size", label: "Carton (in)" },
          { key: "ft3", label: "ft³" },
          { key: "m3", label: "CBM" },
          { key: "c20", label: "20 ft" },
          { key: "c40", label: "40 ft" },
          { key: "chc", label: "40 ft HC" },
        ]}
        rows={COMMON.map(([l, w, h]) => {
          const v = val({ l, w, h, unit: "in" });
          return {
            size: `${l} × ${w} × ${h}`,
            ft3: n(v.perCarton.ft3, 3),
            m3: n(v.perCarton.m3, 4),
            c20: n(fit(v, "20ft").fit, 0),
            c40: n(fit(v, "40ft").fit, 0),
            chc: n(fit(v, "40hc").fit, 0),
          };
        })}
      />
      <h3>Volume conversions</h3>
      <CompareTable
        columns={[
          { key: "from", label: "1 unit" },
          { key: "eq", label: "Equals" },
        ]}
        rows={[
          {
            from: "1 ft³",
            eq: `1,728 in³ = ${n(M3_PER_FT3 * 1000, 4)} L = ${n(M3_PER_FT3, 6)} m³`,
          },
          { from: "1 m³ (CBM)", eq: `${n(1 / M3_PER_FT3, 4)} ft³ = 1,000 L = 1,000,000 cm³` },
          { from: "1 L", eq: "61.0237 in³ = 1,000 cm³" },
        ]}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Dividing container volume by carton volume.</strong> It overcounts:{" "}
        {n(Math.floor(A20.nominalCount), 0)} vs {n(A20.fit, 0)} for a 24 × 18 × 12 in carton in a 20
        ft container.
      </li>
      <li>
        <strong>Using inside carton dimensions.</strong> Freight and container space depend on the
        outside size, which is larger by the board thickness.
      </li>
      <li>
        <strong>Forgetting weight.</strong> Dense goods hit the payload limit before the container
        is full.
      </li>
      <li>
        <strong>Ignoring &ldquo;this side up&rdquo;.</strong> Upright-only 16 × 12 × 10 in cartons
        fit {n(bUp.fit, 0)} in a 40 ft high cube, against {n(bFree.fit, 0)} when they can lie on
        their side.
      </li>
      <li>
        <strong>Using parcel rules for freight.</strong> Couriers bill by dimensional weight; see
        the <Link href="/tools/dimensional-weight-calculator/">dimensional weight calculator</Link>.
        For palletized loads, use the{" "}
        <Link href="/tools/pallet-calculator/">pallet calculator</Link>.
      </li>
    </ul>
  ),
  faq,
};
