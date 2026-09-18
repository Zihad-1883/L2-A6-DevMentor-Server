/**
 * @file src/routes/v1/index.ts
 * @description Master API Router — v1
 *
 * All module routers are mounted here under /api/v1.
 * Add new module routes in this file as the platform grows.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";

const v1Router = Router();

// ── Health check ──────────────────────────────────────────────────────────────
v1Router.get("/health", (_req, res) => {
  res.json({ success: true, message: "Kōdex API v1 is up and running 🚀", data: null });
});

// ── Auth & RBAC Testing Routes ────────────────────────────────────────────────
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

// ── Module routes (add as features are built) ─────────────────────────────────
// import userRouter   from "../../modules/user/user.routes.js";
// v1Router.use("/users", userRouter);

export default v1Router;
