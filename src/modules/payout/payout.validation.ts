import { z } from "zod";

export const createPayoutRequestSchema = z.object({
  amountBdt: z
    .number()
    .min(200, "Minimum withdrawal threshold is 200 BDT (50 Credits)")
    .max(100000, "Maximum single withdrawal limit is 100,000 BDT"),
  method: z.enum(["BKASH", "NAGAD", "BANK"]).optional().default("BKASH"),
  accountNumber: z
    .string()
    .min(10, "Account/mobile number must be at least 10 characters")
    .max(50, "Account/mobile number cannot exceed 50 characters"),
});

export const processPayoutSchema = z.object({
  status: z.enum(["PROCESSED", "REJECTED"]),
  rejectionReason: z.string().optional(),
});
