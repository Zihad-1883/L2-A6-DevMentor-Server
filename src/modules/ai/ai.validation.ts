import { z } from "zod";


// 1. AI Chat Schema (DevMentor Assistant & FAQ Bot)
export const chatSchema = z.object({
  message: z
    .string({
      error: "Message is required",
    })
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message cannot exceed 2000 characters"),

  history: z
    .array(
      z.object({
        role: z.enum(["user", "model", "assistant"], {
          error: "Role must be 'user', 'model', or 'assistant'",
        }),
        content: z
          .string()
          .trim()
          .min(1, "History content cannot be empty")
          .max(4000, "History content cannot exceed 4000 characters"),
      })
    )
    .max(20, "History cannot exceed 20 messages")
    .optional()
    .default([]),
});


// 2. AI Smart Matcher Schema (Mentor & Cohort Matching)
export const matchSchema = z.object({
  prompt: z
    .string({
      error: "Prompt is required",
    })
    .trim()
    .min(3, "Prompt must be at least 3 characters")
    .max(1000, "Prompt cannot exceed 1000 characters"),

  preferredLevel: z
    .enum(["JUNIOR", "MID", "SENIOR", "LEAD", "ALL"])
    .optional()
    .default("ALL"),

  techStack: z
    .array(z.string().trim())
    .max(10, "Cannot specify more than 10 tech stack tags")
    .optional(),

  maxResults: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .default(2),
});


// 3. AI Code Review Pre-Scan Schema
export const codeScanSchema = z.object({
  code: z
    .string({
      error: "Code snippet is required",
    })
    .trim()
    .min(5, "Code snippet must be at least 5 characters")
    .max(12000, "Code snippet cannot exceed 12,000 characters"),

  language: z
    .string()
    .trim()
    .max(50)
    .optional()
    .default("typescript"),

  context: z
    .string()
    .trim()
    .max(1000, "Context cannot exceed 1000 characters")
    .optional(),
});

export type ChatInput = z.infer<typeof chatSchema>;
export type MatchInput = z.infer<typeof matchSchema>;
export type CodeScanInput = z.infer<typeof codeScanSchema>;
