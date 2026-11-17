// Step G content for tool 8. Every number is computed by the engine from
// mylar-presets.json and bulk-density.json (section 13.4).
import Link from "next/link";
import { findMylarBag, type MylarValue } from "@core/tools/mylar";
import {
  BAG_IDS,
  PRODUCT_IDS,
  densityRules,
  mylarInputSchema,
  mylarRules,
} from "@core/schemas/storage";
import { roundDisplay } from "@core/lib/round";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const run = (raw: Record<string, unknown>) => findMylarBag(mylarInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as MylarValue;
const n = (x: number, dp = 2) => roundDisplay(x, dp);
const B = mylarRules.bags;
const D = densityRules.entries;
const hs = mylarRules.defaultHeadspacePct;
const holds = (product: string, bag: string) =>
  val({ weight: 1, unit: "lb", product }).bags.find((b) => b.id === bag)!.holds;
const dims = (id: (typeof BAG_IDS)[number]) =>
  `${B[id].widthIn} × ${B[id].heightIn} in${B[id].gussetIn ? ` + ${B[id].gussetIn} in gusset` : ""}`;

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={run(raw).explain} title={null} />
    </div>
  );
}

const ex = val({ weight: 4, unit: "lb", product: "rice" });
const exBag = ex.bags.find((b) => b.id === ex.recommended)!;

const faq = [
  {
    q: "What size mylar bag do I need?",
    a: `Divide the fill weight by the product's bulk density to get its volume, add about ${hs} % headspace for sealing, and choose the smallest bag that holds it. 4 lb of white rice is ${n(ex.productL, 2)} L, so a 1 gallon bag (${n(exBag.capacityL, 2)} L) is the right size.`,
  },
  {
    q: "How much rice fits in a 1 gallon mylar bag?",
    a: `About ${n(holds("rice", "gallon-zip"), 1)} lb of white rice, leaving ${hs} % headspace, using a bulk density of ${D.rice.kgM3} g/L. A 5 gallon bag holds about ${n(holds("rice", "5gallon-open"), 1)} lb.`,
  },
  {
    q: "What are the dimensions of a 1 gallon mylar bag?",
    a: `Common sizes are ${dims("gallon-zip")} for a stand-up zip bag and ${dims("gallon-open")} for a flat open-end bag. Sizes differ a little between makers.`,
  },
  {
    q: "What are the dimensions of a 5 gallon mylar bag?",
    a: `About ${dims("5gallon-open")}. It is sized to line a 5 gallon bucket, and lighter products like oats fill it before they reach the weight of rice: about ${n(holds("oats", "5gallon-open"), 1)} lb of oats vs ${n(holds("rice", "5gallon-open"), 1)} lb of rice.`,
  },
  {
    q: "Why leave headspace?",
    a: "The top of the bag has to lie flat in the sealer, and powders settle. Leaving about a tenth of the bag empty gives a clean seal. You can set your own headspace in the calculator.",
  },
  {
    q: "How many oxygen absorbers does a mylar bag need?",
    a: "It depends on the air left in the bag. Use the oxygen absorber calculator: it works out the residual air from the bag size and product weight.",
  },
];

export const mylarContent: ToolContent = {
  answer: (
    <>
      Enter the product and how much you want in each bag to find the right mylar bag size, with its
      width, height and gusset, how full it will be, and how much each standard size holds.
    </>
  ),
  ogLine: `4 lb of rice → ${exBag.name} (${dims(ex.recommended)})`,
  keyTakeaway: (
    <p>
      To size a mylar bag, divide the fill weight by the product&apos;s bulk density to get its
      volume, add about {hs} % headspace for sealing, and pick the smallest bag that holds it. White
      rice at {D.rice.kgM3} g/L means 4 lb takes {n(ex.productL, 2)} L, so it needs a 1 gallon bag (
      {dims("gallon-zip")}). Pack Legacy makes custom printed mylar bags when a standard size does
      not fit your product.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>Product volume</strong> = fill weight ÷ bulk density (g/L). Densities are loose bulk
        densities from The Engineering ToolBox, or your own.
      </li>
      <li>
        <strong>Headspace</strong>: add {hs} % (or your figure) for sealing and settling.
      </li>
      <li>
        <strong>Bag capacity</strong> is the size it is sold as: 1 quart = 0.946 L, 1 gallon = 3.785
        L.
      </li>
      <li>
        <strong>Pick</strong> the smallest bag whose capacity covers the volume. If none does, split
        the product across several of the largest bag.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example title="4 lb of white rice" raw={{ weight: 4, unit: "lb", product: "rice" }} />
      <Example title="1 lb of flour" raw={{ weight: 1, unit: "lb", product: "flour" }} />
      <Example title="30 lb of rice" raw={{ weight: 30, unit: "lb", product: "rice" }} />
    </>
  ),
  referenceTables: (
    <>
      <h3>Mylar bag size chart</h3>
      <CompareTable
        caption={`How much each bag holds with ${hs} % headspace`}
        columns={[
          { key: "name", label: "Bag" },
          { key: "dims", label: "Size" },
          { key: "cap", label: "Capacity" },
          { key: "rice", label: "Rice (lb)" },
          { key: "beans", label: "Beans (lb)" },
          { key: "flour", label: "Flour (lb)" },
          { key: "oats", label: "Oats (lb)" },
        ]}
        rows={BAG_IDS.map((id) => ({
          name: B[id].name,
          dims: dims(id),
          cap: `${n(B[id].capacityQt * mylarRules.litersPerQuart, 2)} L`,
          rice: n(holds("rice", id), 1),
          beans: n(holds("beans", id), 1),
          flour: n(holds("flour", id), 1),
          oats: n(holds("oats", id), 1),
        }))}
      />
      <h3>Bulk densities used</h3>
      <CompareTable
        columns={[
          { key: "name", label: "Product" },
          { key: "d", label: "Bulk density (g/L)" },
        ]}
        rows={PRODUCT_IDS.map((id) => ({ name: D[id].name, d: n(D[id].kgM3, 0) }))}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Sizing by weight alone.</strong> 4 lb of oats takes{" "}
        {n(val({ weight: 4, unit: "lb", product: "oats" }).productL, 1)} L but 4 lb of rice only{" "}
        {n(ex.productL, 1)} L.
      </li>
      <li>
        <strong>Filling to the top.</strong> Leave room to lay the top flat in the sealer.
      </li>
      <li>
        <strong>Assuming every &ldquo;1 gallon&rdquo; bag is the same size.</strong> Makers cut them
        differently; check the width if it has to fit a bucket.
      </li>
      <li>
        <strong>Forgetting the oxygen absorber.</strong> Size it with the{" "}
        <Link href="/tools/oxygen-absorber-calculator/">oxygen absorber calculator</Link>.
      </li>
    </ul>
  ),
  faq,
};
