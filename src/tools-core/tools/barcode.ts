// Tool 5: Barcode Generator. Spec: specs/barcode-generator.md.
// bwip-js encodes the data (bar pattern only); this engine lays the symbol out in
// millimetres so 1 module = X mm exactly, with quiet zones and heights from
// barcode-specs.json. Pure: same input, same drawing.

import bwipjs from "bwip-js/browser";
import type { ExplainStep, Flag, RuleCitation, ToolResult } from "../lib/result";
import { cite, flag, okResult } from "../lib/result";
import { roundDisplay } from "../lib/round";
import { gs1CheckDigit, upcaBodyToUpce, upceToUpcaBody } from "../lib/gs1";
import { parseHex, redReflectance, symbolContrast } from "../lib/color";
import type { Drawing, Rect, Text } from "../lib/drawing";
import { barcodeRules, type BarcodeSpecsFile, type SymbologyId } from "../schemas/codes";
import type { BarcodeInput } from "../schemas/barcode";

export type BarcodeValue = {
  symbology: SymbologyId;
  label: string;
  /** Data as encoded, check digit included. */
  encoded: string;
  /** Human-readable line under the bars. */
  hriText: string;
  checkDigitAdded: boolean;
  xMm: number;
  magnification: number | null;
  modules: number;
  quietZoneX: [number, number];
  barHeightMm: number;
  widthMm: number;
  heightMm: number;
  contrast: number;
  drawing: Drawing;
};

export type BarcodeRules = BarcodeSpecsFile;
export const DEFAULT_BARCODE_RULES: BarcodeRules = barcodeRules;

const n = (x: number, dp = 3) => roundDisplay(x, dp);

type RawLinear = { sbs: number[]; bbs: number[] };
type RawMatrix = { pixs: number[]; pixx: number; pixy: number };

/** Normalise the data: add a missing check digit, convert UPC-A to UPC-E. */
function normalise(input: BarcodeInput): { encoded: string; added: boolean; note?: string } {
  const d = input.data;
  const add = (body: string) => body + gs1CheckDigit(body);
  switch (input.symbology) {
    case "upca":
      return d.length === 11 ? { encoded: add(d), added: true } : { encoded: d, added: false };
    case "ean13":
      return d.length === 12 ? { encoded: add(d), added: true } : { encoded: d, added: false };
    case "ean8":
      return d.length === 7 ? { encoded: add(d), added: true } : { encoded: d, added: false };
    case "itf14":
      return d.length === 13 ? { encoded: add(d), added: true } : { encoded: d, added: false };
    case "upce": {
      if (d.length === 11 || d.length === 12) {
        const e = upcaBodyToUpce(d.slice(0, 11))!;
        const c = gs1CheckDigit(d.slice(0, 11));
        return {
          encoded: e + c,
          added: d.length === 11,
          note: `UPC-A ${d.slice(0, 11)}${c} zero-suppressed to UPC-E ${e}${c}`,
        };
      }
      const c = gs1CheckDigit(upceToUpcaBody(d.slice(0, 7))!);
      return { encoded: d.slice(0, 7) + c, added: d.length === 7 };
    }
    default:
      return { encoded: d, added: false };
  }
}

/** Centre of each human-readable digit for EAN/UPC, in modules from the first bar. */
function eanDigitLayout(id: SymbologyId, digits: string) {
  const cells = (start: number, count: number, from: number) =>
    Array.from({ length: count }, (_, i) => ({ ch: digits[from + i]!, at: start + 7 * i + 3.5 }));
  switch (id) {
    case "ean13":
      return { inside: [...cells(3, 6, 1), ...cells(50, 6, 7)], left: digits[0], right: undefined };
    case "ean8":
      return { inside: [...cells(3, 4, 0), ...cells(36, 4, 4)], left: undefined, right: undefined };
    case "upca":
      return {
        inside: [...cells(10, 5, 1), ...cells(50, 5, 6)],
        left: digits[0],
        right: digits[11],
      };
    case "upce":
      return { inside: cells(3, 6, 1), left: digits[0], right: digits[7] };
    default:
      return { inside: [], left: undefined, right: undefined };
  }
}

export function generateBarcode(
  input: BarcodeInput,
  rules: BarcodeRules = DEFAULT_BARCODE_RULES,
): ToolResult<BarcodeValue | null> {
  const spec = rules.symbologies[input.symbology];
  const explain: ExplainStep[] = [];
  const flags: Flag[] = [];
  const citations: RuleCitation[] = [cite(`barcode-specs.${spec.id}`, spec)];

  // 1-2. Data and check digit.
  const norm = normalise(input);
  if (norm.note) explain.push({ text: norm.note });
  if (norm.added) {
    explain.push({
      text: `Check digit calculated: ${norm.encoded.at(-1)} (GS1 mod 10: weights 3,1,3,1... from the right; check = (10 - sum mod 10) mod 10)`,
      formula: "check = (10 - (Σ digit x weight) mod 10) mod 10",
    });
    flags.push(flag("info", "CHECK_DIGIT_ADDED", `Check digit ${norm.encoded.at(-1)} was added.`));
  }

  // Encode with bwip-js (pattern only; layout is ours).
  let raw: RawLinear | RawMatrix;
  try {
    const opts: Record<string, unknown> = { includetext: false };
    if (spec.kind === "linear" && spec.wideRatio) opts.ratio = spec.wideRatio;
    if (spec.id === "itf14") opts.showborder = false;
    raw = (bwipjs.raw(spec.bwip, norm.encoded, opts) as unknown as (RawLinear | RawMatrix)[])[0]!;
  } catch (e) {
    const msg = e instanceof Error ? e.message.replace(/^bwipp\.\w+#\d+:\s*/, "") : String(e);
    flags.push(flag("error", "ENCODE_FAILED", `${spec.label} cannot encode this data: ${msg}`));
    return okResult(null, explain, flags, citations);
  }

  // 3. X-dimension.
  const magnification = spec.kind === "ean" ? input.magnification : null;
  const X =
    spec.kind === "ean"
      ? spec.xNominalMm * (input.magnification / 100)
      : (input.xMm ?? spec.x.defaultMm);
  explain.push(
    spec.kind === "ean"
      ? {
          text: `X-dimension = ${n(spec.xNominalMm)} mm x ${n(input.magnification, 1)}% = ${n(X)} mm`,
          formula: "X = nominal X x magnification",
          ruleRef: `barcode-specs.${spec.id}.xNominalMm`,
        }
      : {
          text: `X-dimension ${n(X)} mm (${spec.label} range ${n(spec.x.minMm)}–${n(spec.x.maxMm)} mm)`,
          ruleRef: `barcode-specs.${spec.id}.x`,
        },
  );

  const fg = input.fg.toUpperCase();
  const bg = input.bg.toUpperCase();
  const rects: Rect[] = [];
  const texts: Text[] = [];
  const [qzL, qzR] = spec.quietZoneX;
  let modules: number;
  let barH: number;
  let widthMm: number;
  let heightMm: number;
  let hriText = "";

  if (spec.kind === "matrix") {
    const m = raw as RawMatrix;
    modules = m.pixx;
    const off = qzL * X;
    for (let y = 0; y < m.pixy; y++) {
      let run = -1;
      for (let x = 0; x <= m.pixx; x++) {
        const on = x < m.pixx && m.pixs[y * m.pixx + x] === 1;
        if (on && run < 0) run = x;
        if (!on && run >= 0) {
          rects.push({ x: off + run * X, y: off + y * X, w: (x - run) * X, h: X });
          run = -1;
        }
      }
    }
    barH = m.pixy * X;
    widthMm = (m.pixx + qzL + qzR) * X;
    heightMm = (m.pixy + qzL + qzR) * X;
    if (input.hri) {
      hriText = norm.encoded;
      const size = Math.max(2.5, 0.12 * widthMm);
      heightMm += size * 1.3;
      texts.push({
        x: widthMm / 2,
        y: heightMm - size * 0.3,
        size,
        text: hriText,
        anchor: "middle",
      });
    }
    explain.push({
      text: `${m.pixx} x ${m.pixy} modules x ${n(X)} mm + ${qzL}X quiet zone each side = ${n((m.pixx + 2 * qzL) * X, 2)} mm square`,
      ruleRef: `barcode-specs.${spec.id}.quietZoneX`,
    });
  } else {
    const l = raw as RawLinear;
    modules = l.sbs.reduce((a, b) => a + b, 0);
    const left = qzL * X;
    if (spec.kind === "ean") {
      const mag = input.magnification / 100;
      barH = spec.barHeightMm * mag * (input.barHeightPct / 100);
      const guardH = barH + spec.guardExtensionX * X;
      const hriZone = (spec.symbolHeightMm - spec.barHeightMm) * mag;
      heightMm = input.hri ? barH + hriZone : guardH;
      let pos = 0;
      l.sbs.forEach((w, i) => {
        if (i % 2 === 0) {
          const guard = (l.bbs[i] ?? 0) < 0;
          rects.push({ x: left + pos * X, y: 0, w: w * X, h: guard ? guardH : barH });
        }
        pos += w;
      });
      if (input.hri) {
        const lay = eanDigitLayout(spec.id as SymbologyId, norm.encoded);
        const size = 9 * X;
        const base = heightMm - 0.6 * X;
        for (const d of lay.inside)
          texts.push({ x: left + d.at * X, y: base, size, text: d.ch, anchor: "middle" });
        if (lay.left)
          texts.push({ x: left - 1.5 * X, y: base, size: 7 * X, text: lay.left, anchor: "end" });
        if (lay.right)
          texts.push({
            x: left + (modules + 1.5) * X,
            y: base,
            size: 7 * X,
            text: lay.right,
            anchor: "start",
          });
        hriText = norm.encoded;
      }
      widthMm = (qzL + modules + qzR) * X;
      explain.push({
        text: `Width = (${qzL} + ${modules} + ${qzR}) modules x ${n(X)} mm = ${n(widthMm, 2)} mm; height ${n(heightMm, 2)} mm (bars ${n(barH, 2)} mm)`,
        formula: "width = (left quiet zone + modules + right quiet zone) x X",
        ruleRef: `barcode-specs.${spec.id}.quietZoneX`,
      });
      if (input.barHeightPct < 100)
        flags.push(
          flag(
            "warn",
            "TRUNCATED",
            `Bars cut to ${n(input.barHeightPct, 0)}% of nominal height. GS1 advises against truncation; short bars are harder to scan at an angle.`,
          ),
        );
    } else {
      const nominal = spec.defaultBarHeightMm ?? spec.minBarHeightMm;
      barH = nominal * (input.barHeightPct / 100);
      const bearer = spec.bearerBarMm && input.bearer ? spec.bearerBarMm : 0;
      let pos = 0;
      const top = bearer;
      l.sbs.forEach((w, i) => {
        if (i % 2 === 0) rects.push({ x: left + pos * X, y: top, w: w * X, h: barH });
        pos += w;
      });
      widthMm = (qzL + modules + qzR) * X;
      heightMm = barH + 2 * bearer;
      if (bearer) {
        // Bearer bars: a frame around bars and quiet zones (ITF-14).
        const fullW = widthMm + 2 * bearer;
        rects.forEach((r) => (r.x += bearer));
        rects.push(
          { x: 0, y: 0, w: fullW, h: bearer },
          { x: 0, y: barH + bearer, w: fullW, h: bearer },
        );
        rects.push(
          { x: 0, y: bearer, w: bearer, h: barH },
          { x: fullW - bearer, y: bearer, w: bearer, h: barH },
        );
        widthMm = fullW;
        explain.push({
          text: `Bearer bars ${n(bearer, 1)} mm frame the symbol so a skewed scan cannot read a partial code`,
          ruleRef: `barcode-specs.${spec.id}.bearerBarMm`,
        });
      }
      if (input.hri) {
        hriText =
          spec.id === "code39"
            ? `*${norm.encoded}*`
            : spec.id === "itf14"
              ? norm.encoded
              : norm.encoded;
        const size = Math.max(3.5, 8 * X);
        heightMm += size * 1.25;
        texts.push({
          x: widthMm / 2,
          y: heightMm - size * 0.25,
          size,
          text: hriText,
          anchor: "middle",
        });
      }
      explain.push({
        text: `Width = (${qzL} + ${n(modules, 2)} + ${qzR}) modules x ${n(X)} mm${bearer ? " + bearer bars" : ""} = ${n(widthMm, 2)} mm; bar height ${n(barH, 2)} mm`,
        formula: "width = (left quiet zone + modules + right quiet zone) x X",
        ruleRef: `barcode-specs.${spec.id}.quietZoneX`,
      });
      if (barH < spec.minBarHeightMm - 1e-9)
        flags.push(
          flag(
            "warn",
            "TRUNCATED",
            `Bar height ${n(barH, 1)} mm is below the ${n(spec.minBarHeightMm, 2)} mm minimum for ${spec.label}.`,
          ),
        );
      if (spec.maxWidthMm && widthMm > spec.maxWidthMm)
        flags.push(
          flag(
            "warn",
            "TOO_WIDE",
            `${spec.label} is ${n(widthMm, 1)} mm wide; the maximum is ${spec.maxWidthMm} mm. Use a smaller X or less data.`,
          ),
        );
    }
  }

  // Colour and contrast: linear scanners use red light; 2D imagers see white light.
  const f = parseHex(fg)!;
  const b = parseHex(bg)!;
  const light = spec.kind === "matrix" ? "white" : "red";
  const contrast = symbolContrast(f, b, light);
  citations.push(cite("barcode-specs.contrast", rules.contrast));
  if (contrast <= 0) {
    flags.push(
      flag(
        "error",
        "INVERTED",
        "Bars must be darker than the background. Light-on-dark codes do not scan reliably.",
      ),
    );
  } else if (contrast < rules.contrast.warnBelow) {
    const redBars = spec.kind !== "matrix" && redReflectance(f) > 0.4;
    flags.push(
      flag(
        "warn",
        redBars ? "RED_BARS" : "LOW_CONTRAST",
        redBars
          ? "Red, orange or yellow bars look like white to a red-light scanner. Use black, dark blue or dark green bars."
          : `Contrast is about ${n(contrast * 100, 0)}% as a scanner sees it (aim for ${n(rules.contrast.warnBelow * 100, 0)}% or more). Use darker bars or a lighter background.`,
      ),
    );
  }
  explain.push({
    text: `Symbol contrast ≈ ${n(contrast * 100, 0)}% under ${light === "red" ? "red scanner light" : "white light"} (background minus bar reflectance)`,
    ruleRef: "barcode-specs.contrast",
  });

  if (["upca", "upce", "ean13", "ean8", "itf14", "gs1-128", "gs1datamatrix"].includes(spec.id)) {
    flags.push(
      flag(
        "info",
        "GS1_LICENCE",
        "A generator draws the code; retail GTINs must be licensed from GS1 (gs1us.org in the US).",
      ),
    );
  }

  return okResult(
    {
      symbology: spec.id as SymbologyId,
      label: spec.label,
      encoded: norm.encoded,
      hriText,
      checkDigitAdded: norm.added,
      xMm: X,
      magnification,
      modules,
      quietZoneX: [qzL, qzR],
      barHeightMm: barH,
      widthMm,
      heightMm,
      contrast,
      drawing: { widthMm, heightMm, fg, bg, rects, texts },
    },
    explain,
    flags,
    citations,
  );
}
