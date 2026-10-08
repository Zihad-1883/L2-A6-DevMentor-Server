import { z } from "zod";

export const updateUserProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").max(50).optional(),
  image: z.union([z.string().url("Invalid image URL"), z.literal("")]).optional().nullable(),
  bio: z.string().min(10, "Bio must be at least 10 characters long").max(1000).optional(),
  techStackTags: z.array(z.string().min(1)).optional(),
  githubUrl: z.union([z.string().url("Invalid GitHub URL"), z.literal("")]).optional().nullable(),
  resumeUrl: z.union([z.string().url("Invalid Resume URL"), z.literal("")]).optional().nullable(),
});

