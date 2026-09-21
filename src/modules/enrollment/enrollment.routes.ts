/**
 * @file src/modules/enrollment/enrollment.routes.ts
 * @description Express routes for student cohort and sprint enrollment queries.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { enrollmentController } from "./enrollment.controller.js";

const router = Router();

// All enrollment query routes require authentication
router.use(requireAuth);

router.get("/my-cohorts", enrollmentController.getMyEnrolledCohorts);
router.get("/my-sprints", enrollmentController.getMyEnrolledSprints);

export default router;

