import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { initiateTopUpSchema, requestWithdrawalSchema } from "./payment.validation.js";
import { paymentController } from "./payment.controller.js";

const router = Router();

// 1. Initiate bKash Top-Up (Students Only)
router.post(
  "/top-up",
  requireAuth,
  requireRole("student"),
  validate(initiateTopUpSchema),
  paymentController.initiateTopUpHandler
);


// 2. bKash Callback (Supports GET & POST with multiple route aliases)
router.get("/bkash/callback", paymentController.bkashCallbackHandler);
router.post("/bkash/callback", paymentController.bkashCallbackHandler);
router.get("/status", paymentController.bkashCallbackHandler);
router.post("/status", paymentController.bkashCallbackHandler);
router.get("/callback", paymentController.bkashCallbackHandler);
router.post("/callback", paymentController.bkashCallbackHandler);

// 3. Get User Wallet & Transactions
router.get("/wallet/me", requireAuth, paymentController.getWalletHandler);

// 4. Get User Payment Invoices
router.get("/history", requireAuth, paymentController.getPaymentHistoryHandler);

// 5. Mentor / Admin bKash Cash-Out Withdrawal
router.post(
  "/withdraw",
  requireAuth,
  requireRole("mentor", "admin"),
  validate(requestWithdrawalSchema),
  paymentController.requestWithdrawalHandler
);

export const paymentRoutes = router;
