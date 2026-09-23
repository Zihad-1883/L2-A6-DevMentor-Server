/**
 * @file src/modules/payment/payment.controller.ts
 * @description HTTP Controllers for Payment Top-Up, bKash Callback Redirects, and Wallet details.
 */

import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { paymentService } from "./payment.service.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

/**
 * 1. Initiate Top-Up (POST /api/v1/payments/top-up)
 */
const initiateTopUpHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await paymentService.initiateTopUp(userId, req.body);

  sendSuccess(res, "bKash payment checkout session created successfully", result, 201);
});

/**
 * 2. bKash Callback Redirect Handler (GET /api/v1/payments/bkash/callback)
 * - Called by bKash PGW when user completes/cancels payment in bKash modal.
 * - Executes settlement in DB, then redirects user browser to CLIENT_URL.
 */
const bkashCallbackHandler = catchAsync(async (req: Request, res: Response) => {
  const { paymentID, status } = req.query as { paymentID: string; status: string };

  try {
    if (paymentID && status) {
      await paymentService.executePaymentAndTopUp(paymentID, status);
    }
  } catch (err: any) {
    console.error("⚠️ bKash Callback Processing Error:", err.message || err);
  }

  // Redirect student's browser back to client app frontend status page
  const redirectUrl = `${env.CLIENT_URL}/payment/status?paymentID=${paymentID || ""}&status=${status || "unknown"}`;
  return res.redirect(redirectUrl);
});

/**
 * 3. Get User Wallet & Transactions (GET /api/v1/payments/wallet/me)
 */
const getWalletHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  const responseData = wallet || {
    userId,
    balance: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    transactions: [],
  };

  sendSuccess(res, "User wallet and transactions retrieved successfully", responseData, 200);
});

/**
 * 4. Get Payment Invoice History (GET /api/v1/payments/history)
 */
const getPaymentHistoryHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, "Payment transaction history retrieved successfully", payments, 200);
});

/**
 * 5. Request bKash Cash-Out Withdrawal (POST /api/v1/payments/withdraw)
 */
const requestWithdrawalHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await paymentService.requestWithdrawal(userId, req.body);

  sendSuccess(res, "bKash withdrawal processed successfully", result, 200);
});

export const paymentController = {
  initiateTopUpHandler,
  bkashCallbackHandler,
  getWalletHandler,
  getPaymentHistoryHandler,
  requestWithdrawalHandler,
};
