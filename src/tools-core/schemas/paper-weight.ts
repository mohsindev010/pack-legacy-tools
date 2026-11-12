// Input schema for tool 3 (paper weight converter). Same schema for widget, API and tests.
import { z } from "zod";
import { BOARD_IDS, GRADE_IDS, boardRules, gsmPerLb, paperGradeRules } from "./paper";
import { UM_PER_MM, UM_PER_PT } from "../lib/units";

export const PAPER_UNITS = ["gsm", "lb", "pt", "mm", "um"] as const;
export type PaperUnit = (typeof PAPER_UNITS)[number];
export const CALIPER_UNITS = ["pt", "mm", "um"] as const;
export const isCaliperUnit = (u: PaperUnit): u is (typeof CALIPER_UNITS)[number] =>
  (CALIPER_UNITS as readonly string[]).includes(u);

/** Largest input, as a gsm equivalent (spec section B). */
export const MAX_GSM = 5000;

export const toUm = (x: number, unit: "pt" | "mm" | "um") =>
  unit === "pt" ? x * UM_PER_PT : unit === "mm" ? x * UM_PER_MM : x;

export const paperWeightInputSchema = z
  .object({
    value: z.coerce
      .number({ error: "Value must be a number" })
      .positive("Value must be greater than 0"),
    from: z.enum(PAPER_UNITS).default("gsm"),
    /** Required when from = lb (flag GRADE_REQUIRED); otherwise picks the lb shown first. */
    grade: z.enum(GRADE_IDS).optional(),
    board: z.enum(BOARD_IDS).default("sbs"),
  })
  .superRefine((v, ctx) => {
    let gsm = v.value;
    if (v.from === "lb") gsm = v.grade ? v.value * gsmPerLb(paperGradeRules.grades[v.grade]) : 0;
    else if (isCaliperUnit(v.from))
      gsm = toUm(v.value, v.from) * boardRules.boards[v.board].densityGcm3.typical;
    if (gsm > MAX_GSM)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Too heavy: must be ${MAX_GSM.toLocaleString("en-US")} gsm or less`,
      });
  });

export type PaperWeightInput = z.output<typeof paperWeightInputSchema>;

export function paperWeightFromQuery(q: Record<string, string>): Record<string, unknown> {
  return {
    value: q.v,
    from: q.f || undefined,
    grade: q.g || undefined,
    board: q.b || undefined,
  };
}

export function paperWeightToQuery(i: PaperWeightInput): Record<string, string> {
  const q: Record<string, string> = { v: String(i.value), f: i.from };
  if (i.grade) q.g = i.grade;
  if (i.board !== "sbs") q.b = i.board;
  return q;
}
