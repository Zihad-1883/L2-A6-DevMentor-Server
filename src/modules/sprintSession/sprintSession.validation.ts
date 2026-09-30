import { z } from "zod";

export const scheduleSprintSessionSchema = z
  .object({
    // Accept both field names for flexibility (Postman uses proposedTime, service uses scheduledAt)
    proposedTime: z.string().datetime().optional(),
    scheduledAt: z.string().datetime().optional(),
    joinLink: z.string().url().optional(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .transform((data) => ({
    scheduledAt: data.scheduledAt || data.proposedTime!,
    joinLink: data.joinLink,
    durationMinutes: data.durationMinutes,
  }))
  .refine((data) => !!data.scheduledAt, {
    message: "proposedTime or scheduledAt is required (ISO 8601 datetime string)",
    path: ["proposedTime"],
  });

