// Shape of qr-specs.json and barcode-specs.json, validated at load.
import { z } from "zod";
import qrJson from "../rules/qr-specs.json";
import barcodeJson from "../rules/barcode-specs.json";

const meta = {
  source: z.string().min(1),
  sourceUrl: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verifiedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
};

export const qrSpecsFileSchema = z.object({
  version: z.string(),
  quietZone: z.object({ modules: z.number().int().positive(), ...meta }),
  sizing: z.object({
    minSizeMm: z.number().positive(),
    distanceRatio: z.number().positive(),
    ...meta,
  }),
  module: z.object({ minMm: z.number().positive(), targetMm: z.number().positive(), ...meta }),
  contrast: z.object({ warnBelow: z.number().min(0).max(1), ...meta }),
  logo: z.object({ maxWidthShare: z.number().positive().max(0.3), level: z.literal("H"), ...meta }),
  gs1DigitalLink: z.object({
    pathAis: z.array(z.string()),
    queryAis: z.array(z.string()),
    ...meta,
  }),
});
export type QrSpecsFile = z.infer<typeof qrSpecsFileSchema>;

export const SYMBOLOGY_IDS = [
  "upca",
  "upce",
  "ean13",
  "ean8",
  "itf14",
  "gs1-128",
  "code128",
  "code39",
  "gs1datamatrix",
] as const;
export type SymbologyId = (typeof SYMBOLOGY_IDS)[number];

const base = {
  id: z.string(),
  label: z.string(),
  bwip: z.string(),
  use: z.string(),
  quietZoneX: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  ...meta,
};
const xRange = z
  .object({ minMm: z.number().positive(), defaultMm: z.number().positive(), maxMm: z.number() })
  .refine((x) => x.minMm <= x.defaultMm && x.defaultMm <= x.maxMm, "min <= default <= max");

const symbologySchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("ean"),
    xNominalMm: z.number().positive(),
    magnification: z.object({ min: z.number().positive(), max: z.number().positive() }),
    barHeightMm: z.number().positive(),
    symbolHeightMm: z.number().positive(),
    guardExtensionX: z.number().nonnegative(),
  }),
  z.object({
    ...base,
    kind: z.literal("linear"),
    x: xRange,
    minBarHeightMm: z.number().positive(),
    defaultBarHeightMm: z.number().positive().optional(),
    maxWidthMm: z.number().positive().optional(),
    wideRatio: z.number().positive().optional(),
    bearerBarMm: z.number().positive().optional(),
  }),
  z.object({ ...base, kind: z.literal("matrix"), x: xRange }),
]);
export type Symbology = z.infer<typeof symbologySchema>;

export const barcodeSpecsFileSchema = z.object({
  version: z.string(),
  contrast: z.object({ warnBelow: z.number().min(0).max(1), ...meta }),
  symbologies: z.object(
    Object.fromEntries(SYMBOLOGY_IDS.map((id) => [id, symbologySchema])) as Record<
      SymbologyId,
      typeof symbologySchema
    >,
  ),
});
export type BarcodeSpecsFile = z.infer<typeof barcodeSpecsFileSchema>;

export const qrRules: QrSpecsFile = qrSpecsFileSchema.parse(qrJson);
export const barcodeRules: BarcodeSpecsFile = barcodeSpecsFileSchema.parse(barcodeJson);

export type EanSymbology = Extract<Symbology, { kind: "ean" }>;
export type LinearSymbology = Extract<Symbology, { kind: "linear" }>;
/** Narrow a symbology spec to EAN/UPC (throws if the rules file changed shape). */
export function asEan(s: Symbology): EanSymbology {
  if (s.kind !== "ean") throw new Error(`${s.id} is not EAN/UPC`);
  return s;
}
/** Narrow a symbology spec to a sized linear barcode. */
export function asLinear(s: Symbology): LinearSymbology {
  if (s.kind !== "linear") throw new Error(`${s.id} is not a linear symbology`);
  return s;
}
