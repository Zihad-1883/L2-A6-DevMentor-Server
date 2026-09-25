import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createExamSchema,
  addQuestionsSchema,
} from "./exam.validation.js";
import { examController } from "./exam.controller.js";

const router = Router();

// ==========================================
// 👨‍🏫 MENTOR EXAM MANAGEMENT ROUTES
// ==========================================

// 1. Create a new Exam (DRAFT mode)
router.post(
  "/",
  requireAuth,
  requireRole("mentor"),
  validate(createExamSchema),
  examController.createExamController
);

// 2. Add / Bulk Upload Questions to an Exam
router.post(
  "/:examId/questions",
  requireAuth,
  requireRole("mentor"),
  validate(addQuestionsSchema),
  examController.addQuestionsController
);

// 3. Publish an Exam (Make active for students)
router.patch(
  "/:examId/publish",
  requireAuth,
  requireRole("mentor"),
  examController.publishExamController
);

// 4. Get Mentor's Created Exams List
router.get(
  "/mentor/my-exams",
  requireAuth,
  requireRole("mentor"),
  examController.getMentorExamsController
);

export const examRoutes = router;
