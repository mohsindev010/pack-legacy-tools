// Input schema for tool 5 (barcode generator). Same schema for widget, API and tests.
import { z } from "zod";
import { barcodeRules, SYMBOLOGY_IDS, type SymbologyId } from "./codes";
import { gs1CheckDigit, upcaBodyToUpce } from "../lib/gs1";
import { parseHex } from "../lib/color";

const flag = z.preprocess((v) => (v === "0" || v === "false" ? false : v), z.coerce.boolean());
const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional(),
);
const hex = z
  .string()
  .trim()
  .refine((s) => parseHex(s) !== null, "Use a hex colour such as #000000");

/** GTIN-style digit fields: [length without check digit, with check digit]. */
const DIGIT_LENGTHS: Partial<Record<SymbologyId, [number, number]>> = {
  upca: [11, 12],
  ean13: [12, 13],
  ean8: [7, 8],
  itf14: [13, 14],
};
const LABEL = (id: SymbologyId) => barcodeRules.symbologies[id].label;
/** "(01)09501101530008(17)251231": one or more (AI)value pairs. */
export const GS1_ELEMENT_STRING = /^(\(\d{2,4}\)[^()]+)+$/;
const CODE39 = /^[0-9A-Z \-.$/+%]+$/;

export const barcodeInputSchema = z
  .object({
    symbology: z.enum(SYMBOLOGY_IDS).default("upca"),
    data: z.string().trim().min(1, "Enter the data to encode").max(120, "120 characters at most"),
    /** EAN/UPC only: % of the nominal size. */
    magnification: z.coerce.number().default(100),
    /** Non-EAN symbologies: X-dimension in mm (empty = the symbology default). */
    xMm: optionalNumber,
    /** Bar height as % of nominal (EAN/UPC) or of the minimum height (others). */
    barHeightPct: z.coerce.number().min(25, "At least 25%").max(400, "At most 400%").default(100),
    hri: flag.default(true),
    bearer: flag.default(true),
    fg: hex.default("#000000"),
    bg: hex.default("#FFFFFF"),
  })
  .superRefine((v, ctx) => {
    const spec = barcodeRules.symbologies[v.symbology];
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    // 1. Data rules per symbology.
    const lens = DIGIT_LENGTHS[v.symbology];
    if (lens) {
      if (!/^\d+$/.test(v.data) || !lens.includes(v.data.length)) {
        issue("data", `${LABEL(v.symbology)} takes ${lens[0]} or ${lens[1]} digits`);
      } else if (v.data.length === lens[1]) {
        const expected = gs1CheckDigit(v.data.slice(0, -1));
        if (expected !== Number(v.data.at(-1)))
          issue("data", `Wrong check digit: expected ${expected}`);
      }
    } else if (v.symbology === "upce") {
      if (!/^\d+$/.test(v.data) || ![7, 8, 11, 12].includes(v.data.length)) {
        issue(
          "data",
          "UPC-E takes 7 or 8 digits, or a 11-12 digit UPC-A that can be zero-suppressed",
        );
      } else {
        const len = v.data.length;
        const body =
          len === 7 || len === 8
            ? v.data.slice(0, 7)
            : upcaBodyToUpce(v.data.slice(0, 11))
              ? v.data.slice(0, 11)
              : null;
        if (body === null) issue("data", "This UPC-A number cannot be zero-suppressed to UPC-E");
        else if (len === 7 || len === 8) {
          if (!/^[01]/.test(body)) issue("data", "UPC-E must start with number system 0 or 1");
        }
      }
    } else if (v.symbology === "gs1-128" || v.symbology === "gs1datamatrix") {
      if (!GS1_ELEMENT_STRING.test(v.data))
        issue(
          "data",
          "Use GS1 element strings with AIs in brackets, e.g. (01)09501101530003(17)271231",
        );
      const gtin = /\(01\)([^()]*)/.exec(v.data)?.[1];
      if (gtin !== undefined) {
        if (!/^\d{14}$/.test(gtin)) issue("data", "(01) GTIN must be 14 digits");
        else if (gs1CheckDigit(gtin.slice(0, 13)) !== Number(gtin[13]))
          issue(
            "data",
            `Wrong GTIN check digit in (01): expected ${gs1CheckDigit(gtin.slice(0, 13))}`,
          );
      }
    } else if (v.symbology === "code39") {
      if (!CODE39.test(v.data))
        issue("data", "Code 39 takes uppercase A-Z, digits, space and - . $ / + %");
    } else if (v.symbology === "code128") {
      if (!/^[\x20-\x7e]+$/.test(v.data))
        issue("data", "Code 128 takes printable ASCII characters");
    }

    // 2. Size limits.
    if (spec.kind === "ean") {
      const { min, max } = spec.magnification;
      if (v.magnification < min) issue("magnification", `Below the ${min}% minimum`);
      if (v.magnification > max) issue("magnification", `Above the ${max}% maximum`);
    } else if (v.xMm !== undefined) {
      if (v.xMm < spec.x.minMm)
        issue("xMm", `Below the ${spec.x.minMm} mm minimum for ${spec.label}`);
      if (v.xMm > spec.x.maxMm)
        issue("xMm", `Above the ${spec.x.maxMm} mm maximum for ${spec.label}`);
    }
  });

export type BarcodeInput = z.output<typeof barcodeInputSchema>;

export function barcodeFromQuery(q: Record<string, string>): Record<string, unknown> {
  return {
    symbology: q.s || undefined,
    data: q.d,
    magnification: q.m || undefined,
    xMm: q.x,
    barHeightPct: q.bh || undefined,
    hri: q.t || undefined,
    bearer: q.bb || undefined,
    fg: q.fg ? `#${q.fg.replace(/^#/, "")}` : undefined,
    bg: q.bg ? `#${q.bg.replace(/^#/, "")}` : undefined,
  };
}

export function barcodeToQuery(i: BarcodeInput): Record<string, string> {
  const q: Record<string, string> = { s: i.symbology, d: i.data };
  if (i.magnification !== 100) q.m = String(i.magnification);
  if (i.xMm !== undefined) q.x = String(i.xMm);
  if (i.barHeightPct !== 100) q.bh = String(i.barHeightPct);
  if (!i.hri) q.t = "0";
  if (!i.bearer) q.bb = "0";
  if (i.fg.toUpperCase() !== "#000000") q.fg = i.fg.replace(/^#/, "");
  if (i.bg.toUpperCase() !== "#FFFFFF") q.bg = i.bg.replace(/^#/, "");
  return q;
}
