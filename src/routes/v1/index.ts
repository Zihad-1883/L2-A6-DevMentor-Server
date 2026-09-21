import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";

const v1Router = Router();

// Health check 
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

v1Router.use("/sprints", sprintRouter);
v1Router.use("/sprint-sessions", sprintSessionRouter);
v1Router.use("/cohorts", cohortRouter);
v1Router.use("/cohort-sessions", cohortSessionRouter);

export default v1Router;
