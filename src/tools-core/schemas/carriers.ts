// Shape of carriers.json and usps-cubic.json. Parsed once at load, so a bad
// rules edit fails loudly (and in CI) instead of silently changing results.
import { z } from "zod";
import carriersJson from "../rules/carriers.json";
import uspsCubicJson from "../rules/usps-cubic.json";

const meta = {
  source: z.string().min(1),
  sourceUrl: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verifiedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
};

const additionalHandling = z.object({
  label: z.string(),
  longestGt: z.number(),
  secondGt: z.number(),
  lengthGirthGt: z.number(),
  weightGtLb: z.number(),
  volumeGtIn3: z.number(),
  suppressedByLargePackage: z.boolean(),
});
const largePackage = z.object({
  label: z.string(),
  longestGt: z.number(),
  lengthGirthGt: z.number(),
  volumeGtIn3: z.number(),
  weightGtLb: z.number(),
  minBillableLb: z.number(),
});
const overMax = z.object({
  longestGt: z.number(),
  lengthGirthGt: z.number(),
  weightGtLb: z.number(),
});

export const CARRIER_IDS = ["ups", "fedex", "usps", "dhl"] as const;
export type CarrierId = (typeof CARRIER_IDS)[number];

export const carrierRuleSchema = z.object({
  id: z.enum(CARRIER_IDS),
  name: z.string(),
  dimDivisorIn: z.number().positive().optional(),
  /** Metric divisor (cm³ per kg); used for cm/kg input when present. */
  dimDivisorCm: z.number().positive().nullable().optional(),
  metricNote: z.string().optional(),
  previousDimDivisorIn: z.number().positive().optional(),
  dimRounding: z.enum(["ceil-each-side-to-whole-unit", "none"]),
  dimRoundingSince: z.string().optional(),
  weightRounding: z.enum(["ceil-lb", "ceil-step"]),
  metricWeightStepKg: z.number().positive().nullable(),
  minBillableLb: z.number().optional(),
  minBillableKg: z.number().optional(),
  dimAppliesAboveIn3: z.number().min(0),
  contractDivisorAllowed: z.boolean(),
  surcharges: z.object({
    additionalHandling: additionalHandling.optional(),
    largePackage: largePackage.optional(),
    overMax: overMax.optional(),
  }),
  limits: z
    .object({
      maxWeightLb: z.number(),
      oversizedLengthGirthGt: z.number(),
      maxLengthGirth: z.number(),
    })
    .optional(),
  /** DHL Express: largest accepted piece (sorted cm) and weight. */
  pieceLimits: z
    .object({
      maxCm: z.tuple([z.number(), z.number(), z.number()]),
      maxKg: z.number(),
      label: z.string(),
      ...meta,
    })
    .optional(),
  /** DHL Express Oversize Piece surcharge trigger (cm). */
  oversizePiece: z
    .object({ longestGtCm: z.number(), secondGtCm: z.number(), label: z.string(), ...meta })
    .optional(),
  nonstandard: z.object({ lengthGtIn: z.array(z.number()), volumeGtIn3: z.number() }).optional(),
  nonrectangular: z
    .object({
      factor: z.number(),
      priorityMail: z.object({
        divisor: z.number(),
        sideRounding: z.enum(["round-nearest", "ceil"]),
      }),
      groundAdvantage: z.object({
        divisor: z.number(),
        sideRounding: z.enum(["round-nearest", "ceil"]),
      }),
    })
    .optional(),
  ...meta,
});
export type CarrierRule = z.infer<typeof carrierRuleSchema>;

export const carriersFileSchema = z.object({
  version: z.string(),
  carriers: z.object({
    ups: carrierRuleSchema,
    fedex: carrierRuleSchema,
    usps: carrierRuleSchema,
    dhl: carrierRuleSchema,
  }),
});
export type CarriersFile = z.infer<typeof carriersFileSchema>;

export const uspsCubicSchema = z.object({
  version: z.string(),
  cubic: z.object({
    measuring: z.object({ truncateEachSideToIn: z.number(), tierStepFt3: z.number() }),
    groundAdvantageCubic: z.object({
      maxFt3: z.number(),
      maxWeightLb: z.number(),
      maxLongestIn: z.number(),
    }),
    priorityMailCubic: z.object({
      maxFt3: z.number(),
      maxWeightLb: z.number(),
      maxLongestIn: z.number(),
    }),
    excludedPackaging: z.array(z.string()),
    softpackTiers: z.array(z.object({ tierFt3: z.number(), maxLengthPlusWidthIn: z.number() })),
    ...meta,
  }),
});
export type UspsCubicFile = z.infer<typeof uspsCubicSchema>;

export const carrierRules: CarriersFile = carriersFileSchema.parse(carriersJson);
export const uspsCubicRules: UspsCubicFile = uspsCubicSchema.parse(uspsCubicJson);
