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

export const updatePlatformSettingSchema = z.object({
  sprintCreditPerSession: z
    .number({ error: "sprintCreditPerSession must be a number" })
    .int("sprintCreditPerSession must be an integer")
    .min(1, "sprintCreditPerSession must be at least 1")
    .max(5000, "sprintCreditPerSession cannot exceed 5000")
    .optional(),
  sessionCommissionPercent: z
    .number({ error: "sessionCommissionPercent must be a number" })
    .int("sessionCommissionPercent must be an integer")
    .min(0, "sessionCommissionPercent must be at least 0%")
    .max(100, "sessionCommissionPercent cannot exceed 100%")
    .optional(),
});
