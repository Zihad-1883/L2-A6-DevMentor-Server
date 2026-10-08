import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  createPayoutRequestSchema,
  processPayoutSchema,
} from "./payout.validation.js";
import { payoutController } from "./payout.controller.js";

const router = Router();

// Mentor Endpoints
// 1. POST /api/v1/payouts - Mentor creates a payout request
router.post(
  "/",
  requireAuth,
  requireRole("mentor", "admin"),
  validate(createPayoutRequestSchema),
  payoutController.createPayoutRequestHandler
);

// 2. GET /api/v1/payouts/my - Mentor views their payout request history
router.get(
  "/my",
  requireAuth,
  requireRole("mentor", "admin"),
  payoutController.getMyPayoutRequestsHandler
);

// Admin Endpoints
// 3. GET /api/v1/payouts/admin - Admin views payout queue
router.get(
  "/admin",
  requireAuth,
  requireRole("admin"),
  payoutController.getAdminPayoutsHandler
);

// 4. PATCH /api/v1/payouts/admin/:id/process - Admin processes payout
router.patch(
  "/admin/:id/process",
  requireAuth,
  requireRole("admin"),
  validate(processPayoutSchema),
  payoutController.processPayoutRequestHandler
);

export default router;
