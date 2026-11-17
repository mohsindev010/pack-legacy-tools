// Step G content for tool 1. Every number is read from the rules files or
// produced by the engine, so the copy can never disagree with the calculator
// (section 13.4). Written for US packaging buyers; plain, answer-first.
import { calcDim } from "@core/tools/dim-weight";
import { dimWeightInputSchema } from "@core/schemas/dim-weight";
import { carrierRules, uspsCubicRules } from "@core/schemas/carriers";
import { roundDisplay } from "@core/lib/round";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import { formatDate } from "@/src/components/tools/Byline";
import type { ToolContent } from "./index";

const { ups, fedex, usps, dhl } = carrierRules.carriers;
const ah = ups.surcharges.additionalHandling!;
const lp = ups.surcharges.largePackage!;
const om = ups.surcharges.overMax!;
const gate = usps.dimAppliesAboveIn3;
const div = ups.dimDivisorIn!;
const n = (x: number) => roundDisplay(x, 0);
const d = (iso: string | undefined) => (iso ? formatDate(iso) : "");

function Example({
  title,
  raw,
  carriers,
}: {
  title: string;
  raw: Record<string, unknown>;
  carriers: string[];
}) {
  const r = calcDim(dimWeightInputSchema.parse({ ...raw, carriers }));
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={r.explain.slice(1)} title={null} />
    </div>
  );
}

const faq = [
  {
    q: "What is dimensional weight?",
    a: `Dimensional (DIM) weight is a pricing weight based on a package's size: length × width × height divided by the carrier's divisor. Carriers bill whichever is higher, the DIM weight or the actual weight, so a large light box is billed as if it were heavier.`,
  },
  {
    q: "What DIM divisor do UPS, FedEx and USPS use in 2026?",
    a: `In inches and pounds, UPS, FedEx, USPS and DHL Express all use ${div} cubic inches per pound for published rates. In centimeters and kilograms, UPS, FedEx and DHL Express use ${ups.dimDivisorCm} cubic centimeters per kilogram. USPS has no metric rule; it moved from ${usps.previousDimDivisorIn} to ${usps.dimDivisorIn} on ${d(usps.effectiveFrom)}. Negotiated contracts can use a higher divisor, which lowers DIM weight.`,
  },
  {
    q: "Does USPS use dimensional weight?",
    a: `Yes, but only for parcels over 1 cubic foot (${n(gate)} cubic inches). Smaller parcels are billed on actual weight. Above that size USPS divides by ${usps.dimDivisorIn} and rounds each side up to the next whole inch first.`,
  },
  {
    q: "Do carriers round dimensions up?",
    a: `Yes. UPS and FedEx round each side up to the next whole inch (since ${d(ups.dimRoundingSince)}), and USPS does the same since ${d(usps.dimRoundingSince)}. A 12.2 inch side counts as 13 inches, and the DIM weight is then rounded up to the next whole pound.`,
  },
  {
    q: "What is length plus girth?",
    a: `Length plus girth is the longest side plus twice each of the other two sides (L + 2W + 2H). Carriers use it for surcharges and size limits: for UPS and FedEx, more than ${ah.lengthGirthGt} inches triggers Additional Handling and more than ${lp.lengthGirthGt} inches triggers the Large Package or Oversize charge.`,
  },
  {
    q: "What triggers the UPS and FedEx Additional Handling surcharge in 2026?",
    a: `Any one of: longest side over ${ah.longestGt} in, second-longest side over ${ah.secondGt} in, length plus girth over ${ah.lengthGirthGt} in, actual weight over ${ah.weightGtLb} lb, or (new in 2026) volume over ${n(ah.volumeGtIn3)} cubic inches. FedEx added the volume trigger on ${d(fedex.effectiveFrom)} and UPS on ${d(ups.effectiveFrom)}.`,
  },
  {
    q: "What is USPS cubic pricing?",
    a: `Cubic pricing charges small, heavy parcels by size tier instead of weight. A box qualifies up to ${uspsCubicRules.cubic.groundAdvantageCubic.maxFt3} cubic foot for Ground Advantage Cubic or ${uspsCubicRules.cubic.priorityMailCubic.maxFt3} cubic foot for Priority Mail Cubic, up to ${uspsCubicRules.cubic.groundAdvantageCubic.maxWeightLb} lb, with no side over ${uspsCubicRules.cubic.groundAdvantageCubic.maxLongestIn} in. For cubic, each side is rounded down to the nearest quarter inch.`,
  },
  {
    q: "How do I reduce dimensional weight?",
    a: `Use the smallest box that protects the product. Because every side rounds up to a whole inch, trimming a side from 12.2 to 12 inches can drop the bill by a pound or more. The right-size list above shows which single cut saves weight with each carrier.`,
  },
];

const og = calcDim(
  dimWeightInputSchema.parse({ l: 16, w: 12, h: 8, weight: 2, carriers: ["ups", "usps"] }),
).value.carriers;

export const dimensionalWeightContent: ToolContent = {
  ogLine: `16 x 12 x 8 in, 2 lb -> UPS ${og.ups!.billable} lb, USPS ${og.usps!.billable} lb billable`,
  answer: (
    <>
      Enter a box, poly mailer or Mylar bag size and weight in inches/lb or cm/kg to see the
      billable weight at UPS, FedEx, USPS and DHL side by side, using the 2026 rules: every side
      rounded up, a{div} divisor for inches ({ups.dimDivisorCm} for cm), and USPS dimensional weight
      only above 1 cubic foot.
    </>
  ),
  keyTakeaway: (
    <p>
      Dimensional weight is length × width × height in inches divided by a carrier divisor, rounded
      up to the next whole pound. In 2026 UPS, FedEx and USPS all divide by {div} and round every
      side up to the next whole inch first; USPS applies it only above 1 cubic foot. Carriers bill
      the higher of dimensional and actual weight, so a box sized closely by Pack Legacy can lower
      the billable weight before any rate is applied.
    </p>
  ),
  methodology: (
    <>
      <p>
        The calculator applies each carrier&apos;s published rule in this order and shows every
        step.
      </p>
      <ol>
        <li>
          <strong>Round each side up</strong> to the next whole inch, or whole centimeter when you
          work in cm. An exact whole number stays as it is.
        </li>
        <li>
          <strong>Multiply</strong> the rounded sides to get the volume (cubic inches or cubic
          centimeters).
        </li>
        <li>
          <strong>USPS only:</strong> if the volume is {n(gate)} cubic inches or less, skip
          dimensional weight and bill the actual weight.
        </li>
        <li>
          <strong>Divide</strong> by the divisor . In inches and pounds the divisor is {div} for
          UPS, FedEx, USPS and DHL Express, rounded up to the next whole pound. In cm and kg it is{" "}
          {ups.dimDivisorCm} for UPS, FedEx and DHL Express, rounded up to the next whole kg (0.5 kg
          for DHL). USPS has no metric rule, so it is always worked in inches and pounds and shown
          with the kg equivalent.
        </li>
        <li>
          <strong>Round the actual weight up</strong> the same way, and bill the higher of the two.
        </li>
        <li>
          <strong>Check surcharges</strong> on the rounded size in inches (also for cm input):
          Additional Handling, Large Package or Oversize (with a {lp.minBillableLb} lb minimum
          billable weight), and the over-maximum limits of {om.longestGt} in, {om.lengthGirthGt} in
          length plus girth, or {om.weightGtLb} lb.
        </li>
        <li>
          <strong>USPS cubic:</strong> round each side <em>down</em> to the nearest quarter inch and
          find the cubic tier.
        </li>
      </ol>
      <h3>What changed in 2025 and 2026</h3>
      <CompareTable
        columns={[
          { key: "date", label: "Effective" },
          { key: "carrier", label: "Carrier" },
          { key: "change", label: "Change" },
        ]}
        rows={[
          {
            date: d(ups.dimRoundingSince),
            carrier: "UPS, FedEx",
            change: "Each side rounded up to the next whole inch before DIM weight",
          },
          {
            date: d(fedex.effectiveFrom),
            carrier: "FedEx",
            change: `Additional Handling over ${n(ah.volumeGtIn3)} in³; Oversize over ${n(lp.volumeGtIn3)} in³`,
          },
          {
            date: d(ups.effectiveFrom),
            carrier: "UPS",
            change: `Additional Handling over ${n(ah.volumeGtIn3)} in³; Large Package over ${n(lp.volumeGtIn3)} in³`,
          },
          {
            date: d(usps.effectiveFrom),
            carrier: "USPS",
            change: `Divisor ${usps.previousDimDivisorIn} → ${usps.dimDivisorIn}; each side rounded up to the next whole inch`,
          },
        ]}
      />
      <p>
        These are published-rate rules. Contract rates often use a different divisor; enter yours
        under &ldquo;More options&rdquo;. The tool reports weight only, never prices.
      </p>
    </>
  ),
  workedExamples: (
    <>
      <Example
        title="A 16 × 12 × 8 in box weighing 2 lb"
        raw={{ l: 16, w: 12, h: 8, weight: 2 }}
        carriers={["ups", "usps"]}
      />
      <Example
        title="A fractional side: 12.2 × 9 × 4 in, 2.5 lb"
        raw={{ l: 12.2, w: 9, h: 4, weight: 2.5 }}
        carriers={["ups"]}
      />
      <Example
        title="The 2026 volume trigger: 36 × 17 × 17 in, 10 lb"
        raw={{ l: 36, w: 17, h: 17, weight: 10 }}
        carriers={["fedex"]}
      />
    </>
  ),
  referenceTables: (
    <>
      <h3>Divisors and surcharge thresholds</h3>
      <CompareTable
        columns={[
          { key: "rule", label: "Rule" },
          { key: "ups", label: "UPS" },
          { key: "fedex", label: "FedEx" },
          { key: "usps", label: "USPS" },
          { key: "dhl", label: "DHL Express" },
        ]}
        rows={[
          {
            rule: "DIM divisor (in³/lb)",
            ups: ups.dimDivisorIn,
            fedex: fedex.dimDivisorIn,
            usps: usps.dimDivisorIn,
            dhl: dhl.dimDivisorIn,
          },
          {
            rule: "DIM divisor (cm³/kg)",
            ups: n(ups.dimDivisorCm!),
            fedex: n(fedex.dimDivisorCm!),
            usps: "None (inch rules only)",
            dhl: n(dhl.dimDivisorCm!),
          },
          {
            rule: "kg rounding",
            ups: `Up to ${ups.metricWeightStepKg} kg`,
            fedex: `Up to ${fedex.metricWeightStepKg} kg`,
            usps: "n/a",
            dhl: `Up to ${dhl.metricWeightStepKg} kg`,
          },
          {
            rule: "DIM applies above",
            ups: "Any size",
            fedex: "Any size",
            usps: `${n(gate)} in³ (1 cu ft)`,
            dhl: "Any size",
          },
          {
            rule: "Additional Handling: longest side over",
            ups: `${ah.longestGt} in`,
            fedex: `${fedex.surcharges.additionalHandling!.longestGt} in`,
            usps: "n/a",
            dhl: "Not included",
          },
          {
            rule: "Additional Handling: length + girth over",
            ups: `${ah.lengthGirthGt} in`,
            fedex: `${fedex.surcharges.additionalHandling!.lengthGirthGt} in`,
            usps: "n/a",
            dhl: "Not included",
          },
          {
            rule: "Additional Handling: volume over",
            ups: `${n(ah.volumeGtIn3)} in³`,
            fedex: `${n(fedex.surcharges.additionalHandling!.volumeGtIn3)} in³`,
            usps: "n/a",
            dhl: "Not included",
          },
          {
            rule: "Large Package / Oversize: volume over",
            ups: `${n(lp.volumeGtIn3)} in³`,
            fedex: `${n(fedex.surcharges.largePackage!.volumeGtIn3)} in³`,
            usps: "n/a",
            dhl: "Not included",
          },
          {
            rule: "Maximum weight",
            ups: `${om.weightGtLb} lb`,
            fedex: `${fedex.surcharges.overMax!.weightGtLb} lb`,
            usps: `${usps.limits!.maxWeightLb} lb`,
            dhl: "Not included",
          },
          {
            rule: "Maximum length + girth",
            ups: `${om.lengthGirthGt} in`,
            fedex: `${fedex.surcharges.overMax!.lengthGirthGt} in`,
            usps: `${usps.limits!.maxLengthGirth} in`,
            dhl: "Not included",
          },
        ]}
      />
      <h3>USPS cubic tiers for poly mailers, envelopes and Mylar bags</h3>
      <CompareTable
        columns={[
          { key: "tier", label: "Cubic tier" },
          { key: "lw", label: "Length + width up to" },
        ]}
        rows={uspsCubicRules.cubic.softpackTiers.map((t) => ({
          tier: `${t.tierFt3} cu ft`,
          lw: `${t.maxLengthPlusWidthIn} in`,
        }))}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Using inside dimensions.</strong> Carriers measure the outside of the box.
        Corrugated walls add about 1/16 to 1/4 in per side, which can push a side to the next whole
        inch.
      </li>
      <li>
        <strong>Ignoring bulge.</strong> An overfilled box measures larger than its spec. Carriers
        bill what their scanners measure.
      </li>
      <li>
        <strong>Rounding only the final answer.</strong> Since 2025 each side is rounded up before
        multiplying, so 12.2 × 9 × 4 is billed as 13 × 9 × 4.
      </li>
      <li>
        <strong>Using 166 for USPS.</strong> The USPS divisor has been {usps.dimDivisorIn} since{" "}
        {d(usps.effectiveFrom)}.
      </li>
      <li>
        <strong>Assuming USPS never uses dimensional weight.</strong> It does, for any parcel over 1
        cubic foot.
      </li>
      <li>
        <strong>Missing the 2026 volume triggers.</strong> A box can avoid every length rule and
        still pay Additional Handling for being over {n(ah.volumeGtIn3)} cubic inches.
      </li>
    </ul>
  ),
  faq,
  extraSources: [
    {
      source: "USPS Domestic Mail Manual 283: USPS Ground Advantage (dimensional weight, cubic)",
      sourceUrl: "https://pe.usps.com/text/dmm300/283.htm",
    },
    {
      source: "USPS Notice 123: Price List",
      sourceUrl: "https://pe.usps.com/text/dmm300/Notice123.htm",
    },
    {
      source: "Sifted: 2025–2026 FedEx & UPS changes (DIM rounding and cubic volume rules)",
      sourceUrl:
        "https://sifted.com/resources/2025-2026-fedex-ups-changes-how-dim-rounding-and-cubic-volume-rules-will-impact-your-costs/",
    },
    {
      source: "Loop: 2026 parcel surcharge changes and cubic volume rules",
      sourceUrl:
        "https://www.loop.com/industry-insights/2026-parcel-surcharge-changes-what-shippers-need-to-know-about-new-cubic-volume-rules",
    },
  ],
};
