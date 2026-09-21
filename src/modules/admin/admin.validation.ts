/**
 * @file src/modules/admin/admin.validation.ts
 * @description Zod validation schemas for Admin moderation actions.
 */

import { z } from "zod";

export const approveMentorSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], {
    error: "Status must be either APPROVED or REJECTED",
  }),
  rejectionReason: z.string().optional(),
});

export const toggleUserBlockSchema = z.object({
  isBlocked: z.boolean({
    error: "isBlocked must be a boolean (true or false)",
  }),
});

export const approveCohortSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], {
    error: "Status must be APPROVED or REJECTED",
  }),
});
