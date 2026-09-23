/**
 * @file src/app.ts
 * @description Express Application Configuration
 *
 * Creates and configures the Express app:
 *  1. Global security & parsing middlewares (helmet, cors, json, urlencoded)
 *  2. General rate limiter
 *  3. API v1 router mounted at /api/v1
 *  4. 404 handler → global error handler (must be last)
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { generalLimiter } from "./middlewares/rateLimiter.middleware.js";
import { notFoundHandler } from "./middlewares/notFound.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import v1Router from "./routes/v1/index.js";

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      env.CLIENT_URL,
      "http://localhost:5000",
      "http://localhost:3000",
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(generalLimiter);

// ── Root route ────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to Kōdex API",
    data: { name: "Kōdex API", version: "1.0.0", docs: "/api/v1/health" },
  });
});

// ── Better Auth routes (must be before v1Router — needs full req.url) ───────────
app.all("/api/v1/auth/*splat", (req, _res, next) => {
  if (!req.headers.origin) {
    req.headers.origin = env.CLIENT_URL || env.BETTER_AUTH_URL || "http://localhost:5000";
  }
  next();
}, toNodeHandler(auth));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/v1", v1Router);

// ── 404 & global error handler (ORDER MATTERS — must be last) ─────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
