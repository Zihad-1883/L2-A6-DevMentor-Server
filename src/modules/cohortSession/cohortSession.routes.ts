/**
 * @file src/modules/cohortSession/cohortSession.routes.ts
 * @description Express routes for Cohort Group Session operations and resources.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { cohortSessionController } from "./cohortSession.controller.js";
import {
  createCohortSessionSchema,
  updateCohortSessionSchema,
  addSessionResourceSchema,
} from "./cohortSession.validation.js";

const router = Router();

// ── Session Query Route (Public / Authenticated with Gated Access) ───────────
router.get("/cohort/:cohortId", cohortSessionController.getCohortSessions);

// ── Mentor Session Creation & Resource Management Routes ──────────────────────
router.post(
  "/cohort/:cohortId",
  requireAuth,
  requireRole("mentor"),
  validate(createCohortSessionSchema),
  cohortSessionController.addCohortSession,
);

router.patch(
  "/:sessionId",
  requireAuth,
  requireRole("mentor"),
  validate(updateCohortSessionSchema),
  cohortSessionController.updateCohortSession,
);

router.delete(
  "/:sessionId",
  requireAuth,
  requireRole("mentor"),
  cohortSessionController.deleteCohortSession,
);

router.post(
  "/:sessionId/resources",
  requireAuth,
  requireRole("mentor"),
  validate(addSessionResourceSchema),
  cohortSessionController.addSessionResource,
);

router.delete(
  "/:sessionId/resources/:resourceId",
  requireAuth,
  requireRole("mentor"),
  cohortSessionController.removeSessionResource,
);

router.patch(
  "/:sessionId/complete",
  requireAuth,
  requireRole("mentor"),
  cohortSessionController.completeCohortSession,
);

router.patch(
  "/:sessionId/cancel",
  requireAuth,
  requireRole("mentor"),
  cohortSessionController.cancelCohortSession,
);

// ── Student Session Joining Route ─────────────────────────────────────────────
router.post(
  "/:sessionId/join",
  requireAuth,
  requireRole("student"),
  cohortSessionController.joinCohortSession,
);

export default router;

