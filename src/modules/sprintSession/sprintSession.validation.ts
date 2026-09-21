import { z } from "zod";

export const scheduleSprintSessionSchema = z.object({
    scheduledAt: z.string().datetime(),
    joinLink: z.string().url().optional(),
});
