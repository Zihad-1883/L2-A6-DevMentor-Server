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


// 2. bKash Callback Handler
const bkashCallbackHandler = catchAsync(async (req: Request, res: Response) => {
  const paymentID = (req.query.paymentID || req.body?.paymentID || req.query.paymentId || req.body?.paymentId) as string;
  const status = ((req.query.status || req.body?.status || "") as string).toLowerCase();

  let executionResult: any = null;
  let executionError: string | null = null;

  try {
    if (paymentID && status) {
      executionResult = await paymentService.executePaymentAndTopUp(paymentID, status);
    }
  } catch (err: any) {
    console.error("bKash Callback Processing Error:", err.message || err);
    executionError = err.message || "Payment execution failed";
  }

  const wantsJson =
    req.query.json === "true" ||
    req.headers.accept?.includes("application/json") ||
    req.headers["user-agent"]?.includes("Postman");

  if (wantsJson) {
    if (executionError) {
      return res.status(400).json({
        success: false,
        message: executionError,
        data: null,
      });
    }
    return sendSuccess(
      res,
      executionResult?.message || "Payment processed successfully",
      executionResult,
      200
    );
  }

  // Determine client base URL
  const clientBase = (env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");

  // Fallback to test-client only if explicitly opted in or in local development with no frontend configured
  const useTestClient =
    req.query.testClient === "true" ||
    (env.NODE_ENV === "development" && env.CLIENT_URL.includes("5500"));

  if (useTestClient) {
    const redirectUrl = `http://localhost:5500/test-client/index.html?paymentID=${paymentID || ""}&status=${status || "unknown"}`;
    return res.redirect(redirectUrl);
  }

  // Extract transaction ID if available from executionResult
  const trxID =
    executionResult?.payment?.trxID ||
    (req.query.trxID as string) ||
    (req.query.trxId as string) ||
    "";

  // Route to dedicated client status pages: /payment/success, /payment/cancel, /payment/fail
  let redirectUrl: string;
  if (status === "success" && !executionError) {
    const params = new URLSearchParams();
    if (paymentID) params.set("paymentID", paymentID);
    if (trxID) params.set("trxID", trxID);
    redirectUrl = `${clientBase}/payment/success${params.toString() ? `?${params.toString()}` : ""}`;
  } else if (status === "cancel") {
    const params = new URLSearchParams();
    if (paymentID) params.set("paymentID", paymentID);
    redirectUrl = `${clientBase}/payment/cancel${params.toString() ? `?${params.toString()}` : ""}`;
  } else {
    // failure or executionError
    const params = new URLSearchParams();
    if (paymentID) params.set("paymentID", paymentID);
    if (executionError) params.set("error", executionError);
    redirectUrl = `${clientBase}/payment/fail${params.toString() ? `?${params.toString()}` : ""}`;
  }

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
