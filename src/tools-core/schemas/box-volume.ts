// Input schema for tool 6 (box volume & CBM). Same schema for widget, API and tests.
import { z } from "zod";
import { CONTAINER_IDS } from "./containers";

export const BV_UNITS = ["in", "cm", "mm"] as const;
export type BvUnit = (typeof BV_UNITS)[number];

/** Input sanity bounds from the spec, not container rules. */
export const BV_MAX_SIDE: Record<BvUnit, number> = { in: 120, cm: 304.8, mm: 3048 };
export const BV_MAX_QTY = 1_000_000;
/** lb when unit = in, kg otherwise. */
export const bvWeightUnit = (u: BvUnit) => (u === "in" ? "lb" : "kg");
export const BV_MAX_WEIGHT = { lb: 2000, kg: 907 } as const;

const positive = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .positive(`${label} must be greater than 0`);

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number({ error: "Weight must be a number" }).optional(),
);

/** Accepts ["20ft","40hc"] or "20ft,40hc". */
const containerList = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : v,
  z.array(z.enum(CONTAINER_IDS)).min(1, "Choose at least one container"),
);

export const boxVolumeInputSchema = z
  .object({
    l: positive("Length"),
    w: positive("Width"),
    h: positive("Height"),
    unit: z.enum(BV_UNITS).default("in"),
    qty: z.coerce
      .number({ error: "Quantity must be a number" })
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1")
      .max(BV_MAX_QTY, `Quantity must be ${BV_MAX_QTY.toLocaleString("en-US")} or less`)
      .default(1),
    /** Gross weight of one carton; lb with in, kg with cm or mm. Empty = no payload check. */
    weight: optionalNumber.pipe(z.number().min(0, "Weight cannot be negative").optional()),
    /** true = "this side up": the entered height stays vertical. */
    upright: z.preprocess(
      (v) => (v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : v),
      z.boolean().default(false),
    ),
    containers: containerList.default([...CONTAINER_IDS]),
  })
  .superRefine((v, ctx) => {
    for (const k of ["l", "w", "h"] as const) {
      if (v[k] > BV_MAX_SIDE[v.unit]) {
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: `Must be ${BV_MAX_SIDE[v.unit]} ${v.unit} or less`,
        });
      }
    }
    const wu = bvWeightUnit(v.unit);
    if (v.weight !== undefined && v.weight > BV_MAX_WEIGHT[wu]) {
      ctx.addIssue({
        code: "custom",
        path: ["weight"],
        message: `Must be ${BV_MAX_WEIGHT[wu].toLocaleString("en-US")} ${wu} or less`,
      });
    }
  });

export type BoxVolumeInput = z.output<typeof boxVolumeInputSchema>;

/** URL query <-> input (principle 8). */
export function boxVolumeFromQuery(q: Record<string, string>): Record<string, unknown> {
  return {
    l: q.l,
    w: q.w,
    h: q.h,
    unit: q.u || undefined,
    qty: q.q || undefined,
    weight: q.wt,
    upright: q.up || undefined,
    containers: q.c || undefined,
  };
}

export function boxVolumeToQuery(i: BoxVolumeInput): Record<string, string> {
  const q: Record<string, string> = {
    l: String(i.l),
    w: String(i.w),
    h: String(i.h),
    u: i.unit,
  };
  if (i.qty !== 1) q.q = String(i.qty);
  if (i.weight !== undefined) q.wt = String(i.weight);
  if (i.upright) q.up = "1";
  if (i.containers.length !== CONTAINER_IDS.length) q.c = i.containers.join(",");
  return q;
}
