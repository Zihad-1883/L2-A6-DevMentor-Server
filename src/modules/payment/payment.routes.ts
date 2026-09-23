/**
 * @file src/modules/payment/payment.routes.ts
 * @description API Routes for Payment Top-Up, bKash Callback, and Wallet details.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { initiateTopUpSchema, requestWithdrawalSchema } from "./payment.validation.js";
import { paymentController } from "./payment.controller.js";

const router = Router();

/**
 * ── 1. Initiate bKash Top-Up (Protected: Student) ───────────────────────────
 * POST /api/v1/payments/top-up
 */
router.post(
  "/top-up",
  requireAuth,
  validate(initiateTopUpSchema),
  paymentController.initiateTopUpHandler
);

/**
 * ── 2. bKash Callback (Public PGW Redirect Endpoint) ───────────────────────
 * GET /api/v1/payments/bkash/callback
 */
router.get("/bkash/callback", paymentController.bkashCallbackHandler);

/**
 * ── 3. Get User Wallet & Transactions (Protected: Student/Mentor) ───────────
 * GET /api/v1/payments/wallet/me
 */
router.get("/wallet/me", requireAuth, paymentController.getWalletHandler);

/**
 * ── 4. Get User Payment Invoices (Protected: Student/Mentor) ────────────────
 * GET /api/v1/payments/history
 */
router.get("/history", requireAuth, paymentController.getPaymentHistoryHandler);

/**
 * ── 5. Mentor bKash Cash-Out Withdrawal (Protected: Mentor) ────────────────
 * POST /api/v1/payments/withdraw
 */
router.post(
  "/withdraw",
  requireAuth,
  requireRole("mentor"),
  validate(requestWithdrawalSchema),
  paymentController.requestWithdrawalHandler
);

export const paymentRoutes = router;
