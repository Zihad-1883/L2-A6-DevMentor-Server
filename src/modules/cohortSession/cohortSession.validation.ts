import { z } from "zod";

export const resourceItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Resource title is required"),
  type: z.enum(["FILE", "LINK", "NOTE", "CODE_SNIPPET"]),
  url: z.string().url("Invalid resource URL").optional().nullable(),
  publicId: z.string().optional().nullable(),
  fileSize: z.number().int().optional().nullable(),
  fileType: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
});

export const createCohortSessionSchema = z.object({
  sessionNumber: z.number().int().positive("Session number must be positive"),
  dayNumber: z.number().int().positive("Day number must be positive"),
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  scheduledAt: z.string().datetime("Scheduled time must be a valid ISO 8601 date string"),
  durationMinutes: z.number().int().positive().optional().default(60),
  creditCost: z.number().int().nonnegative("Credit cost cannot be negative"),
  joinLink: z.string().url("Invalid join link URL").optional().nullable(),
  resources: z.array(resourceItemSchema).optional(),
});

export const updateCohortSessionSchema = createCohortSessionSchema.partial();

export const addSessionResourceSchema = resourceItemSchema;

