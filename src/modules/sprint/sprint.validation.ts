import { z } from "zod";

export const createSprintSchema = z.object({
    title: z.string().min(3).max(100),
    description: z.string().min(10),
    techStackTags: z.array(z.string()).min(1, "At least one tech stack tag is required"),
    startDate: z.string().datetime(),
    durationDays: z.number().int().positive(),
    selectedDays: z.array(z.number().int().positive()),
});
