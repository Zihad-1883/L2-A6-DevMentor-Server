import { z } from "zod";

export const initiateTopUpSchema = z.object({
  amount: z.number().int().min(10, "Minimum top-up amount is 10 BDT").max(50000, "Maximum top-up amount is 50,000 BDT"),
});
