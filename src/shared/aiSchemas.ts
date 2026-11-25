import { z } from 'zod';

export const prioritySchema = z.enum(['high', 'medium', 'low']);
export type Priority = z.infer<typeof prioritySchema>;

const text110 = z.string().min(1).max(110);
const text280 = z.string().min(1).max(280);

export const routinePlanItemSchema = z.object({
  itemId: z.string().max(64),
  chosenOptionId: z.string().max(64),
  headline: text110,
  why: text280,
  tradeoff: z.string().max(200).nullable(),
  priority: prioritySchema,
});
export type RoutinePlanItem = z.infer<typeof routinePlanItemSchema>;

export const indoorPlanItemSchema = z.object({
  actionId: z.string().max(64),
  headline: text110,
  why: text280,
  priority: prioritySchema,
});
export type IndoorPlanItem = z.infer<typeof indoorPlanItemSchema>;

export const communityPlanItemSchema = z.object({
  actionId: z.string().max(64),
  headline: text110,
  why: text280,
});
export type CommunityPlanItem = z.infer<typeof communityPlanItemSchema>;

export const aiPlanSchema = z.object({
  summary: z.string().min(1).max(320),
  routine: z.array(routinePlanItemSchema).max(15),
  indoor: z.array(indoorPlanItemSchema).max(5),
  community: z.array(communityPlanItemSchema).max(2),
  caveats: z.array(z.string().min(1).max(200)).max(3),
});
export type AiPlan = z.infer<typeof aiPlanSchema>;
export const AiPlan = aiPlanSchema;

export const aiIndoorExplanationSchema = z.object({
  summary: z.string().min(1).max(320),
  actions: z.array(indoorPlanItemSchema).max(5),
  caveats: z.array(z.string().min(1).max(200)).max(3),
});
export type AiIndoorExplanation = z.infer<typeof aiIndoorExplanationSchema>;
export const AiIndoorExplanation = aiIndoorExplanationSchema;

export function stripDollarSchema(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripDollarSchema);
  const copy: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key !== '$schema' && key !== 'additionalProperties') {
      copy[key] = stripDollarSchema(val);
    }
  }
  return copy;
}

export const aiPlanJsonSchema = stripDollarSchema(z.toJSONSchema(AiPlan)) as Record<string, unknown>;
export const aiIndoorExplanationJsonSchema = stripDollarSchema(
  z.toJSONSchema(AiIndoorExplanation)
) as Record<string, unknown>;
