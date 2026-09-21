import { z } from "zod";

export const createCohortSessionSchema = z.object({
    sessionNumber: z.number().int().positive(),
    dayNumber: z.number().int().positive(),
    title: z.string().min(3).max(100),
    scheduledAt: z.string().datetime(),
    durationMinutes: z.number().int().positive().optional(),
    creditCost: z.number().int().nonnegative(),
    joinLink: z.string().url().optional(),
    resources: z.any().optional(),
});
