// Shape of paper-conversion.json, validated at load.
import { z } from "zod";
import conversionJson from "../rules/paper-conversion.json";

const meta = {
  source: z.string().min(1),
  sourceUrl: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verifiedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
};

export const STOCK_IDS = ["text", "uncoated", "c1s", "c2s"] as const;
export type StockId = (typeof STOCK_IDS)[number];
export const LB_BASES = ["text", "cover"] as const;
export type LbBasis = (typeof LB_BASES)[number];

const stockSchema = z.object({
  id: z.enum(STOCK_IDS),
  name: z.string(),
  /** GSM per point of caliper for this stock. */
  gsmPerPt: z.number().positive(),
  formula: z.string(),
  /** Which lb factor this stock is quoted in. */
  lbBasis: z.enum(LB_BASES),
  ...meta,
});
export type Stock = z.infer<typeof stockSchema>;

const lbSchema = z.object({
  id: z.enum(LB_BASES),
  name: z.string(),
  gsmPerLb: z.number().positive(),
  formula: z.string(),
  ...meta,
});

export const paperConversionFileSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  stocks: z.object({
    text: stockSchema,
    uncoated: stockSchema,
    c1s: stockSchema,
    c2s: stockSchema,
  }),
  lb: z.object({ text: lbSchema, cover: lbSchema }),
  mmPerPt: z.number().positive(),
});
export type PaperConversionFile = z.infer<typeof paperConversionFileSchema>;

export const paperRules: PaperConversionFile = paperConversionFileSchema.parse(conversionJson);
