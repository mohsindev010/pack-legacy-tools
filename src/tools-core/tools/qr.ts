// Tool 4: QR Code Generator for Packaging. Spec: specs/qr-code-generator.md.
// Builds the payload, encodes it with node-qrcode, and lays the symbol out in mm
// with a 4-module quiet zone. Print-size and contrast rules come from qr-specs.json.

import QRCode from "qrcode";
import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { roundDisplay } from "../lib/round";
import { padGtin14 } from "../lib/gs1";
import { parseHex, symbolContrast } from "../lib/color";
import type { Drawing, Rect } from "../lib/drawing";
import { qrRules, type QrSpecsFile } from "../schemas/codes";
import type { QrInput } from "../schemas/qr";

export type QrValue = {
  payload: string;
  version: number;
  /** Modules per side, quiet zone excluded. */
  modules: number;
  ec: QrInput["ec"];
  quietZone: number;
  sizeMm: number;
  moduleMm: number;
  /** max(minimum size, scan distance / ratio). */
  minSizeMm: number;
  contrast: number;
  /** Cleared centre area for a logo, mm. */
  logoBox: Rect | null;
  drawing: Drawing;
};

export type QrRules = QrSpecsFile;
export const DEFAULT_QR_RULES: QrRules = qrRules;

const n = (x: number, dp = 2) => roundDisplay(x, dp);

/** Backslash-escape the characters MECARD-style Wi-Fi strings reserve. */
const wifiEsc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
/** vCard 3.0 text escaping. */
const vEsc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/([,;])/g, "\\$1")
    .replace(/\n/g, "\\n");

/** The exact string that goes into the QR code. */
export function buildPayload(i: QrInput): string {
  switch (i.type) {
    case "url": {
      const u = new URL(i.url);
      if (i.utmSource) u.searchParams.set("utm_source", i.utmSource);
      if (i.utmMedium) u.searchParams.set("utm_medium", i.utmMedium);
      if (i.utmCampaign) u.searchParams.set("utm_campaign", i.utmCampaign);
      return u.toString();
    }
    case "text":
      return i.text;
    case "email":
      return `mailto:${i.email}${i.subject ? `?subject=${encodeURIComponent(i.subject)}` : ""}`;
    case "phone":
      return `tel:${i.phone.replace(/[^\d+]/g, "")}`;
    case "sms":
      return `SMSTO:${i.phone.replace(/[^\d+]/g, "")}:${i.smsBody}`;
    case "wifi": {
      const parts = [`T:${i.security}`, `S:${wifiEsc(i.ssid)}`];
      if (i.security !== "nopass") parts.push(`P:${wifiEsc(i.password)}`);
      if (i.hidden) parts.push("H:true");
      return `WIFI:${parts.join(";")};;`;
    }
    case "vcard": {
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${vEsc(i.lastName)};${vEsc(i.firstName)};;;`,
        `FN:${vEsc([i.firstName, i.lastName].filter(Boolean).join(" ") || i.org)}`,
      ];
      if (i.org) lines.push(`ORG:${vEsc(i.org)}`);
      if (i.title) lines.push(`TITLE:${vEsc(i.title)}`);
      if (i.vPhone) lines.push(`TEL;TYPE=WORK,VOICE:${i.vPhone}`);
      if (i.vEmail) lines.push(`EMAIL;TYPE=INTERNET:${i.vEmail}`);
      if (i.vUrl) lines.push(`URL:${i.vUrl}`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    }
    case "gs1":
      return gs1DigitalLink(i);
  }
}

/** https://domain/01/{GTIN-14}[/10/{lot}][/21/{serial}][?17=YYMMDD] (GS1 Digital Link 1.7, 4.5/4.9/4.10). */
export function gs1DigitalLink(i: Pick<QrInput, "domain" | "gtin" | "lot" | "serial" | "expiry">) {
  const base = i.domain.replace(/\/+$/, "");
  let path = `/01/${padGtin14(i.gtin.replace(/\s/g, ""))}`;
  if (i.lot) path += `/10/${encodeURIComponent(i.lot)}`;
  if (i.serial) path += `/21/${encodeURIComponent(i.serial)}`;
  return `${base}${path}${i.expiry ? `?17=${i.expiry}` : ""}`;
}

export function generateQr(
  input: QrInput,
  rules: QrRules = DEFAULT_QR_RULES,
): ToolResult<QrValue | null> {
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const citations: RuleCitation[] = [
    cite("qr-specs.quietZone", rules.quietZone),
    cite("qr-specs.sizing", rules.sizing),
    cite("qr-specs.module", rules.module),
    cite("qr-specs.contrast", rules.contrast),
  ];

  // 1-2. Payload.
  const payload = buildPayload(input);
  explain.push({
    text: `Encoded text (${payload.length} characters): ${payload.replace(/\r\n/g, " / ")}`,
  });
  if (input.type === "gs1") {
    citations.push(cite("qr-specs.gs1DigitalLink", rules.gs1DigitalLink));
    explain.push({
      text: "GS1 Digital Link: GTIN padded to 14 digits; lot (10) and serial (21) in the path, in that order; expiry (17) in the query string",
      ruleRef: "qr-specs.gs1DigitalLink",
    });
  }

  // 3. Encode. A logo needs level H so the covered modules can be recovered.
  const ec = input.logo ? rules.logo.level : input.ec;
  if (input.logo && input.ec !== ec) {
    flags.push(
      flag(
        "info",
        "LOGO_FORCES_H",
        "A logo covers part of the code, so error correction is set to H (about 30% recovery).",
      ),
    );
  }
  let qr: ReturnType<typeof QRCode.create>;
  try {
    qr = QRCode.create(payload, { errorCorrectionLevel: ec });
  } catch {
    flags.push(
      flag(
        "error",
        "DATA_TOO_LONG",
        `Too much data for a QR code at level ${ec}. Shorten it or lower the error correction.`,
      ),
    );
    return okResult(null, explain, flags, citations);
  }
  const N = qr.modules.size;
  const qz = input.quietZone;
  explain.push({
    text: `QR version ${qr.version} at level ${ec}: ${N} x ${N} modules, plus a ${qz}-module quiet zone on every side = ${N + 2 * qz} modules across`,
    ruleRef: "qr-specs.quietZone",
  });

  // 4-5. Print size and module size.
  const sizeMm = input.sizeCm * 10;
  const moduleMm = sizeMm / (N + 2 * qz);
  const minSizeMm = Math.max(
    rules.sizing.minSizeMm,
    (input.distanceCm * 10) / rules.sizing.distanceRatio,
  );
  explain.push({
    text: `Module size = ${n(sizeMm, 1)} mm ÷ ${N + 2 * qz} = ${n(moduleMm, 3)} mm`,
    formula: "module = printed size ÷ (modules + 2 x quiet zone)",
  });
  explain.push({
    text: `Smallest size for a ${n(input.distanceCm, 0)} cm scan = max(${n(rules.sizing.minSizeMm / 10, 1)} cm, ${n(input.distanceCm, 0)} ÷ ${rules.sizing.distanceRatio}) = ${n(minSizeMm / 10, 2)} cm`,
    formula: "minimum size = max(2 cm, scan distance ÷ 10)",
    ruleRef: "qr-specs.sizing",
  });
  if (sizeMm < minSizeMm - 1e-9) {
    flags.push(
      flag(
        "warn",
        "TOO_SMALL_FOR_DISTANCE",
        `At ${n(input.sizeCm, 1)} cm the code is smaller than the ${n(minSizeMm / 10, 1)} cm needed to scan from ${n(input.distanceCm, 0)} cm.`,
      ),
    );
  }
  if (moduleMm < rules.module.minMm - 1e-9) {
    flags.push(
      flag(
        "warn",
        "MODULE_TOO_SMALL",
        `Each module is ${n(moduleMm, 3)} mm; GS1 sets ${rules.module.minMm} mm as the minimum (target ${rules.module.targetMm} mm). Print larger or encode less data.`,
      ),
    );
  }

  // 6. Contrast under white light (phone cameras).
  const fg = input.fg.toUpperCase();
  const bg = input.bg.toUpperCase();
  const contrast = symbolContrast(parseHex(fg)!, parseHex(bg)!, "white");
  if (contrast <= 0) {
    flags.push(
      flag(
        "error",
        "INVERTED",
        "The code must be darker than its background. Many phone scanners cannot read light-on-dark codes.",
      ),
    );
  } else if (contrast < rules.contrast.warnBelow) {
    flags.push(
      flag(
        "warn",
        "LOW_CONTRAST",
        `Contrast is about ${n(contrast * 100, 0)}% (aim for ${n(rules.contrast.warnBelow * 100, 0)}% or more). Use a darker code or a lighter background.`,
      ),
    );
  }
  explain.push({
    text: `Symbol contrast ≈ ${n(contrast * 100, 0)}% (background minus code reflectance)`,
    ruleRef: "qr-specs.contrast",
  });

  // 7. Logo area: whole modules in the centre, cleared to the background.
  let logoBox: Rect | null = null;
  let k = 0;
  if (input.logo) {
    citations.push(cite("qr-specs.logo", rules.logo));
    k = Math.round(N * rules.logo.maxWidthShare);
    if ((N - k) % 2) k += 1;
    const start = (N - k) / 2;
    logoBox = {
      x: (qz + start) * moduleMm,
      y: (qz + start) * moduleMm,
      w: k * moduleMm,
      h: k * moduleMm,
    };
    explain.push({
      text: `Logo area ${k} x ${k} modules (${n(logoBox.w, 1)} mm) in the centre; the code is checked by decoding it before download`,
      ruleRef: "qr-specs.logo",
    });
  }
  const inLogo = (r: number, c: number) => {
    if (!k) return false;
    const s = (N - k) / 2;
    return r >= s && r < s + k && c >= s && c < s + k;
  };

  // 8. Drawing: one rectangle per horizontal run of dark modules.
  const rects: Rect[] = [];
  for (let r = 0; r < N; r++) {
    let run = -1;
    for (let c = 0; c <= N; c++) {
      const dark = c < N && qr.modules.get(r, c) === 1 && !inLogo(r, c);
      if (dark && run < 0) run = c;
      if (!dark && run >= 0) {
        rects.push({
          x: (qz + run) * moduleMm,
          y: (qz + r) * moduleMm,
          w: (c - run) * moduleMm,
          h: moduleMm,
        });
        run = -1;
      }
    }
  }

  return okResult(
    {
      payload,
      version: qr.version,
      modules: N,
      ec,
      quietZone: qz,
      sizeMm,
      moduleMm,
      minSizeMm,
      contrast,
      logoBox,
      drawing: { widthMm: sizeMm, heightMm: sizeMm, fg, bg, rects, texts: [] },
    },
    explain,
    flags,
    citations,
  );
}
