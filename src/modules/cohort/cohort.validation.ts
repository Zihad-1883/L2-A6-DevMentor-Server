import { z } from "zod";

export const createCohortSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long").max(100),
  description: z.string().min(10, "Description must be at least 10 characters long"),
  durationWeeks: z.number().int().positive("Duration must be a positive integer"),
  capacity: z.number().int().nonnegative("Capacity cannot be negative"),
  totalCost: z.number().int().nonnegative("Total cost cannot be negative"),
  techStackTags: z.array(z.string()).min(1, "At least one tech stack tag is required"),
});

export const updateCohortSchema = createCohortSchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

