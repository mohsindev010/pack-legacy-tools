// Step G content for tool 4. Size tables come from the engine and qr-specs.json.
import { generateQr, type QrValue } from "@core/tools/qr";
import { qrInputSchema } from "@core/schemas/qr";
import { qrRules } from "@core/schemas/codes";
import { roundDisplay } from "@core/lib/round";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { CompareTable } from "@/src/components/tools/CompareTable";
import type { ToolContent } from "./index";

const run = (raw: Record<string, unknown>) => generateQr(qrInputSchema.parse(raw));
const val = (raw: Record<string, unknown>) => run(raw).value as QrValue;
const n = (x: number, dp = 2) => roundDisplay(x, dp);
const PL = { type: "url", url: "https://packlegacy.com/" };
const def = val(PL);
const { sizing, quietZone, module: mod } = qrRules;
const DISTANCES = [10, 20, 30, 50, 100, 150, 200];
const RECOVERY = { L: "7%", M: "15%", Q: "25%", H: "30%" } as const;

function Example({ title, raw }: { title: string; raw: Record<string, unknown> }) {
  return (
    <div>
      <h3>{title}</h3>
      <ExplainSteps steps={run(raw).explain} title={null} />
    </div>
  );
}

const faq = [
  {
    q: "What size should a QR code be on packaging?",
    a: `Use the 10:1 rule: the code should be at least one tenth of the scanning distance, and never smaller than ${n(sizing.minSizeMm / 10, 0)} x ${n(sizing.minSizeMm / 10, 0)} cm. A code scanned from 30 cm (a pack in the hand) needs about 3 cm; from 1 m (a shelf or carton) about 10 cm. Long URLs make denser codes, so keep the link short or print larger.`,
  },
  {
    q: "Do QR codes expire?",
    a: "A static QR code like the ones made here never expires: the link is stored in the pattern itself. It stops working only if the web page it points to goes away, so point it at a page you control.",
  },
  {
    q: "What is the difference between a static and a dynamic QR code?",
    a: "A static code stores the final link. A dynamic code stores a short link on a provider's server that redirects to your page, so you can change the destination and count scans, but it breaks if you stop paying the provider. For packaging that will be in circulation for years, a static link to your own domain (with UTM tags for tracking) is the safer choice.",
  },
  {
    q: "Can I add a logo to a QR code?",
    a: `Yes. The logo covers part of the pattern, so error correction is set to H, which can rebuild about 30% of the code. We keep the logo to ${n(qrRules.logo.maxWidthShare * 100, 0)}% of the width and decode the finished code in your browser before you can download it.`,
  },
  {
    q: "What is a GS1 Digital Link QR code?",
    a: "It is a QR code whose web address carries your product's GTIN (and optionally batch, serial and expiry) in a standard format, for example https://id.gs1.org/01/09520123456788/10/ABC1. Phones open a web page, and retail scanners that support 2D codes can read the GTIN at the checkout.",
  },
  {
    q: "What is GS1 Sunrise 2027?",
    a: "Sunrise 2027 (now called Ambition 2027) is the GS1 goal for retail checkouts to read 2D barcodes, such as QR codes with GS1 Digital Link and GS1 DataMatrix, as well as UPC/EAN by the end of 2027. During the transition, packs usually carry both a UPC/EAN and a 2D code.",
  },
];

export const qrCodeContent: ToolContent = {
  answer: (
    <>
      Make a print-ready QR code for your packaging: website, Wi-Fi, contact or GS1 Digital Link,
      with a size check for the scan distance, a contrast check, and SVG or exact-size PDF
      downloads.
    </>
  ),
  ogLine: `3 cm QR code: version ${def.version}, ${n(def.moduleMm, 2)} mm modules`,
  keyTakeaway: (
    <p>
      A QR code on packaging should be at least one tenth of the scanning distance and never under{" "}
      {n(sizing.minSizeMm / 10, 0)} cm wide, with a blank quiet zone of {quietZone.modules} modules
      on every side. Module size = printed width ÷ (modules + {2 * quietZone.modules}); GS1 asks for
      at least {mod.minMm} mm. Print dark on light, keep the link short, and use error correction H
      if you add a logo. Pack Legacy prints it on your boxes at the size you choose.
    </p>
  ),
  methodology: (
    <ol>
      <li>
        <strong>Payload.</strong> The text in the code is built in the standard format for its type:
        URL (with optional UTM tags), mailto:, tel:, SMSTO:, WIFI:, vCard 3.0, or a GS1 Digital Link
        URI with the GTIN padded to 14 digits.
      </li>
      <li>
        <strong>Encoding.</strong> The open-source node-qrcode library picks the smallest QR version
        for the data and error correction level.
      </li>
      <li>
        <strong>Quiet zone.</strong> {quietZone.modules} modules on every side (ISO/IEC 18004). You
        can make it larger, never smaller.
      </li>
      <li>
        <strong>Print size.</strong> Smallest size = max({n(sizing.minSizeMm / 10, 0)} cm, scan
        distance ÷ {sizing.distanceRatio}); module size = size ÷ (modules + 2 × quiet zone).
      </li>
      <li>
        <strong>Contrast.</strong> Background minus code reflectance; light-on-dark codes are
        blocked because many phone scanners cannot read them.
      </li>
      <li>
        <strong>Scan check.</strong> Before download the finished code (logo included) is decoded in
        your browser and compared with the data.
      </li>
    </ol>
  ),
  workedExamples: (
    <>
      <Example title="A 3 cm code for https://packlegacy.com/" raw={PL} />
      <Example
        title="GS1 Digital Link with batch and expiry"
        raw={{
          type: "gs1",
          domain: "https://id.gs1.org",
          gtin: "09520123456788",
          lot: "ABC1",
          expiry: "271231",
          sizeCm: 2.5,
        }}
      />
    </>
  ),
  referenceTables: (
    <>
      <h3>QR code size by scanning distance</h3>
      <CompareTable
        caption={`Smallest size by the 10:1 rule; module size for a short URL (version ${def.version}, ${def.modules} x ${def.modules} modules)`}
        columns={[
          { key: "d", label: "Scan distance" },
          { key: "size", label: "Smallest size" },
          { key: "mod", label: "Module size" },
        ]}
        rows={DISTANCES.map((d) => {
          const v = val({
            ...PL,
            distanceCm: d,
            sizeCm: Math.max(sizing.minSizeMm / 10, d / sizing.distanceRatio),
          });
          return {
            d: `${d} cm`,
            size: `${n(v.minSizeMm / 10, 1)} cm (${n(v.minSizeMm / 25.4, 2)} in)`,
            mod: `${n(v.moduleMm, 2)} mm`,
          };
        })}
      />
      <h3>Error correction levels</h3>
      <CompareTable
        caption="Same short URL at 3 cm"
        columns={[
          { key: "lvl", label: "Level" },
          { key: "rec", label: "Recovers up to" },
          { key: "size", label: "Modules" },
          { key: "mod", label: "Module size" },
        ]}
        rows={(["L", "M", "Q", "H"] as const).map((ec) => {
          const v = val({ ...PL, ec });
          return {
            lvl: ec,
            rec: RECOVERY[ec],
            size: `${v.modules} x ${v.modules}`,
            mod: `${n(v.moduleMm, 2)} mm`,
          };
        })}
        highlightRow={1}
      />
    </>
  ),
  commonMistakes: (
    <ul>
      <li>
        <strong>Printing it too small.</strong> Under {n(sizing.minSizeMm / 10, 0)} cm, or with
        modules under {mod.minMm} mm, many phones struggle.
      </li>
      <li>
        <strong>Cropping the quiet zone.</strong> The blank border is part of the code.
      </li>
      <li>
        <strong>Light code on a dark background.</strong> Many scanners cannot read inverted codes.
      </li>
      <li>
        <strong>Placing it on a fold, seam or tight curve.</strong> Keep it on a flat panel; on a
        curved bottle, keep it small relative to the diameter.
      </li>
      <li>
        <strong>Linking to a page that will move.</strong> Use a URL on your own domain that you can
        keep live as long as the packs are in circulation.
      </li>
      <li>
        <strong>Sending a JPG to the printer.</strong> Use the SVG or PDF for sharp edges.
      </li>
    </ul>
  ),
  faq,
  extraSources: [
    {
      source: "GS1 US: What is GS1 Sunrise 2027?",
      sourceUrl: "https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027",
    },
    { source: "node-qrcode", sourceUrl: "https://github.com/soldair/node-qrcode" },
  ],
};
