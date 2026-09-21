/**
 * @file src/modules/admin/admin.routes.ts
 * @description Express routes for platform administration, user management, and mentor/cohort approvals.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { adminController } from "./admin.controller.js";
import {
  approveMentorSchema,
  toggleUserBlockSchema,
  approveCohortSchema,
} from "./admin.validation.js";

const router = Router();

// All admin endpoints require authentication and 'admin' role
router.use(requireAuth, requireRole("admin"));

// Mentor approval management
router.patch(
  "/mentors/:id/approve",
  validate(approveMentorSchema),
  adminController.approveOrRejectMentor,
);

// User account block toggling
router.patch(
  "/users/:id/block",
  validate(toggleUserBlockSchema),
  adminController.toggleUserBlock,
);

// User directory listing with search & filters
router.get("/users", adminController.getAllUsers);

// Cohort program approval management
router.patch(
  "/cohorts/:id/approve",
  validate(approveCohortSchema),
  adminController.approveOrRejectCohort,
);

export default router;

