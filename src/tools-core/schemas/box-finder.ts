// Input schema for tool 2 (box finder). Same schema for widget, API and tests.
import { z } from "zod";
import { FLUTE_IDS } from "./boxes";

const MAX_SIDE = { in: 48, cm: 122 } as const;
const MAX_WEIGHT = { in: 150, cm: 68 } as const;

const positive = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .positive(`${label} must be greater than 0`);

const optionalNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional(),
);

export const BOX_FILTERS = ["all", "mailer", "rsc", "usps-flat-rate", "pl-product"] as const;

export const boxFinderInputSchema = z
  .object({
    l: positive("Length"),
    w: positive("Width"),
    h: positive("Height"),
    unit: z.enum(["in", "cm"]).default("in"),
    /** Per side, in the input unit. Empty = the "standard" preset from box-sizes.json. */
    clearance: optionalNumber.pipe(z.number().min(0, "Clearance cannot be negative").optional()),
    insert: z.coerce.number().min(0, "Insert cannot be negative").default(0),
    orientation: z.enum(["free", "upright"]).default("free"),
    family: z.enum(BOX_FILTERS).default("all"),
    board: z.enum(FLUTE_IDS).default("e"),
    weight: optionalNumber.pipe(z.number().min(0, "Weight cannot be negative").optional()),
  })
  .superRefine((v, ctx) => {
    const max = MAX_SIDE[v.unit];
    for (const k of ["l", "w", "h"] as const) {
      if (v[k] > max)
        ctx.addIssue({ code: "custom", path: [k], message: `Must be ${max} ${v.unit} or less` });
    }
    const maxPad = v.unit === "in" ? 2 : 5;
    for (const k of ["clearance", "insert"] as const) {
      if ((v[k] ?? 0) > maxPad)
        ctx.addIssue({ code: "custom", path: [k], message: `Must be ${maxPad} ${v.unit} or less` });
    }
    if (v.weight !== undefined && v.weight > MAX_WEIGHT[v.unit]) {
      ctx.addIssue({
        code: "custom",
        path: ["weight"],
        message: `Must be ${MAX_WEIGHT[v.unit]} ${v.unit === "in" ? "lb" : "kg"} or less`,
      });
    }
  });

export type BoxFinderInput = z.output<typeof boxFinderInputSchema>;

export function boxFinderFromQuery(q: Record<string, string>): Record<string, unknown> {
  return {
    l: q.l,
    w: q.w,
    h: q.h,
    unit: q.u || undefined,
    clearance: q.cl || undefined,
    insert: q.ins || undefined,
    orientation: q.o || undefined,
    family: q.f || undefined,
    board: q.b || undefined,
    weight: q.wt,
  };
}

export function boxFinderToQuery(i: BoxFinderInput): Record<string, string> {
  const q: Record<string, string> = { l: String(i.l), w: String(i.w), h: String(i.h), u: i.unit };
  if (i.clearance !== undefined) q.cl = String(i.clearance);
  if (i.insert) q.ins = String(i.insert);
  if (i.orientation !== "free") q.o = i.orientation;
  if (i.family !== "all") q.f = i.family;
  if (i.board !== "e") q.b = i.board;
  if (i.weight !== undefined) q.wt = String(i.weight);
  return q;
}
