import { z } from "zod";

// 1. Student Create Code Review Schema
export const createCodeReviewSchema = z.object({
  body: z
    .object({
      tier: z.enum(["QUICK", "DEEP"]),
      title: z
        .string()
        .min(3, "Title must be at least 3 characters")
        .max(150, "Title must not exceed 150 characters"),
      description: z
        .string()
        .min(10, "Description must be at least 10 characters"),
      codeSnippet: z.string().optional(),
      language: z.string().optional().default("typescript"),
      githubRepoUrl: z
        .string()
        .url("Please provide a valid GitHub repository URL")
        .optional()
        .or(z.literal("")),
      branchName: z.string().optional().default("main"),
      specificFiles: z.string().optional(),
    })
    .refine(
      (data) => (data.codeSnippet && data.codeSnippet.trim().length > 0) || (data.githubRepoUrl && data.githubRepoUrl.trim().length > 0),
      {
        message: "You must provide either a code snippet or a GitHub repository URL for review.",
        path: ["codeSnippet"],
      }
    ),
});

// 2. Student Update Code Snippet / Request Schema
export const updateCodeSnippetSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(150).optional(),
    description: z.string().min(10).optional(),
    codeSnippet: z.string().optional(),
    language: z.string().optional(),
    githubRepoUrl: z
      .string()
      .url("Please provide a valid GitHub repository URL")
      .optional()
      .or(z.literal("")),
    branchName: z.string().optional(),
    specificFiles: z.string().optional(),
  }),
});

// 3. Mentor Submit Code Review Delivery Schema
export const submitCodeReviewSchema = z.object({
  body: z.object({
    summary: z
      .string()
      .min(10, "Feedback summary must be at least 10 characters"),
    reviewedCodeSnippet: z.string().optional(),
    videoUrl: z
      .string()
      .url("Please provide a valid video feedback URL (e.g. Loom, Cloudinary)")
      .optional()
      .or(z.literal("")),
    pullRequestUrl: z
      .string()
      .url("Please provide a valid Pull Request URL")
      .optional()
      .or(z.literal("")),
    comments: z
      .array(
        z.object({
          filePath: z.string().min(1, "File path is required for comment"),
          lineNumber: z
            .number()
            .int()
            .positive("Line number must be positive"),
          commentText: z
            .string()
            .min(1, "Comment text cannot be empty"),
          severity: z.enum(["BUG", "SECURITY", "SUGGESTION"]).optional().default("SUGGESTION"),
        })
      )
      .optional(),
  }),
});

export const codeReviewValidation = {
  createCodeReviewSchema,
  updateCodeSnippetSchema,
  submitCodeReviewSchema,
};
