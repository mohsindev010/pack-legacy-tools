// Shapes of mylar-presets.json, bulk-density.json and o2-absorbers.json, and the
// input schemas for tool 8 (mylar bag size finder) and tool 9 (oxygen absorbers).
import { z } from "zod";
import mylarJson from "../rules/mylar-presets.json";
import densityJson from "../rules/bulk-density.json";
import o2Json from "../rules/o2-absorbers.json";

const meta = {
  source: z.string().min(1),
  sourceUrl: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verifiedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
};
const pos = z.number().positive();

// ---- rules ----

export const BAG_IDS = [
  "quart-zip",
  "quart-open",
  "gallon-zip",
  "gallon-open",
  "2gallon-zip",
  "5gallon-open",
] as const;
export type BagId = (typeof BAG_IDS)[number];

const bagSchema = z.object({
  id: z.enum(BAG_IDS),
  name: z.string(),
  capacityQt: pos,
  widthIn: pos,
  heightIn: pos,
  gussetIn: z.number().min(0),
  ...meta,
});
export type Bag = z.infer<typeof bagSchema>;

export const mylarFileSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  litersPerQuart: pos,
  defaultHeadspacePct: z.number().min(0).max(50),
  bags: z.object(
    Object.fromEntries(BAG_IDS.map((id) => [id, bagSchema])) as Record<BagId, typeof bagSchema>,
  ),
});
export type MylarFile = z.infer<typeof mylarFileSchema>;
export const mylarRules: MylarFile = mylarFileSchema.parse(mylarJson);

export const PRODUCT_IDS = [
  "rice",
  "beans",
  "peas",
  "wheat",
  "corn",
  "oats",
  "flour",
  "sugar",
  "milk-powder",
  "coffee-roasted",
  "coffee-ground",
] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

const densitySchema = z.object({
  id: z.enum(PRODUCT_IDS),
  name: z.string(),
  /** Loose bulk density, kg/m³ (= g/L). */
  kgM3: pos,
  printedAs: z.string(),
  ...meta,
});
export const densityFileSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  entries: z.object(
    Object.fromEntries(PRODUCT_IDS.map((id) => [id, densitySchema])) as Record<
      ProductId,
      typeof densitySchema
    >,
  ),
});
export type DensityFile = z.infer<typeof densityFileSchema>;
export const densityRules: DensityFile = densityFileSchema.parse(densityJson);

export const O2_CONTAINER_IDS = ["can10", "pail5", "pail6"] as const;
export type O2ContainerId = (typeof O2_CONTAINER_IDS)[number];
const o2ContainerSchema = z.object({
  id: z.enum(O2_CONTAINER_IDS),
  name: z.string(),
  volumeCc: pos,
  ...meta,
});
export const o2FileSchema = z.object({
  version: z.string(),
  method: z.object({
    oxygenFraction: z.number().gt(0).lt(1),
    productGramsPerCc: pos,
    formula: z.string(),
    note: z.string(),
    ...meta,
  }),
  containers: z.object({
    can10: o2ContainerSchema,
    pail5: o2ContainerSchema,
    pail6: o2ContainerSchema,
  }),
  packets: z.object({
    sizesCc: z.array(z.number().int().positive()).min(1),
    note: z.string().optional(),
    ...meta,
  }),
});
export type O2File = z.infer<typeof o2FileSchema>;
export const o2Rules: O2File = o2FileSchema.parse(o2Json);

// ---- shared input helpers ----

export const MASS_UNITS = ["lb", "kg", "oz", "g"] as const;
export type MassUnit = (typeof MASS_UNITS)[number];
export const G_PER: Record<MassUnit, number> = {
  lb: 453.59237,
  kg: 1000,
  oz: 28.349523125,
  g: 1,
};

export const VOLUME_UNITS = ["gal", "qt", "L", "cc", "in3"] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];
export const CC_PER: Record<VolumeUnit, number> = {
  gal: 3785.411784,
  qt: 946.352946,
  L: 1000,
  cc: 1,
  in3: 16.387064,
};

const optNum = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number({ error: `${label} must be a number` }).optional(),
  );

// ---- tool 8: mylar bag size finder ----

export const mylarInputSchema = z
  .object({
    weight: z.coerce
      .number({ error: "Fill weight must be a number" })
      .positive("Fill weight must be greater than 0"),
    unit: z.enum(MASS_UNITS).default("lb"),
    /** Product preset, or "custom" with a bulk density in kg/m³ (= g/L). */
    product: z.enum([...PRODUCT_IDS, "custom"]).default("rice"),
    density: optNum("Density").pipe(z.number().min(50).max(2000).optional()),
    headspace: optNum("Headspace").pipe(z.number().min(0).max(50).optional()),
  })
  .superRefine((v, ctx) => {
    if (v.product === "custom" && v.density === undefined)
      ctx.addIssue({ code: "custom", path: ["density"], message: "Enter the bulk density" });
    if (v.weight * G_PER[v.unit] < 1)
      ctx.addIssue({ code: "custom", path: ["weight"], message: "Must be at least 1 g" });
    if (v.weight * G_PER[v.unit] > 200_000)
      ctx.addIssue({
        code: "custom",
        path: ["weight"],
        message: "Must be 200 kg (440 lb) or less",
      });
  });
export type MylarInput = z.output<typeof mylarInputSchema>;

export function mylarFromQuery(q: Record<string, string>): Record<string, unknown> {
  return {
    weight: q.wt,
    unit: q.u || undefined,
    product: q.p || undefined,
    density: q.d,
    headspace: q.hs,
  };
}
export function mylarToQuery(i: MylarInput): Record<string, string> {
  const q: Record<string, string> = { wt: String(i.weight), u: i.unit, p: i.product };
  if (i.density !== undefined) q.d = String(i.density);
  if (i.headspace !== undefined) q.hs = String(i.headspace);
  return q;
}

// ---- tool 9: oxygen absorber calculator ----

export const O2_CONTAINERS = [...BAG_IDS, ...O2_CONTAINER_IDS, "custom"] as const;
export type O2Container = (typeof O2_CONTAINERS)[number];

export const o2InputSchema = z
  .object({
    container: z.enum(O2_CONTAINERS).default("gallon-zip"),
    /** Custom container volume. */
    volume: optNum("Volume").pipe(z.number().positive("Volume must be greater than 0").optional()),
    volumeUnit: z.enum(VOLUME_UNITS).default("L"),
    /** Product weight in the container; 0 or empty = empty container (worst case). */
    weight: optNum("Product weight").pipe(
      z.number().min(0, "Weight cannot be negative").optional(),
    ),
    weightUnit: z.enum(MASS_UNITS).default("lb"),
    /** Number of identical containers. */
    count: z.coerce
      .number({ error: "Count must be a number" })
      .int("Count must be a whole number")
      .min(1, "Count must be at least 1")
      .max(10_000, "Count must be 10,000 or less")
      .default(1),
  })
  .superRefine((v, ctx) => {
    if (v.container === "custom" && v.volume === undefined)
      ctx.addIssue({ code: "custom", path: ["volume"], message: "Enter the container volume" });
    if (v.volume !== undefined && v.volume * CC_PER[v.volumeUnit] < 1)
      ctx.addIssue({ code: "custom", path: ["volume"], message: "Must be at least 1 cc" });
    if (v.volume !== undefined && v.volume * CC_PER[v.volumeUnit] > 1_000_000)
      ctx.addIssue({ code: "custom", path: ["volume"], message: "Must be 1,000 L or less" });
  });
export type O2Input = z.output<typeof o2InputSchema>;

export function o2FromQuery(q: Record<string, string>): Record<string, unknown> {
  return {
    container: q.c || undefined,
    volume: q.v,
    volumeUnit: q.vu || undefined,
    weight: q.wt,
    weightUnit: q.wu || undefined,
    count: q.n || undefined,
  };
}
export function o2ToQuery(i: O2Input): Record<string, string> {
  const q: Record<string, string> = { c: i.container };
  if (i.container === "custom" && i.volume !== undefined) {
    q.v = String(i.volume);
    q.vu = i.volumeUnit;
  }
  if (i.weight !== undefined) {
    q.wt = String(i.weight);
    q.wu = i.weightUnit;
  }
  if (i.count !== 1) q.n = String(i.count);
  return q;
}
