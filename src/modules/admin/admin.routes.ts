import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { adminController } from "./admin.controller.js";
import {
  approveMentorSchema,
  toggleUserBlockSchema,
  approveCohortSchema,
  updatePlatformSettingSchema,
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

// Cohort submissions listing for admin queue
router.get("/cohorts", adminController.getAllCohorts);

// Platform overview analytics & financial stats
router.get("/stats", adminController.getPlatformStats);

// Platform configuration & commission settings
router.get("/settings", adminController.getPlatformSettings);
router.patch(
  "/settings",
  validate(updatePlatformSettingSchema),
  adminController.updatePlatformSettings,
);

export default router;


