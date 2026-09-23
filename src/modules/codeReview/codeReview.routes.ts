import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { codeReviewController } from "./codeReview.controller.js";
import { codeReviewValidation } from "./codeReview.validation.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// 1. Browse Open Pool (Mentors & Admin)
router.get("/pool", requireRole("mentor", "admin"), codeReviewController.getOpenPoolHandler);

// 2. Create Code Review Request (Student)
router.post(
  "/",
  requireRole("student"),
  validate(codeReviewValidation.createCodeReviewSchema),
  codeReviewController.createReviewRequestHandler
);

// 3. Update Code Snippet / Details (Student)
router.patch(
  "/:id/snippet",
  requireRole("student"),
  validate(codeReviewValidation.updateCodeSnippetSchema),
  codeReviewController.updateCodeSnippetHandler
);

// 4. Acquire 10-Minute Preview Lock (Mentor)
router.post("/:id/preview", requireRole("mentor", "admin"), codeReviewController.previewLockHandler);

// 5. Claim Code Review Request (Mentor)
router.post("/:id/claim", requireRole("mentor", "admin"), codeReviewController.claimReviewRequestHandler);

// 6. Submit Review Feedback Delivery (Mentor)
router.post(
  "/:id/submit",
  requireRole("mentor", "admin"),
  validate(codeReviewValidation.submitCodeReviewSchema),
  codeReviewController.submitReviewHandler
);

// 7. Approve & Release 100% Escrow Credits to Mentor (Student / Admin)
router.post("/:id/approve", requireRole("student", "admin"), codeReviewController.approveAndReleaseHandler);

// 8. Cancel Unclaimed Request & Refund Student (Student)
router.post("/:id/cancel", requireRole("student"), codeReviewController.cancelReviewRequestHandler);

export default router;
