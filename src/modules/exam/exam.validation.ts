import { z } from "zod";

export const createExamSchema = z.object({
  title: z
    .string()
    .min(3, "Exam title must be at least 3 characters long")
    .max(150, "Exam title cannot exceed 150 characters"),
  description: z.string().optional(),
  durationMinutes: z
    .number()
    .min(5, "Exam duration must be at least 5 minutes")
    .max(300, "Exam duration cannot exceed 300 minutes (5 hours)")
    .optional(),
  totalMarks: z
    .number()
    .min(5, "Total marks must be at least 5")
    .max(1000, "Total marks cannot exceed 1000")
    .optional(),
  passMark: z
    .number()
    .min(1, "Pass mark percentage must be at least 1%")
    .max(100, "Pass mark percentage cannot exceed 100%")
    .optional(),
  isFree: z.boolean().optional(),
  cohortId: z.string().optional(),
  sprintId: z.string().optional(),
});

export const updateExamSchema = createExamSchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

const questionItemSchema = z.object({
  questionText: z
    .string()
    .min(5, "Question text must be at least 5 characters long"),
  options: z
    .array(z.string().min(1, "Option text cannot be empty"))
    .min(2, "Each question must have at least 2 options")
    .max(6, "Each question can have at most 6 options"),
  correctOptionIndex: z
    .number()
    .min(0, "Correct option index cannot be negative"),
  explanation: z.string().optional(),
  marks: z.number().min(1, "Question marks must be at least 1").optional(),
});

export const addQuestionsSchema = z.object({
  questions: z
    .array(questionItemSchema)
    .min(1, "At least 1 question must be provided"),
});

export const submitExamSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1, "questionId is required"),
        selectedOption: z
          .number()
          .min(0, "selectedOption index cannot be negative"),
      })
    )
    .min(1, "Answers array cannot be empty"),
});
