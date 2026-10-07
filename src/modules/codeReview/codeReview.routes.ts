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

// 2. Get Student's Own Code Review Requests (Student & Admin)
router.get("/my-requests", requireRole("student", "admin"), codeReviewController.getMyRequestsHandler);

// 3. Create Code Review Request (Student)
router.post(
  "/",
  requireRole("student"),
  validate(codeReviewValidation.createCodeReviewSchema),
  codeReviewController.createReviewRequestHandler
);

// 4. Get Single Code Review Request Details by ID
router.get("/:id", codeReviewController.getReviewByIdHandler);

// 5. Update Code Snippet / Details (Student)
router.patch(
  "/:id/snippet",
  requireRole("student"),
  validate(codeReviewValidation.updateCodeSnippetSchema),
  codeReviewController.updateCodeSnippetHandler
);

// 6. Acquire 10-Minute Preview Lock (Mentor)
router.post("/:id/preview", requireRole("mentor", "admin"), codeReviewController.previewLockHandler);

// 7. Claim Code Review Request (Mentor)
router.post("/:id/claim", requireRole("mentor", "admin"), codeReviewController.claimReviewRequestHandler);

// 8. Submit Review Feedback Delivery (Mentor)
router.post(
  "/:id/submit",
  requireRole("mentor", "admin"),
  validate(codeReviewValidation.submitCodeReviewSchema),
  codeReviewController.submitReviewHandler
);

// 9. Approve & Release 100% Escrow Credits to Mentor (Student / Admin)
router.post("/:id/approve", requireRole("student", "admin"), codeReviewController.approveAndReleaseHandler);

// 10. Cancel Unclaimed Request & Refund Student (Student)
router.post("/:id/cancel", requireRole("student"), codeReviewController.cancelReviewRequestHandler);

export default router;

