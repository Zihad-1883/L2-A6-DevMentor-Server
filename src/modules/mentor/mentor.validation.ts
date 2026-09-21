import { z } from "zod";

export const applyMentorSchema = z.object({
  bio: z.string().min(20, "Bio must be at least 20 characters long").max(1000),
  techStackTags: z.array(z.string()).min(1, "At least one tech stack tag is required"),
  experienceLevel: z.enum(["JUNIOR", "MID", "SENIOR"]).optional().default("MID"),
  githubUrl: z.string().url("Invalid GitHub URL").optional().nullable(),
  resumeUrl: z.string().url("Valid resume URL is required"),
});

