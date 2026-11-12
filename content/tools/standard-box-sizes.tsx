// Step G content for tool 2. Charts are generated from box-sizes.json and
// flutes.json; examples are produced by the engine (section 13.4).
import Link from "next/link";
import { findBoxes } from "@core/tools/box-finder";
import { calcDim } from "@core/tools/dim-weight";
import { boxFinderInputSchema } from "@core/schemas/box-finder";
import { dimWeightInputSchema } from "@core/schemas/dim-weight";
import { boxRules, fluteRules, type Box } from "@core/schemas/boxes";
import { carrierRules } from "@core/schemas/carriers";
import { roundDisplay } from "@core/lib/round";
import { volume, type Dims3 } from "@core/lib/geometry";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const boxes = Object.values(boxRules.boxes);
const byFamily = (f: Box["family"]) => boxes.filter((b) => b.family === f);
const { clearancePresetsIn: presets, caliperLayers } = boxRules.settings;
const div = carrierRules.carriers.ups.dimDivisorIn!;
const fmt = (x: number, dp = 3) => roundDisplay(x, dp);
const dims = (d: readonly number[]) => `${d.map((x) => fmt(x)).join(" x ")} in`;

/** Outside size with the given flute (published outside wins), then UPS DIM weight. */
function upsDim(b: Box, flute: "e" | "b"): number | null {
  const c = fluteRules.flutes[flute].caliperIn;
  const out: Dims3 = b.outsideIn ?? [
    b.insideIn[0] + caliperLayers.sides * c,
    b.insideIn[1] + caliperLayers.sides * c,
    b.insideIn[2] + (b.family === "rsc" ? caliperLayers.rscHeight : caliperLayers.sides) * c,
  ];
  const r = calcDim(
    dimWeightInputSchema.parse({ l: out[0], w: out[1], h: out[2], weight: 0, carriers: ["ups"] }),
    undefined,
    { rightSize: false },
  );
  return r.value.carriers.ups!.dimWeight;
}

function SizeTable({ list, flute, caption }: { list: Box[]; flute: "e" | "b"; caption: string }) {
  return (
    <CompareTable
      caption={caption}
      columns={[
        { key: "size", label: "Inside L x W x H" },
        { key: "cuin", label: "Inside volume" },
        { key: "dim", label: `UPS DIM weight (÷${div})` },
      ]}
      rows={list.map((b) => ({
        size: dims(b.insideIn),
        cuin: `${fmt(volume(b.insideIn), 0)} in³`,
        dim: `${fmt(upsDim(b, flute) ?? 0, 0)} lb`,
      }))}
    />
  );
}

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  const r = findBoxes(boxFinderInputSchema.parse(raw));
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={r.explain} title={null} />
    </div>
  );
}

const flat = byFamily("usps-flat-rate");
const mailers = byFamily("mailer");
const e = fluteRules.flutes.e;
const b = fluteRules.flutes.b;

const faq = [
  {
    q: "What are the most common mailer box sizes?",
    a: `Common stock mailer sizes include ${mailers
      .slice(4, 12)
      .map((m) => m.insideIn.map((x) => fmt(x)).join(" x "))
      .join(
        ", ",
      )} inches (inside dimensions). The right one is the smallest that fits your product plus clearance; the finder above checks every size for you.`,
  },
  {
    q: "What are the USPS Priority Mail Flat Rate box dimensions?",
    a:
      flat
        .map(
          (f) =>
            `${f.label.replace("USPS ", "")}: ${dims(f.insideIn)} inside, ${dims(f.outsideIn!)} outside`,
        )
        .join("; ") + ". Source: USPS Notice 123.",
  },
  {
    q: "Are box sizes inside or outside dimensions?",
    a: `Box sizes are almost always listed as inside dimensions, which is what your product must fit. Carriers bill on the outside size, which adds two walls per side: about ${fmt(2 * e.caliperIn)} in for ${e.name} and ${fmt(2 * b.caliperIn)} in for ${b.name}.`,
  },
  {
    q: "How much clearance should I leave around a product?",
    a: `A common rule is ${fmt(presets.snug)} in per side for a snug fit, ${fmt(presets.standard)} in for standard items and ${fmt(presets.protective)} in for fragile items that need padding. Add the thickness of any insert on every side as well.`,
  },
  {
    q: "How do I choose the right box size?",
    a: "Measure the product's length, width and height, add clearance on every side, then pick the smallest box whose inside is at least that size. Less empty space means less filler and, because carriers bill dimensional weight, often a lower shipping cost.",
  },
  {
    q: "Can I order a box size that is not on the chart?",
    a: "Yes. A box made to your product's exact size usually has the least empty space and the lowest dimensional weight. The exact-fit row in the finder shows its size and the weight it saves, and you can request a quote for it.",
  },
];

const ex = findBoxes(boxFinderInputSchema.parse({ l: 9, w: 6, h: 2.5 })).value;

export const standardBoxSizesContent: ToolContent = {
  answer: (
    <>
      Enter your product size to find the standard box that fits with the least empty space, see its
      2026 dimensional weight at UPS, FedEx, USPS and DHL, and compare it with a box made to your
      exact size.
    </>
  ),
  ogLine: `9 x 6 x 2.5 in product -> ${ex.matches[0]?.label ?? "exact fit"}`,
  keyTakeaway: (
    <p>
      To choose a box size, add clearance to every side of the product (about{" "}
      {fmt(presets.standard)} in for standard items), then pick the smallest box whose inside
      dimensions are at least that size. Carriers bill on the outside size, so the wall thickness
      counts too: each side rounds up to a whole inch and is divided by {div}. A box made to your
      exact size by Pack Legacy usually cuts both empty space and billable weight.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>Required inside size</strong> = product + 2 × (clearance + insert) on each side.
      </li>
      <li>
        <strong>Fit test.</strong> With &ldquo;any way up&rdquo;, both sizes are sorted longest
        first and compared side by side. With &ldquo;this side up&rdquo;, the product&apos;s height
        must fit the box height.
      </li>
      <li>
        <strong>Empty space</strong> = 1 − product volume ÷ box inside volume. Boxes are ranked by
        it.
      </li>
      <li>
        <strong>Outside size</strong> = inside + {caliperLayers.sides} board walls on length and
        width. For shipping boxes (RSC) the height adds {caliperLayers.rscHeight} layers because the
        flaps overlap. USPS Flat Rate boxes use USPS&apos;s published outside size.
      </li>
      <li>
        <strong>Weight</strong> per carrier comes from our{" "}
        <Link href="/tools/dimensional-weight-calculator/">dimensional weight calculator</Link>,
        using the outside size.
      </li>
      <li>
        <strong>Exact-fit box:</strong> the required size rounded up to{" "}
        {fmt(boxRules.settings.exactFitStepIn)} in.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example
        title="A 9 × 6 × 2.5 in product with standard clearance"
        raw={{ l: 9, w: 6, h: 2.5 }}
      />
      <Example
        title="A tall 4 × 4 × 9 in bottle that must stay upright"
        raw={{ l: 4, w: 4, h: 9, orientation: "upright" }}
      />
    </>
  ),
  referenceTables: (
    <>
      <h3>USPS Priority Mail Flat Rate boxes</h3>
      <CompareTable
        columns={[
          { key: "box", label: "Box" },
          { key: "inside", label: "Inside" },
          { key: "outside", label: "Outside" },
        ]}
        rows={flat.map((f) => ({
          box: f.label.replace("USPS ", ""),
          inside: dims(f.insideIn),
          outside: dims(f.outsideIn!),
        }))}
      />
      <h3>Mailer box sizes</h3>
      <SizeTable
        list={mailers}
        flute="e"
        caption={`Stock mailer sizes; outside estimated with ${e.name}`}
      />
      <h3>Shipping box (RSC) sizes</h3>
      <SizeTable
        list={byFamily("rsc")}
        flute="b"
        caption={`Stock shipping box sizes; outside estimated with ${b.name}`}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Measuring the product but not adding clearance.</strong> A 9 in product does not fit
        a 9 in box once padding, a bag or an insert goes in.
      </li>
      <li>
        <strong>Mixing up inside and outside sizes.</strong> Your product needs the inside size;
        carriers bill the outside size.
      </li>
      <li>
        <strong>Ignoring which way up.</strong> A bottle or a liquid must stay upright, which rules
        out boxes it would only fit lying down.
      </li>
      <li>
        <strong>Picking a bigger box &ldquo;to be safe&rdquo;.</strong> Every extra inch adds filler
        and can add a pound or more of dimensional weight on every parcel.
      </li>
      <li>
        <strong>Forgetting board thickness.</strong> Thicker board protects better but adds to the
        outside size, which can push a side to the next whole inch.
      </li>
    </ul>
  ),
  faq,
  extraSources: [
    {
      source: "USPS Notice 123: Price List (Flat Rate box inside and outside dimensions)",
      sourceUrl: "https://pe.usps.com/text/dmm300/Notice123.htm",
    },
  ],
};
