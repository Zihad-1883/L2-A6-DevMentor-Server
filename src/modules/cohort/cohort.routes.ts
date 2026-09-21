/**
 * @file src/modules/cohort/cohort.routes.ts
 * @description Express routes for Cohort Program operations.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { cohortController } from "./cohort.controller.js";
import { createCohortSchema, updateCohortSchema } from "./cohort.validation.js";

const router = Router();

// Mentor routes (static routes before parameterized /:id)
router.get(
  "/my-created",
  requireAuth,
  requireRole("mentor"),
  cohortController.getMyCreatedCohorts,
);

router.post(
  "/",
  requireAuth,
  requireRole("mentor"),
  validate(createCohortSchema),
  cohortController.createCohort,
);

// Public routes
router.get("/", cohortController.getAllPublishedCohorts);
router.get("/:id", cohortController.getCohortById);

router.patch(
  "/:id",
  requireAuth,
  requireRole("mentor"),
  validate(updateCohortSchema),
  cohortController.updateCohort,
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("mentor"),
  cohortController.deleteCohort,
);

// Student routes
router.post(
  "/:id/register",
  requireAuth,
  requireRole("student"),
  cohortController.registerCohort,
);

export default router;

