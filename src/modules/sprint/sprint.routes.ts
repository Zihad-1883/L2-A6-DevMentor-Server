/**
 * @file src/modules/sprint/sprint.routes.ts
 * @description Express router for Sprint endpoints.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createSprintSchema } from "./sprint.validation.js";
import { sprintController } from "./sprint.controller.js";

const router = Router();

// Public / Protected endpoints
router.get("/open-pool", requireAuth, requireRole("mentor"), sprintController.getOpenSprintPool);
router.get("/my-sprints", requireAuth, sprintController.getUserSprints);
router.get("/:sprintId", requireAuth, sprintController.getSprintById);

// Student endpoints
router.post(
  "/",
  requireAuth,
  requireRole("student"),
  validate(createSprintSchema),
  sprintController.createSprint
);

router.patch(
  "/:sprintId",
  requireAuth,
  requireRole("student"),
  sprintController.updateSprint
);

router.delete(
  "/:sprintId",
  requireAuth,
  requireRole("student"),
  sprintController.deleteSprint
);

// Mentor endpoints
router.post(
  "/:sprintId/claim",
  requireAuth,
  requireRole("mentor"),
  sprintController.claimSprint
);

export default router;
