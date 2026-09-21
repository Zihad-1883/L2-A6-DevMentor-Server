import { z } from "zod";

export const updateUserProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").max(50).optional(),
  image: z.string().url("Invalid image URL").optional().nullable(),
  bio: z.string().min(10, "Bio must be at least 10 characters long").max(1000).optional(),
});

