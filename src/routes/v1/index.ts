import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { paymentController } from "../../modules/payment/payment.controller.js";

const v1Router = Router();

// Root / Health check & bKash Fallback Callback (Supports GET & POST)
v1Router.all("/", (req, res, next) => {
  if (req.query.paymentID || req.body?.paymentID) {
    return paymentController.bkashCallbackHandler(req, res, next);
  }
  res.json({ success: true, message: "Kōdex API v1 root endpoint", data: null });
});

v1Router.get("/health", (_req, res) => {
  res.json({ success: true, message: "Kōdex API v1 is up and running 🚀", data: null });
});

// Auth & RBAC Testing Routes 
// Protected route for any authenticated user
v1Router.get(
  "/test/protected",
  requireAuth,
  catchAsync(async (req, res) => {
    sendSuccess(res, "Authenticated user verified successfully", req.user);
  })
);

// Admin-only route
v1Router.get(
  "/test/admin-only",
  requireAuth,
  requireRole("admin"),
  catchAsync(async (req, res) => {
    sendSuccess(res, "Admin access granted", req.user);
  })
);

// Module routes
import sprintRouter from "../../modules/sprint/sprint.routes.js";
import sprintSessionRouter from "../../modules/sprintSession/sprintSession.routes.js";
import cohortRouter from "../../modules/cohort/cohort.routes.js";
import cohortSessionRouter from "../../modules/cohortSession/cohortSession.routes.js";
import mentorRouter from "../../modules/mentor/mentor.routes.js";
import userRouter from "../../modules/user/user.routes.js";
import enrollmentRouter from "../../modules/enrollment/enrollment.routes.js";
import uploadRouter from "../../modules/upload/upload.routes.js";
import adminRouter from "../../modules/admin/admin.routes.js";
import { paymentRoutes } from "../../modules/payment/payment.routes.js";
import codeReviewRouter from "../../modules/codeReview/codeReview.routes.js";
import { examRoutes } from "../../modules/exam/exam.routes.js";
import { expireAbandonedPayments } from "../../jobs/cron.js";

v1Router.use("/sprints", sprintRouter);
v1Router.use("/sprint-sessions", sprintSessionRouter);
v1Router.use("/cohorts", cohortRouter);
v1Router.use("/cohort-sessions", cohortSessionRouter);
v1Router.use("/mentors", mentorRouter);
v1Router.use("/users", userRouter);
v1Router.use("/enrollments", enrollmentRouter);
v1Router.use("/upload", uploadRouter);
v1Router.use("/admin", adminRouter);
v1Router.use("/payments", paymentRoutes);
v1Router.use("/code-reviews", codeReviewRouter);
v1Router.use("/exams", examRoutes);

// Vercel Cron Job Automated Endpoint
v1Router.get(
  "/cron/cleanup-payments",
  catchAsync(async (req, res) => {
    await expireAbandonedPayments();
    sendSuccess(res, "Vercel Cron: Abandoned payments cleanup completed successfully");
  })
);

export default v1Router;
