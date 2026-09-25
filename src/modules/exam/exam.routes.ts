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

// ==========================================
// 👨‍🏫 MENTOR EXAM MANAGEMENT ROUTES
// ==========================================

// 5. Create a new Exam (DRAFT mode)
router.post(
  "/",
  requireAuth,
  requireRole("mentor"),
  validate(createExamSchema),
  examController.createExamController
);

// 6. Add / Bulk Upload Questions to an Exam
router.post(
  "/:examId/questions",
  requireAuth,
  requireRole("mentor"),
  validate(addQuestionsSchema),
  examController.addQuestionsController
);

// 7. Publish an Exam (Make active for students)
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

// ==========================================
// 👨‍🎓 STUDENT EXAM PARTICIPATION ROUTES
// ==========================================

// 1. Browse Available Exams (Free public + enrolled cohort/sprint exams)
router.get(
  "/",
  requireAuth,
  requireRole("student"),
  examController.getAvailableExamsController
);

// 2. View Past Exam Attempt History
router.get(
  "/me/attempts",
  requireAuth,
  requireRole("student"),
  examController.getStudentAttemptsController
);

// 3. Start an Exam (Receives sanitized questions without correct answers)
router.get(
  "/:examId/start",
  requireAuth,
  requireRole("student"),
  examController.startExamAttemptController
);

// 4. Submit Exam Answers & Get Auto-Graded Result
router.post(
  "/:examId/submit",
  requireAuth,
  requireRole("student"),
  validate(submitExamSchema),
  examController.submitExamAttemptController
);

export const examRoutes = router;

