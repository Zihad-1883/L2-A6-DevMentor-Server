import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { scheduleSprintSessionSchema } from "./sprintSession.validation.js";
import { sprintSessionController } from "./sprintSession.controller.js";

const router = Router();

// Get all sessions for a specific sprint request
router.get(
    "/sprint/:sprintId",
    requireAuth,
    sprintSessionController.getSprintSessionsBySprintId
);

// Mentor proposes time slot & meeting join link (supports PATCH or POST)
router.patch(
    "/:sessionId/propose",
    requireAuth,
    requireRole("mentor"),
    validate(scheduleSprintSessionSchema),
    sprintSessionController.proposeSprintSessionSlot
);

router.post(
    "/:sessionId/propose",
    requireAuth,
    requireRole("mentor"),
    validate(scheduleSprintSessionSchema),
    sprintSessionController.proposeSprintSessionSlot
);

// Student confirms session slot & deducts credits
router.post(
    "/:sessionId/confirm",
    requireAuth,
    requireRole("student"),
    sprintSessionController.confirmSprintSession
);

// Complete session & release credits
router.post(
    "/:sessionId/complete",
    requireAuth,
    sprintSessionController.completeSprintSession
);

// Cancel session (enforces 1-hour refund cutoff rule)
router.post(
    "/:sessionId/cancel",
    requireAuth,
    sprintSessionController.cancelSprintSession
);

export default router;
