import { z } from "zod";

export const initiateTopUpSchema = z.object({
  amount: z
    .number()
    .min(10, "Minimum top-up amount is 10 BDT")
    .max(50000, "Maximum single top-up limit is 50,000 BDT"),
});

export const requestWithdrawalSchema = z.object({
  amount: z
    .number()
    .min(1000, "Minimum withdrawal threshold is 1,000 BDT (250 Credits)")
    .max(100000, "Maximum single withdrawal limit is 100,000 BDT"),
  bkashNumber: z
    .string()
    .regex(/^01[3-9]\d{8}$/, "Invalid Bangladeshi bKash mobile number format (e.g. 017XXXXXXXX)"),
});
