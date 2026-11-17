// Input schema for tool 3 (paper weight converter). Same schema for widget, API and tests.
import { z } from "zod";
import { STOCK_IDS } from "./paper";

export const PAPER_UNITS = ["gsm", "lb", "pt", "mm"] as const;
export type PaperUnit = (typeof PAPER_UNITS)[number];

/** Input sanity bounds (not conversion rules). */
export const PAPER_MAX: Record<PaperUnit, number> = { gsm: 2000, lb: 750, pt: 200, mm: 5 };

export const paperWeightInputSchema = z
  .object({
    value: z.coerce
      .number({ error: "Value must be a number" })
      .positive("Value must be greater than 0"),
    from: z.enum(PAPER_UNITS).default("pt"),
    /** Stock type sets the GSM-per-pt factor and whether lb means text or cover weight. */
    stock: z.enum(STOCK_IDS).default("uncoated"),
  })
  .superRefine((v, ctx) => {
    if (v.value > PAPER_MAX[v.from])
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Must be ${PAPER_MAX[v.from]} ${v.from} or less`,
      });
  });

export type PaperWeightInput = z.output<typeof paperWeightInputSchema>;

export function paperWeightFromQuery(q: Record<string, string>): Record<string, unknown> {
  return { value: q.v, from: q.f || undefined, stock: q.s || undefined };
}

export function paperWeightToQuery(i: PaperWeightInput): Record<string, string> {
  return { v: String(i.value), f: i.from, s: i.stock };
}
