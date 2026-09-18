/**
 * @file src/modules/programSession/programSession.routes.ts
 * @description Express routes for Program Sessions.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { programSessionController } from "./programSession.controller.js";
import {
  createSessionSchema,
  updateSessionSchema,
  bookSessionSchema,
} from "./programSession.validation.js";

const router = Router();

// Add session to a program (Mentor only)
router.post(
  "/program/:programId",
  requireAuth,
  requireRole("mentor"),
  validate(createSessionSchema),
  programSessionController.addSessionToProgram,
);

// Update session details (Mentor only)
router.patch(
  "/:sessionId",
  requireAuth,
  requireRole("mentor"),
  validate(updateSessionSchema),
  programSessionController.updateSession,
);

// Delete session (Mentor only)
router.delete(
  "/:sessionId",
  requireAuth,
  requireRole("mentor"),
  programSessionController.deleteSession,
);

// Book / schedule a session (Student only - accepts mentor schedule)
router.post(
  "/:sessionId/book",
  requireAuth,
  requireRole("student"),
  validate(bookSessionSchema),
  programSessionController.bookSession,
);

// Cancel a session
router.post(
  "/:sessionId/cancel",
  requireAuth,
  programSessionController.cancelSession,
);

export default router;
