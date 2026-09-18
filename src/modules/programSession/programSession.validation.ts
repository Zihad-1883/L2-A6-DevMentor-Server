/**
 * @file src/modules/programSession/programSession.validation.ts
 * @description Zod validation schemas for Program Session endpoints.
 */

import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().min(1, "Session title cannot be empty").optional(),
  sessionNumber: z.number().int().min(1, "Session number must be at least 1").optional().default(1),
  weekNumber: z.number().int().min(1, "Week number must be at least 1"),
  priceInCredits: z.number().int().min(0, "Price in credits cannot be negative"),
  scheduledAt: z.string().datetime({ message: "Invalid ISO date string for scheduledAt" }).optional(),
  durationMinutes: z.number().int().min(15).max(240).optional().default(60),
  joinLink: z.string().url("Join link must be a valid URL").optional(),
});

export const updateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  sessionNumber: z.number().int().min(1).optional(),
  weekNumber: z.number().int().min(1).optional(),
  priceInCredits: z.number().int().min(0).optional(),
  scheduledAt: z.string().datetime({ message: "Invalid ISO date string for scheduledAt" }).optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  joinLink: z.string().url("Join link must be a valid URL").optional(),
});

export const bookSessionSchema = z.object({
  scheduledAt: z.string().datetime({ message: "scheduledAt must be a valid ISO datetime string" }),
  durationMinutes: z.number().int().min(15).max(240).optional().default(60),
  joinLink: z.string().url("Join link must be a valid URL").optional(),
});
