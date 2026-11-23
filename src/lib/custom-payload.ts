import type { Prisma } from "@prisma/client";
import { z } from "zod";

const customBreakdownSchema = z.object({
  basePln: z.number(),
  volumeCost: z.number(),
  materialMult: z.number(),
  infillMult: z.number(),
  qualityMult: z.number(),
  finishMult: z.number(),
});

export const customPayloadSchema = z
  .object({
    brandId: z.string().optional(),
    brandName: z.string().optional(),
    modelId: z.string().optional(),
    modelName: z.string().optional(),
    description: z.string().optional(),
    complexity: z.number().optional(),
    material: z.string().optional(),
    volumeCm3: z.number().optional(),
    infill: z.number().optional(),
    quality: z.string().optional(),
    finish: z.string().optional(),
    estimatedPrice: z.number().optional(),
    modelFileName: z.string().optional(),
    modelFilePath: z.string().optional(),
    modelFileSize: z.number().optional(),
    breakdown: customBreakdownSchema.optional(),
  })
  .passthrough();

export type CustomPayload = z.infer<typeof customPayloadSchema>;

export function parseCustomPayload(
  value: Prisma.JsonValue | null | undefined,
): CustomPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const parsed = customPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
