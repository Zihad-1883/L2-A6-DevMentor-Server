import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createExamSchema,
  addQuestionsSchema,
  submitExamSchema,
} from "./exam.validation.js";
import { examController } from "./exam.controller.js";

const router = Router();

// Create a new Exam (DRAFT mode)
router.post(
  "/",
  requireAuth,
  requireRole("mentor"),
  validate(createExamSchema),
  examController.createExamController
);

// Add / Bulk Upload Questions to an Exam
router.post(
  "/:examId/questions",
  requireAuth,
  requireRole("mentor"),
  validate(addQuestionsSchema),
  examController.addQuestionsController
);

// Publish an Exam
router.patch(
  "/:examId/publish",
  requireAuth,
  requireRole("mentor"),
  examController.publishExamController
);

// 8. Get Mentor's Created Exams List
router.get(
  "/mentor/my-exams",
  requireAuth,
  requireRole("mentor"),
  examController.getMentorExamsController
);


// Browse Available Exams
router.get(
  "/",
  requireAuth,
  requireRole("student"),
  examController.getAvailableExamsController
);

// View Past Exam Attempt History
router.get(
  "/me/attempts",
  requireAuth,
  requireRole("student"),
  examController.getStudentAttemptsController
);

// Start an Exam
router.get(
  "/:examId/start",
  requireAuth,
  requireRole("student"),
  examController.startExamAttemptController
);

// Submit Exam Answers & Get Auto-Graded Result
router.post(
  "/:examId/submit",
  requireAuth,
  requireRole("student"),
  validate(submitExamSchema),
  examController.submitExamAttemptController
);

export const examRoutes = router;

