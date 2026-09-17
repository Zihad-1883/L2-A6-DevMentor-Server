/**
 * @file src/routes/v1/index.ts
 * @description Master API Router — v1
 *
 * All module routers are mounted here under /api/v1.
 * Add new module routes in this file as the platform grows.
 */

import { Router } from "express";

const v1Router = Router();

// ── Health check ──────────────────────────────────────────────────────────────
v1Router.get("/health", (_req, res) => {
  res.json({ success: true, message: "Kōdex API v1 is up and running 🚀" });
});

// ── Module routes (add as features are built) ─────────────────────────────────
// import authRouter   from "../../modules/auth/auth.routes.js";
// import userRouter   from "../../modules/user/user.routes.js";
// v1Router.use("/auth",  authRouter);
// v1Router.use("/users", userRouter);

export default v1Router;
