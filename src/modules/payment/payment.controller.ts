import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { paymentService } from "./payment.service.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";


// 1. Initiate Top-Up
const initiateTopUpHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await paymentService.initiateTopUp(userId, req.body);

  sendSuccess(res, "bKash payment checkout session created successfully", result, 201);
});


// 2. bKash Callback Redirect Handler (Supports GET & POST)
const bkashCallbackHandler = catchAsync(async (req: Request, res: Response) => {
  const paymentID = (req.query.paymentID || req.body?.paymentID || req.query.paymentId || req.body?.paymentId) as string;
  const status = (req.query.status || req.body?.status) as string;

  try {
    if (paymentID && status) {
      await paymentService.executePaymentAndTopUp(paymentID, status);
    }
  } catch (err: any) {
    console.error("bKash Callback Processing Error:", err.message || err);
  }

  const redirectUrl = env.NODE_ENV === "development"
    ? `http://localhost:5500/test-client/index.html?paymentID=${paymentID || ""}&status=${status || "unknown"}`
    : `${env.CLIENT_URL}/payment/status?paymentID=${paymentID || ""}&status=${status || "unknown"}`;

  return res.redirect(redirectUrl);
});


// 3. Get User Wallet & Transactions
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

  const responseData = wallet
    ? {
        ...wallet,
        equivalentBDT: wallet.balance * 4,
      }
    : {
        userId,
        balance: 0,
        equivalentBDT: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        transactions: [],
      };

  sendSuccess(res, "User wallet and transactions retrieved successfully", responseData, 200);
});


// 4. Get Payment Invoice History
const getPaymentHistoryHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  sendSuccess(res, "Payment transaction history retrieved successfully", payments, 200);
});


// 5. Request bKash Cash-Out Withdrawal
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
