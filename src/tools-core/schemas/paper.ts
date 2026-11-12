// Shape of paper-grades.json and boards.json, validated at load.
import { z } from "zod";
import gradesJson from "../rules/paper-grades.json";
import boardsJson from "../rules/boards.json";
import { G_PER_LB, M2_PER_FT2, M2_PER_IN2 } from "../lib/units";

const meta = {
  source: z.string().min(1),
  sourceUrl: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verifiedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
};

export const GRADE_IDS = [
  "bond",
  "text",
  "cover",
  "index",
  "bristolTag",
  "tissue",
  "newsprint",
  "paperboard",
] as const;
export type GradeId = (typeof GRADE_IDS)[number];

const gradeSchema = z.union([
  z.object({
    id: z.string(),
    name: z.string(),
    basisSheetIn: z.tuple([z.number().positive(), z.number().positive()]),
    sheetsPerReam: z.number().int().positive(),
    ...meta,
  }),
  z.object({ id: z.string(), name: z.string(), basisAreaFt2: z.number().positive(), ...meta }),
]);
export type Grade = z.infer<typeof gradeSchema>;

export const paperGradesFileSchema = z.object({
  version: z.string(),
  grades: z.object(
    Object.fromEntries(GRADE_IDS.map((id) => [id, gradeSchema])) as Record<
      GradeId,
      typeof gradeSchema
    >,
  ),
});
export type PaperGradesFile = z.infer<typeof paperGradesFileSchema>;

export const BOARD_IDS = ["sbs", "crb"] as const;
export type BoardId = (typeof BOARD_IDS)[number];

const rangeSchema = z
  .object({
    min: z.number().positive(),
    typical: z.number().positive(),
    max: z.number().positive(),
  })
  .refine((r) => r.min <= r.typical && r.typical <= r.max, "Expected min <= typical <= max");

const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  material: z.string(),
  densityGcm3: rangeSchema,
  ...meta,
});
export type Board = z.infer<typeof boardSchema>;

export const boardsFileSchema = z.object({
  version: z.string(),
  boards: z.object(
    Object.fromEntries(BOARD_IDS.map((id) => [id, boardSchema])) as Record<
      BoardId,
      typeof boardSchema
    >,
  ),
});
export type BoardsFile = z.infer<typeof boardsFileSchema>;

export const paperGradeRules: PaperGradesFile = paperGradesFileSchema.parse(gradesJson);
export const boardRules: BoardsFile = boardsFileSchema.parse(boardsJson);

/** Basis area in m² (one ream, or 1,000 ft² for paperboard). */
export function basisAreaM2(g: Grade): number {
  return "basisAreaFt2" in g
    ? g.basisAreaFt2 * M2_PER_FT2
    : g.basisSheetIn[0] * g.basisSheetIn[1] * g.sheetsPerReam * M2_PER_IN2;
}

/** Exact gsm per lb of basis weight, derived from the basis ream (never typed in). */
export const gsmPerLb = (g: Grade): number => G_PER_LB / basisAreaM2(g);
