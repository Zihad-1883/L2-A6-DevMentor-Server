import { z } from "zod";

export const createCohortSchema = z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(10),
    durationWeeks: z.number().int().positive(),
    capacity: z.number().int().positive(),
    techStackTags: z.array(z.string()),
});
