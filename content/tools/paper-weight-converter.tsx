// Step G content for tool 3. Every chart and FAQ number is computed by the
// engine from paper-conversion.json (section 13.4).
import { convertPaperWeight, type PaperWeightValue } from "@core/tools/paper-weight";
import { paperWeightInputSchema } from "@core/schemas/paper-weight";
import { STOCK_IDS, paperRules, type StockId } from "@core/schemas/paper";
import { roundDisplay } from "@core/lib/round";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const conv = (raw: Record<string, unknown>) =>
  convertPaperWeight(paperWeightInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => conv(raw).value as PaperWeightValue;
const n = (x: number, dp = 1) => roundDisplay(x, dp);
const S = paperRules.stocks;
const L = paperRules.lb;
const gsmOf = (pt: number, stock: StockId) => val({ value: pt, from: "pt", stock }).gsm;

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={conv(raw).explain} title={null} />
    </div>
  );
}

const CHART_PT = [8, 10, 12, 14, 16, 18, 20, 22, 24];
const CHART_LB = [54, 61, 68, 82, 101, 122, 135];
const CHART_GSM = [80, 100, 120, 150, 200, 250, 300, 350, 400];

const g300 = val({ value: 300, from: "gsm", stock: "uncoated" });
const g300c2s = val({ value: 300, from: "gsm", stock: "c2s" });

const faq = [
  {
    q: "How do I convert pt to GSM?",
    a: `Multiply the points by the factor for the stock: ${STOCK_IDS.map((id) => `${S[id].name.toLowerCase()} × ${n(S[id].gsmPerPt, 1)}`).join(", ")}. For example 24 pt uncoated is about ${n(gsmOf(24, "uncoated"), 0)} GSM and 24 pt C1S about ${n(gsmOf(24, "c1s"), 0)} GSM.`,
  },
  {
    q: "How do I convert lb to GSM?",
    a: `Multiply text-weight pounds by ${L.text.gsmPerLb} and cover (coated) pounds by ${L.cover.gsmPerLb}. 100 lb text is about ${n(100 * L.text.gsmPerLb, 0)} GSM; 100 lb cover is about ${n(100 * L.cover.gsmPerLb, 0)} GSM.`,
  },
  {
    q: "What is 300 GSM in lb and pt?",
    a: `300 GSM is about ${n(g300.lb)} lb cover. As uncoated board it is about ${n(g300.pt)} pt (${n(g300.mm, 3)} mm) thick; as C2S coated board about ${n(g300c2s.pt)} pt, because coating adds weight without adding much thickness.`,
  },
  {
    q: "Why does the same pt give a different GSM?",
    a: "Points measure thickness and GSM measures weight. Coating is dense, so a coated sheet weighs more at the same thickness: C1S adds about 100 to the uncoated factor and C2S about 250 (both sides).",
  },
  {
    q: "How do I convert pt to mm?",
    a: `1 pt is one thousandth of an inch, which is ${paperRules.mmPerPt} mm. So 18 pt is ${n(18 * paperRules.mmPerPt, 3)} mm thick.`,
  },
  {
    q: "Are these conversions exact?",
    a: "No. They are standard approximations by stock type, so every result is shown with ≈ and the formula used. The mill's spec sheet gives the exact figure for a particular board.",
  },
];

export const paperWeightContent: ToolContent = {
  answer: (
    <>
      Convert paper and board between GSM, lb, pt and mm. Pick the stock type (text, uncoated, C1S
      or C2S) and the converter shows the result in every unit, with the formula for each step.
    </>
  ),
  ogLine: `24 pt uncoated ≈ ${n(gsmOf(24, "uncoated"), 0)} GSM; 24 pt C1S ≈ ${n(gsmOf(24, "c1s"), 0)} GSM`,
  keyTakeaway: (
    <p>
      To convert pt to GSM, multiply by the stock&apos;s factor: {n(S.text.gsmPerPt, 1)} for text
      stock, {n(S.uncoated.gsmPerPt, 1)} for uncoated, {n(S.c1s.gsmPerPt, 1)} for C1S and{" "}
      {n(S.c2s.gsmPerPt, 1)} for C2S. To convert lb to GSM, multiply by {L.text.gsmPerLb} for text
      weight or {L.cover.gsmPerLb} for cover weight. So 24 pt uncoated is about{" "}
      {n(gsmOf(24, "uncoated"), 0)} GSM, and 300 GSM is about {n(g300.lb)} lb cover. Pack Legacy
      confirms the exact board from the mill&apos;s spec sheet before printing.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>pt to GSM:</strong>{" "}
        {STOCK_IDS.map((id) => (
          <span key={id}>
            {S[id].name}: <code>{S[id].formula}</code>.{" "}
          </span>
        ))}
      </li>
      <li>
        <strong>lb to GSM:</strong> text stock <code>{L.text.formula}</code>; cover and coated stock{" "}
        <code>{L.cover.formula}</code>.
      </li>
      <li>
        <strong>pt to mm:</strong> 1 pt = 0.001 in = {paperRules.mmPerPt} mm (exact).
      </li>
      <li>
        <strong>Other directions</strong> divide instead of multiply, so every unit is converted
        through GSM.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example title="24 pt uncoated to GSM" raw={{ value: 24, from: "pt", stock: "uncoated" }} />
      <Example title="24 pt C1S to GSM" raw={{ value: 24, from: "pt", stock: "c1s" }} />
      <Example title="54 lb text to GSM" raw={{ value: 54, from: "lb", stock: "text" }} />
      <Example
        title="300 GSM uncoated to lb and pt"
        raw={{ value: 300, from: "gsm", stock: "uncoated" }}
      />
    </>
  ),
  referenceTables: (
    <>
      <h3>PT to GSM chart by stock type</h3>
      <CompareTable
        caption="Approximate GSM for each caliper"
        columns={[
          { key: "pt", label: "Caliper" },
          { key: "mm", label: "mm" },
          ...STOCK_IDS.map((id) => ({ key: id, label: S[id].name })),
        ]}
        rows={CHART_PT.map((pt) => ({
          pt: `${pt} pt`,
          mm: n(pt * paperRules.mmPerPt, 3),
          ...Object.fromEntries(STOCK_IDS.map((id) => [id, `≈ ${n(gsmOf(pt, id), 0)}`])),
        }))}
      />
      <h3>Text and cover weight (lb) to GSM</h3>
      <CompareTable
        columns={[
          { key: "lb", label: "lb" },
          { key: "text", label: "Text stock (GSM)" },
          { key: "cover", label: "Cover / coated (GSM)" },
        ]}
        rows={CHART_LB.map((lb) => ({
          lb: `${lb} lb`,
          text: `≈ ${n(lb * L.text.gsmPerLb, 0)}`,
          cover: `≈ ${n(lb * L.cover.gsmPerLb, 0)}`,
        }))}
      />
      <h3>GSM to lb and pt</h3>
      <CompareTable
        caption="Caliper shown for uncoated and C2S coated board"
        columns={[
          { key: "gsm", label: "GSM" },
          { key: "text", label: "lb text" },
          { key: "cover", label: "lb cover" },
          { key: "unc", label: "Uncoated (pt)" },
          { key: "c2s", label: "C2S (pt)" },
        ]}
        rows={CHART_GSM.map((gsm) => ({
          gsm: String(gsm),
          text: n(gsm / L.text.gsmPerLb),
          cover: n(gsm / L.cover.gsmPerLb),
          unc: n(gsm / S.uncoated.gsmPerPt),
          c2s: n(gsm / S.c2s.gsmPerPt),
        }))}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Quoting lb without saying text or cover.</strong> 80 lb text is about{" "}
        {n(80 * L.text.gsmPerLb, 0)} GSM, but 80 lb cover is about {n(80 * L.cover.gsmPerLb, 0)}{" "}
        GSM.
      </li>
      <li>
        <strong>Treating pt and GSM as the same thing.</strong> One is thickness, the other weight.
      </li>
      <li>
        <strong>Ignoring coating.</strong> 16 pt C2S is about {n(gsmOf(16, "c2s"), 0)} GSM, but 16
        pt uncoated only about {n(gsmOf(16, "uncoated"), 0)} GSM.
      </li>
      <li>
        <strong>Treating an approximation as a spec.</strong> Use the mill&apos;s data sheet for the
        exact board.
      </li>
    </ul>
  ),
  faq,
};
