// Shape of pallets.json, plus the input schema for tool 7 (pallet calculator).
import { z } from "zod";
import palletsJson from "../rules/pallets.json";
import { CONTAINER_IDS } from "./containers";

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

export const PALLET_IDS = ["gma-48x40", "48x48", "epal-1", "epal-2", "epal-3"] as const;
export type PalletId = (typeof PALLET_IDS)[number];

const palletSchema = z.object({
  id: z.enum(PALLET_IDS),
  name: z.string(),
  /** Unit of footprint and height ("in" with lb, "mm" with kg). */
  unit: z.enum(["in", "mm"]),
  footprint: z.tuple([pos, pos]),
  height: pos,
  /** Empty pallet weight. */
  weight: pos,
  /** Safe working load (cargo only). */
  maxLoad: pos,
  ...meta,
});
export type Pallet = z.infer<typeof palletSchema>;

export const palletsFileSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  defaults: z.object({
    maxLoadHeightIn: pos,
    maxLoadHeightNote: z.string().optional(),
    overhangIn: z.number().min(0),
  }),
  pallets: z.object({
    "gma-48x40": palletSchema,
    "48x48": palletSchema,
    "epal-1": palletSchema,
    "epal-2": palletSchema,
    "epal-3": palletSchema,
  }),
});
export type PalletsFile = z.infer<typeof palletsFileSchema>;
export const palletRules: PalletsFile = palletsFileSchema.parse(palletsJson);

// ---- Tool 7 input ----

export const PALLET_UNITS = ["in", "cm"] as const;
export type PalletUnit = (typeof PALLET_UNITS)[number];

const positive = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .positive(`${label} must be greater than 0`);
const optNum = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number({ error: `${label} must be a number` }).optional(),
  );
const flag = z.preprocess(
  (v) => (v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : v),
  z.boolean().default(false),
);
const containerList = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : v,
  z.array(z.enum(CONTAINER_IDS)),
);

const MAX_SIDE = { in: 120, cm: 304.8 } as const;
/** Smallest carton side and pallet override we accept (in input units). */
const MIN_SIDE = { in: 0.1, cm: 0.25 } as const;
const MIN_PALLET_SIDE = { in: 6, cm: 15 } as const;

export const palletInputSchema = z
  .object({
    l: positive("Length"),
    w: positive("Width"),
    h: positive("Height"),
    /** Lengths in in with lb, or cm with kg. */
    unit: z.enum(PALLET_UNITS).default("in"),
    /** Gross weight of one carton (optional). */
    weight: optNum("Weight").pipe(z.number().min(0, "Weight cannot be negative").optional()),
    qty: z.coerce
      .number({ error: "Quantity must be a number" })
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1")
      .max(1_000_000, "Quantity must be 1,000,000 or less")
      .default(1),
    upright: flag,
    pallet: z.enum(PALLET_IDS).default("gma-48x40"),
    /** Overrides of the preset, in the input unit (empty = preset value). */
    palletL: optNum("Pallet length").pipe(z.number().positive().optional()),
    palletW: optNum("Pallet width").pipe(z.number().positive().optional()),
    palletH: optNum("Pallet height").pipe(z.number().min(0).optional()),
    palletWeight: optNum("Pallet weight").pipe(z.number().min(0).optional()),
    maxLoad: optNum("Maximum load").pipe(z.number().positive().optional()),
    /** Total height including the pallet. */
    maxHeight: optNum("Maximum height").pipe(z.number().positive().optional()),
    overhang: optNum("Overhang").pipe(z.number().min(0).optional()),
    containers: containerList.default([...CONTAINER_IDS]),
    stack: flag,
  })
  .superRefine((v, ctx) => {
    for (const k of ["l", "w", "h"] as const) {
      if (v[k] > MAX_SIDE[v.unit])
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: `Must be ${MAX_SIDE[v.unit]} ${v.unit} or less`,
        });
      if (v[k] < MIN_SIDE[v.unit])
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: `Must be at least ${MIN_SIDE[v.unit]} ${v.unit}`,
        });
    }
    for (const k of ["palletL", "palletW"] as const) {
      const x = v[k];
      if (x !== undefined && (x < MIN_PALLET_SIDE[v.unit] || x > MAX_SIDE[v.unit]))
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: `Must be ${MIN_PALLET_SIDE[v.unit]} to ${MAX_SIDE[v.unit]} ${v.unit}`,
        });
    }
    if (v.palletH !== undefined && v.palletH > (v.unit === "in" ? 24 : 61))
      ctx.addIssue({
        code: "custom",
        path: ["palletH"],
        message: `Must be ${v.unit === "in" ? "24 in" : "61 cm"} or less`,
      });
    for (const k of ["palletWeight", "maxLoad"] as const) {
      const lim =
        k === "palletWeight" ? (v.unit === "in" ? 1000 : 450) : v.unit === "in" ? 20000 : 9000;
      const x = v[k];
      if (x !== undefined && x > lim)
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: `Must be ${lim.toLocaleString("en-US")} ${v.unit === "in" ? "lb" : "kg"} or less`,
        });
    }
    if (v.maxHeight !== undefined && v.maxHeight > (v.unit === "in" ? 200 : 508))
      ctx.addIssue({
        code: "custom",
        path: ["maxHeight"],
        message: `Must be ${v.unit === "in" ? "200 in" : "508 cm"} or less`,
      });
    if (v.overhang !== undefined && v.overhang > (v.unit === "in" ? 6 : 15))
      ctx.addIssue({
        code: "custom",
        path: ["overhang"],
        message: `Must be ${v.unit === "in" ? "6 in" : "15 cm"} or less`,
      });
  });

export type PalletInput = z.output<typeof palletInputSchema>;

const OPTIONAL_KEYS = {
  wt: "weight",
  pl: "palletL",
  pw: "palletW",
  ph: "palletH",
  pwt: "palletWeight",
  ml: "maxLoad",
  mh: "maxHeight",
  oh: "overhang",
} as const;

export function palletFromQuery(q: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    l: q.l,
    w: q.w,
    h: q.h,
    unit: q.u || undefined,
    qty: q.q || undefined,
    upright: q.up || undefined,
    pallet: q.p || undefined,
    containers: q.c === undefined ? undefined : q.c,
    stack: q.st || undefined,
  };
  for (const [k, field] of Object.entries(OPTIONAL_KEYS)) out[field] = q[k];
  return out;
}

export function palletToQuery(i: PalletInput): Record<string, string> {
  const q: Record<string, string> = {
    l: String(i.l),
    w: String(i.w),
    h: String(i.h),
    u: i.unit,
    p: i.pallet,
  };
  if (i.qty !== 1) q.q = String(i.qty);
  if (i.upright) q.up = "1";
  if (i.stack) q.st = "1";
  if (i.containers.length !== CONTAINER_IDS.length) q.c = i.containers.join(",");
  for (const [k, field] of Object.entries(OPTIONAL_KEYS)) {
    const v = i[field];
    if (v !== undefined) q[k] = String(v);
  }
  return q;
}
