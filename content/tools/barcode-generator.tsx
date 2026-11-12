// Step G content for tool 5. Size tables come from the engine and barcode-specs.json.
import { generateBarcode, type BarcodeValue } from "@core/tools/barcode";
import { barcodeInputSchema } from "@core/schemas/barcode";
import { asEan, asLinear, barcodeRules, SYMBOLOGY_IDS } from "@core/schemas/codes";
import { roundDisplay } from "@core/lib/round";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const specs = barcodeRules.symbologies;
const run = (raw: Record<string, unknown>) => generateBarcode(barcodeInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as BarcodeValue;
const mm = (x: number, dp = 2) => roundDisplay(x, dp);
const upca = asEan(specs.upca);
const itf = asLinear(specs.itf14);
const g128 = asLinear(specs["gs1-128"]);
const u100 = val({ symbology: "upca", data: "03600029145" });
const u80 = val({ symbology: "upca", data: "03600029145", magnification: 80 });
const MAGS = [80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={run(raw).explain} title={null} />
    </div>
  );
}

const sizeRule = (id: (typeof SYMBOLOGY_IDS)[number]) => {
  const s = specs[id];
  return s.kind === "ean"
    ? `X ${s.xNominalMm} mm at 100%; ${s.magnification.min}–${s.magnification.max}%`
    : `X ${s.x.minMm}–${s.x.maxMm} mm`;
};

const faq = [
  {
    q: "What size is a UPC barcode?",
    a: `At 100% magnification a UPC-A is ${mm(u100.widthMm)} x ${mm(u100.heightMm)} mm including its quiet zones, with a narrow bar (X-dimension) of ${upca.xNominalMm} mm. GS1 allows ${upca.magnification.min}% to ${upca.magnification.max}%: the smallest is ${mm(u80.widthMm)} mm wide. Bigger is easier to scan, especially on curved or glossy packs.`,
  },
  {
    q: "Do I need GS1 to make a UPC barcode?",
    a: "You can draw a barcode for any number, but a UPC or EAN for retail must carry a GTIN licensed to your company by GS1 (GS1 US in the United States). Retailers and marketplaces check the company prefix, so a made-up or resold number can get products rejected.",
  },
  {
    q: "Can I make my own UPC barcode for free?",
    a: "Yes: once you have a GTIN from GS1, this generator draws the barcode at the exact size, with the check digit, quiet zones and human-readable digits, as SVG, PDF or PNG. The barcode image itself has no licence fee; the number does.",
  },
  {
    q: "What is the difference between ITF-14 and UPC?",
    a: `UPC-A (or EAN-13) goes on the retail unit and is scanned at the checkout. ITF-14 carries a 14-digit GTIN for the outer case and is printed on shipping cartons, often straight onto corrugated board. Its bars are thicker (X ${itf.x.minMm}–${itf.x.maxMm} mm, at least ${itf.minBarHeightMm} mm tall) and it is usually framed by bearer bars.`,
  },
  {
    q: "What is the X-dimension of a barcode?",
    a: `The X-dimension is the width of the narrowest bar or space. Every other size follows from it: quiet zones, bar widths and the overall width. For UPC and EAN it is ${upca.xNominalMm} mm at 100% magnification.`,
  },
  {
    q: "Why do red barcodes not scan?",
    a: "Most retail scanners read with red light (about 660 nm). Red, orange and yellow ink reflect that light, so red bars look the same as a white background to the scanner. Use black, dark blue, dark green or dark brown bars on a white or light background.",
  },
  {
    q: "What is a quiet zone?",
    a: `The quiet zone is the blank margin a scanner needs to find the start and end of a barcode. UPC-A needs ${upca.quietZoneX[0]}X on each side; EAN-13 needs ${specs.ean13.quietZoneX[0]}X on the left and ${specs.ean13.quietZoneX[1]}X on the right; ITF-14 and GS1-128 need ${itf.quietZoneX[0]}X. Keep text, edges and folds out of it.`,
  },
];

export const barcodeContent: ToolContent = {
  answer: (
    <>
      Make print-ready UPC, EAN, ITF-14, GS1-128, Code 128, Code 39 and GS1 DataMatrix barcodes at
      the exact size, with the check digit, GS1 quiet zones and contrast checks, as SVG, PDF or PNG.
    </>
  ),
  ogLine: `UPC-A at 100% = ${mm(u100.widthMm)} x ${mm(u100.heightMm)} mm, X ${upca.xNominalMm} mm`,
  keyTakeaway: (
    <p>
      A UPC-A or EAN-13 at 100% magnification has a {upca.xNominalMm} mm narrow bar and measures{" "}
      {mm(u100.widthMm)} x {mm(u100.heightMm)} mm with its quiet zones; GS1 allows{" "}
      {upca.magnification.min}% to {upca.magnification.max}%, and every size scales with it. The
      check digit is a GS1 mod-10 sum (weights 3 and 1 from the right). Print dark bars on a light
      background, never red. Pack Legacy prints the code on your packaging at the size you choose.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>Data and check digit.</strong> The number is checked for its length and character
        set. A missing check digit is added; a wrong one is an error: from the rightmost digit,
        multiply by 3 and 1 in turn, add up, and the check digit makes the total a multiple of 10.
      </li>
      <li>
        <strong>Encoding.</strong> The open-source bwip-js library (Barcode Writer in Pure
        PostScript) produces the bar pattern.
      </li>
      <li>
        <strong>Exact size.</strong> We draw every bar ourselves so one module is exactly X mm. For
        UPC and EAN, X = {upca.xNominalMm} mm × magnification and bar heights scale with it; guard
        bars extend {upca.guardExtensionX}X below the others.
      </li>
      <li>
        <strong>Quiet zones</strong> come from the GS1 General Specifications for each symbology and
        are part of the downloaded file, so they cannot be cropped off by accident.
      </li>
      <li>
        <strong>Contrast</strong> is estimated as background minus bar reflectance under red light
        (660 nm) for linear barcodes, and white light for DataMatrix.
      </li>
      <li>
        <strong>Files.</strong> SVG and PDF are vector and exact size; PNG is rendered at the
        resolution you pick.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example title="UPC-A 03600029145 at 100%" raw={{ symbology: "upca", data: "03600029145" }} />
      <Example
        title="ITF-14 for a shipping case"
        raw={{ symbology: "itf14", data: "1540014128876" }}
      />
    </>
  ),
  referenceTables: (
    <>
      <h3>UPC-A and EAN-13 size by magnification</h3>
      <CompareTable
        caption="Width includes quiet zones; height includes the digits"
        columns={[
          { key: "mag", label: "Magnification" },
          { key: "x", label: "X (mm)" },
          { key: "w", label: "Width (mm)" },
          { key: "h", label: "Height (mm)" },
          { key: "e8", label: "EAN-8 (mm)" },
        ]}
        rows={MAGS.map((m) => {
          const u = val({ symbology: "upca", data: "03600029145", magnification: m });
          const e = val({ symbology: "ean8", data: "9638507", magnification: m });
          return {
            mag: `${m}%`,
            x: mm(u.xMm, 3),
            w: mm(u.widthMm),
            h: mm(u.heightMm),
            e8: `${mm(e.widthMm)} x ${mm(e.heightMm)}`,
          };
        })}
        highlightRow={MAGS.indexOf(100)}
      />
      <h3>Which barcode for which use</h3>
      <CompareTable
        columns={[
          { key: "sym", label: "Barcode" },
          { key: "use", label: "Use" },
          { key: "size", label: "Size rule" },
          { key: "qz", label: "Quiet zone" },
        ]}
        rows={SYMBOLOGY_IDS.map((id) => ({
          sym: specs[id].label,
          use: specs[id].use,
          size: sizeRule(id),
          qz:
            specs[id].quietZoneX[0] === specs[id].quietZoneX[1]
              ? `${specs[id].quietZoneX[0]}X each side`
              : `${specs[id].quietZoneX[0]}X left, ${specs[id].quietZoneX[1]}X right`,
        }))}
      />
      <h3>Shipping case and logistics barcodes</h3>
      <CompareTable
        columns={[
          { key: "sym", label: "Barcode" },
          { key: "x", label: "X min / max" },
          { key: "h", label: "Min bar height" },
          { key: "note", label: "Note" },
        ]}
        rows={[
          {
            sym: itf.label,
            x: `${itf.x.minMm} / ${itf.x.maxMm} mm`,
            h: `${itf.minBarHeightMm} mm`,
            note: `Bearer bars ${itf.bearerBarMm} mm; on corrugated, use X 0.635 mm or more`,
          },
          {
            sym: g128.label,
            x: `${g128.x.minMm} / ${g128.x.maxMm} mm`,
            h: `${g128.minBarHeightMm} mm`,
            note: `At most ${g128.maxWidthMm} mm wide`,
          },
        ]}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Shrinking the barcode to fit the artwork.</strong> Below {upca.magnification.min}%
        it is out of the GS1 specification and may not scan at the checkout.
      </li>
      <li>
        <strong>Cutting the bars short (truncation).</strong> Short bars cannot be read at an angle;
        many retailers reject truncated codes.
      </li>
      <li>
        <strong>Red or light bars.</strong> Red scanner light makes red bars invisible.
      </li>
      <li>
        <strong>Cropping the quiet zones.</strong> Text, a box edge or a fold inside the margin
        stops the scanner finding the code.
      </li>
      <li>
        <strong>Saving as a low-resolution JPG.</strong> Use the SVG or PDF for print; JPG blurs bar
        edges.
      </li>
      <li>
        <strong>Using a number you do not own.</strong> Retail GTINs must come from GS1.
      </li>
    </ul>
  ),
  faq,
  extraSources: [
    {
      source: "GS1 US: How to calculate a check digit manually",
      sourceUrl:
        "https://documents.gs1us.org/adobe/assets/deliver/urn:aaid:aem:77c80eac-d4e2-41b1-a80d-97739060e8f4/How-to-Calculate-a-Check-Digit.pdf",
    },
    {
      source: "bwip-js (Barcode Writer in Pure PostScript)",
      sourceUrl: "https://github.com/metafloor/bwip-js",
    },
  ],
};
