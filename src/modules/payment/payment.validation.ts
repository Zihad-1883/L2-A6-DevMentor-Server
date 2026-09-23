/**
 * @file src/modules/payment/payment.validation.ts
 * @description Zod validation schemas for Payment endpoints.
 */

import { z } from "zod";

export const initiateTopUpSchema = z.object({
  body: z.object({
    amount: z
      .number()
      .min(10, "Minimum top-up amount is 10 BDT")
      .max(50000, "Maximum single top-up limit is 50,000 BDT"),
  }),
});
