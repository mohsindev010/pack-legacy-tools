// Input schema for tool 1. The same schema validates the widget, the API and
// the tests (principle 4). Numbers arrive as strings from query strings, so
// fields coerce. Limits are input sanity bounds, not carrier rules.
import { z } from "zod";
import { CARRIER_IDS } from "./carriers";

const MAX_SIDE = { in: 200, cm: 508 } as const;
const MAX_WEIGHT = { in: 300, cm: 136 } as const; // lb when unit=in, kg when unit=cm

const positive = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .positive(`${label} must be greater than 0`);

/** Accepts ["ups","usps"] or "ups,usps". */
const carrierList = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : v,
  z.array(z.enum(CARRIER_IDS)).min(1, "Choose at least one carrier"),
);

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional(),
);

export const dimWeightInputSchema = z
  .object({
    l: positive("Length"),
    w: positive("Width"),
    h: positive("Height"),
    /** Length unit; weight is lb with "in" and kg with "cm". */
    unit: z.enum(["in", "cm"]).default("in"),
    weight: z.coerce.number().min(0, "Weight cannot be negative"),
    carriers: carrierList.default([...CARRIER_IDS]),
    /** box | softpack (poly mailer / envelope) | mylar (Mylar bag / pouch) | tube (API only). */
    packaging: z.enum(["box", "softpack", "mylar", "tube"]).default("box"),
    contractDivisor: optionalNumber.pipe(
      z
        .number()
        .min(100, "Divisor must be 100 to 400")
        .max(400, "Divisor must be 100 to 400")
        .optional(),
    ),
    product: z
      .object({
        l: positive("Product length"),
        w: positive("Product width"),
        h: positive("Product height"),
      })
      .optional(),
    clearance: optionalNumber.pipe(z.number().min(0).max(4).optional()),
  })
  .superRefine((v, ctx) => {
    for (const k of ["l", "w", "h"] as const) {
      if (v[k] > MAX_SIDE[v.unit]) {
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: `Must be ${MAX_SIDE[v.unit]} ${v.unit} or less`,
        });
      }
    }
    if (v.weight > MAX_WEIGHT[v.unit]) {
      ctx.addIssue({
        code: "custom",
        path: ["weight"],
        message: `Must be ${MAX_WEIGHT[v.unit]} ${v.unit === "in" ? "lb" : "kg"} or less`,
      });
    }
  });

export type DimWeightInput = z.output<typeof dimWeightInputSchema>;

/** URL query <-> input (principle 8). Short keys keep shared links readable. */
export function dimWeightFromQuery(q: Record<string, string>): Record<string, unknown> {
  const product = q.pl && q.pw && q.ph ? { l: q.pl, w: q.pw, h: q.ph } : undefined;
  return {
    l: q.l,
    w: q.w,
    h: q.h,
    unit: q.u || undefined,
    weight: q.wt,
    carriers: q.c || undefined,
    packaging: q.p || undefined,
    contractDivisor: q.div,
    product,
    clearance: q.cl,
  };
}

export function dimWeightToQuery(i: DimWeightInput): Record<string, string> {
  const q: Record<string, string> = {
    l: String(i.l),
    w: String(i.w),
    h: String(i.h),
    u: i.unit,
    wt: String(i.weight),
  };
  if (i.carriers.length !== CARRIER_IDS.length) q.c = i.carriers.join(",");
  if (i.packaging !== "box") q.p = i.packaging;
  if (i.contractDivisor !== undefined) q.div = String(i.contractDivisor);
  if (i.product) {
    q.pl = String(i.product.l);
    q.pw = String(i.product.w);
    q.ph = String(i.product.h);
  }
  if (i.clearance !== undefined) q.cl = String(i.clearance);
  return q;
}
