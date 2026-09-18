/**
 * @file src/modules/program/program.validation.ts
 * @description Zod validation schemas for Program endpoints.
 */

import { z } from "zod";

// ── 1. Create Program Validation ──────────────────────────────────────────────
export const createProgramSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters long")
    .max(100, "Title cannot exceed 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters long"),
  durationWeeks: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 week")
    .max(52, "Duration cannot exceed 52 weeks"),
  techStackTags: z
    .array(z.string().min(1))
    .min(1, "At least one tech stack tag is required"),
});

// ── 2. Update Program Validation ──────────────────────────────────────────────
export const updateProgramSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).optional(),
  durationWeeks: z.number().int().min(1).max(52).optional(),
  techStackTags: z.array(z.string().min(1)).min(1).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

// ── 3. Query Programs List Validation ─────────────────────────────────────────
export const queryProgramsSchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  mentorId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});
