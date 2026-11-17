// Step G content for tool 9. Every number is computed by the engine from
// o2-absorbers.json and mylar-presets.json (section 13.4).
import Link from "next/link";
import { calcOxygen, type O2Value } from "@core/tools/oxygen";
import { BAG_IDS, O2_CONTAINER_IDS, o2InputSchema, o2Rules } from "@core/schemas/storage";
import { roundDisplay } from "@core/lib/round";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const run = (raw: Record<string, unknown>) => calcOxygen(o2InputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as O2Value;
const n = (x: number, dp = 0) => roundDisplay(x, dp);
const M = o2Rules.method;
const plan = (v: O2Value) => v.perContainer.sizes.map((s) => `${s} cc`).join(" + ");

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={run(raw).explain} title={null} />
    </div>
  );
}

const pail = val({ container: "pail5", weight: 35, weightUnit: "lb" });
const gal = val({ container: "gallon-zip", weight: 4, weightUnit: "lb" });
const galEmpty = val({ container: "gallon-zip" });
const CONTAINERS = [...BAG_IDS, ...O2_CONTAINER_IDS];

const faq = [
  {
    q: "How do I calculate how many cc of oxygen absorber I need?",
    a: `Air is ${n(M.oxygenFraction * 100)} % oxygen. Work out the air left in the container: its volume in cc minus the product, counting each gram of product as 1 cc. Multiply the air by ${M.oxygenFraction}, then round up to the next absorber size. A 5 gallon pail (${n(pail.containerCc)} cc) with 35 lb of rice (${n(pail.productCc)} g) has ${n(pail.airCc)} cc of air, which holds ${n(pail.oxygenCc, 1)} cc of oxygen, so one ${plan(pail)} absorber covers it.`,
  },
  {
    q: "What size oxygen absorber for a 1 gallon mylar bag?",
    a: `With 4 lb of rice, a 1 gallon bag holds about ${n(gal.oxygenCc)} cc of oxygen, so ${plan(gal)}. Empty or with a light product it can be up to ${n(galEmpty.oxygenCc)} cc, so ${plan(galEmpty)}.`,
  },
  {
    q: "What size oxygen absorber for a 5 gallon bucket?",
    a: `Filled with 35 lb of rice, about ${n(pail.oxygenCc)} cc of oxygen, so ${plan(pail)}. Lighter, bulkier foods leave more air: an empty 5 gallon pail holds ${n(val({ container: "pail5" }).oxygenCc)} cc of oxygen.`,
  },
  {
    q: "Can I use too many oxygen absorbers?",
    a: "Extra capacity does no harm to the food; it just costs more. Too little leaves oxygen in the container, so always round up.",
  },
  {
    q: "Why count 1 gram as 1 cc?",
    a: "It is the Sorbent Systems method. Most dry foods are denser than water grain by grain, so 1 g = 1 cc slightly overstates the product and understates the air, which is why the result is rounded up to the next packet size. The air between grains is included as air.",
  },
  {
    q: "Which foods can be stored with oxygen absorbers?",
    a: "Dry, low-moisture foods such as rice, beans, wheat, oats and pasta. Do not use them with moist foods. Seal the container soon after adding the absorber, as it starts working as soon as it meets air.",
  },
];

export const oxygenContent: ToolContent = {
  answer: (
    <>
      Choose a mylar bag, can, pail or your own container, enter how much product is in it, and see
      how many cc of oxygen absorber it needs and the fewest packets that cover it.
    </>
  ),
  ogLine: `5 gallon pail + 35 lb rice → ${n(pail.oxygenCc)} cc oxygen → ${plan(pail)}`,
  keyTakeaway: (
    <p>
      Oxygen absorber size = (container volume − product weight in grams as cc) × {M.oxygenFraction}
      , rounded up to the next packet size. A 5 gallon pail with 35 lb of rice leaves{" "}
      {n(pail.airCc)} cc of air, or {n(pail.oxygenCc)} cc of oxygen, so one {plan(pail)} absorber is
      enough. A 1 gallon mylar bag with 4 lb of rice needs {plan(gal)}. Pack Legacy supplies the
      mylar bags to pair with them.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>Container volume</strong> in cc: from the bag&apos;s sold capacity (1 gallon = 3,785
        cc), Sorbent Systems&apos; figures for cans and pails, or your own.
      </li>
      <li>
        <strong>Product volume</strong>: its weight in grams, counted as cc (1 g = 1 cc).
      </li>
      <li>
        <strong>Residual air</strong> = container − product. This includes the headspace and the air
        between grains.
      </li>
      <li>
        <strong>Oxygen</strong> = residual air × {M.oxygenFraction}.
      </li>
      <li>
        <strong>Packets</strong>: the fewest packets whose total covers the oxygen, then the
        smallest total. The table also shows how many you need if you stock one size.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example
        title="5 gallon pail with 35 lb of rice"
        raw={{ container: "pail5", weight: 35, weightUnit: "lb" }}
      />
      <Example
        title="1 gallon mylar bag with 4 lb of rice"
        raw={{ container: "gallon-zip", weight: 4, weightUnit: "lb" }}
      />
      <Example title="Empty #10 can" raw={{ container: "can10" }} />
    </>
  ),
  referenceTables: (
    <>
      <h3>Oxygen absorber chart (empty container, the most you need)</h3>
      <CompareTable
        caption="Fill the container with product and the need drops: use the calculator for your fill"
        columns={[
          { key: "name", label: "Container" },
          { key: "vol", label: "Volume" },
          { key: "o2", label: "Oxygen" },
          { key: "packets", label: "Absorber" },
        ]}
        rows={CONTAINERS.map((id) => {
          const v = val({ container: id });
          return {
            name: v.containerName,
            vol: `${n(v.containerCc)} cc`,
            o2: `${n(v.oxygenCc)} cc`,
            packets: plan(v),
          };
        })}
      />
      <h3>Common packet sizes</h3>
      <p>{o2Rules.packets.sizesCc.map((s) => `${s} cc`).join(", ")}.</p>
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Rounding down.</strong> Always round up to the next packet size.
      </li>
      <li>
        <strong>Forgetting the air between grains.</strong> A full bag still holds air around every
        grain; the method counts it.
      </li>
      <li>
        <strong>Leaving absorbers in the open.</strong> They start working on room air; reseal the
        unused ones straight away.
      </li>
      <li>
        <strong>Using the wrong bag size.</strong> Find it first with the{" "}
        <Link href="/tools/mylar-bag-size-finder/">mylar bag size finder</Link>.
      </li>
    </ul>
  ),
  faq,
  extraSources: [{ source: "Sorbent Systems: measuring volume of oxygen", sourceUrl: M.sourceUrl }],
};
