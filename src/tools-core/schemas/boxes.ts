// Shape of box-sizes.json and flutes.json, validated at load.
import { z } from "zod";
import boxSizesJson from "../rules/box-sizes.json";
import flutesJson from "../rules/flutes.json";

const meta = {
  source: z.string().min(1),
  sourceUrl: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verifiedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
};
const dims3 = z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]);

export const BOX_FAMILIES = ["mailer", "rsc", "usps-flat-rate", "pl-product"] as const;
export type BoxFamily = (typeof BOX_FAMILIES)[number];

export const boxSchema = z.object({
  id: z.string(),
  family: z.enum(BOX_FAMILIES),
  label: z.string(),
  insideIn: dims3,
  /** Published outside size (USPS); otherwise computed from board caliper. */
  outsideIn: dims3.optional(),
  plProductUrl: z.string().optional(),
  ...meta,
});
export type Box = z.infer<typeof boxSchema>;

export const boxSizesFileSchema = z.object({
  version: z.string(),
  boxes: z.record(z.string(), boxSchema),
  settings: z.object({
    clearancePresetsIn: z.object({
      snug: z.number(),
      standard: z.number(),
      protective: z.number(),
    }),
    exactFitStepIn: z.number().positive(),
    caliperLayers: z.object({ sides: z.number(), rscHeight: z.number() }),
    topResults: z.number().int().positive(),
    ...meta,
  }),
});
export type BoxSizesFile = z.infer<typeof boxSizesFileSchema>;

export const FLUTE_IDS = ["e", "b", "c", "bc"] as const;
export type FluteId = (typeof FLUTE_IDS)[number];

export const flutesFileSchema = z.object({
  version: z.string(),
  flutes: z.object(
    Object.fromEntries(
      FLUTE_IDS.map((id) => [
        id,
        z.object({ id: z.string(), name: z.string(), caliperIn: z.number().positive(), ...meta }),
      ]),
    ) as Record<
      FluteId,
      z.ZodObject<{ id: z.ZodString; name: z.ZodString; caliperIn: z.ZodNumber } & typeof meta>
    >,
  ),
});
export type FlutesFile = z.infer<typeof flutesFileSchema>;

export const boxRules: BoxSizesFile = boxSizesFileSchema.parse(boxSizesJson);
export const fluteRules: FlutesFile = flutesFileSchema.parse(flutesJson);
