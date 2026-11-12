// Shape of containers.json, validated at load.
import { z } from "zod";
import containersJson from "../rules/containers.json";

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

export const CONTAINER_IDS = ["20ft", "40ft", "40hc"] as const;
export type ContainerId = (typeof CONTAINER_IDS)[number];

const containerSchema = z
  .object({
    id: z.enum(CONTAINER_IDS),
    name: z.string(),
    /** Inside length, width, height. */
    insideMm: z.tuple([pos, pos, pos]),
    /** Door opening width, height. */
    doorMm: z.tuple([pos, pos]),
    capacityM3: pos,
    tareKg: pos,
    maxGrossKg: pos,
    payloadKg: pos,
    ...meta,
  })
  .refine((c) => c.payloadKg === c.maxGrossKg - c.tareKg, {
    message: "payloadKg must equal maxGrossKg - tareKg",
  });
export type Container = z.infer<typeof containerSchema>;

export const containersFileSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  containers: z.object({
    "20ft": containerSchema,
    "40ft": containerSchema,
    "40hc": containerSchema,
  }),
  settings: z.object({ roadWeightInfoKg: pos, note: z.string().optional() }),
});
export type ContainersFile = z.infer<typeof containersFileSchema>;

export const containerRules: ContainersFile = containersFileSchema.parse(containersJson);
