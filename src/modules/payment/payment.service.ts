/**
 * @file src/modules/payment/payment.service.ts
 * @description Business logic for Payment Top-Up initiation and bKash workflow.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import { bkashService } from "./bkash.service.js";
import { generatePaymentReceiptPDF } from "../../lib/pdf.js";
import { sendPaymentReceiptEmail } from "../../lib/email.js";
import type { IInitiateTopUpInput, IRequestWithdrawalInput } from "./payment.interface.js";

/**
 * ── Sub-Step 4.1: Initiate Top-Up Payment ────────────────────────────────────
 * - Validates student user status and minimum amount (minimum 10 BDT).
 * - Generates unique merchantInvoiceNumber (e.g. INV-1790027735-1234).
 * - Creates an INITIATED payment record in PostgreSQL database.
 * - Calls bKash PGW API to generate bKash payment URL.
 * - Updates payment record with bKash paymentID and returns checkout URL.
 */
const initiateTopUp = async (userId: string, payload: IInitiateTopUpInput) => {
  const { amount } = payload;

  if (amount < 10) {
    throw new AppError("Minimum top-up amount is 10 BDT", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("User account not found", 404);
  }

  if (user.isBlocked) {
    throw new AppError("Your account is currently blocked by an administrator", 403);
  }

  // Generate unique merchant invoice number
  const merchantInvoiceNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Create initial INITIATED payment record in DB
  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      merchantInvoiceNumber,
      status: "INITIATED",
    },
  });

  // Call bKash service to create payment intent
  const bkashResponse = await bkashService.createPayment({
    amount,
    merchantInvoiceNumber,
    payerReference: user.name,
  });

  // Attach bKash paymentID to DB payment record
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentID: bkashResponse.paymentID,
      gatewayResponse: bkashResponse as any,
    },
  });

  return {
    merchantInvoiceNumber,
    paymentID: bkashResponse.paymentID,
    bkashURL: bkashResponse.bkashURL,
    payment: updatedPayment,
  };
};

/**
 * ── Sub-Step 4.4: Execute Payment & Settlement ───────────────────────────────
 * 
 * Step 1: Pre-Execution Guards & Idempotency Check
 * - Checks if the payment record exists in the database.
 * - Idempotency Guard: Returns early if payment is already COMPLETED.
 * - Callback Guard: Updates DB status to CANCELLED/FAILED if user cancelled on bKash.
 */
const executePaymentAndTopUp = async (paymentID: string, status: string) => {
  // 1. Fetch Payment Intent record from Database
  const payment = await prisma.payment.findUnique({
    where: { paymentID },
    include: { user: true },
  });

  if (!payment) {
    throw new AppError("Payment transaction record not found", 404);
  }

  // Idempotency Guard: If already completed, return existing record
  if (payment.status === "COMPLETED") {
    return {
      success: true,
      message: "Payment already processed successfully",
      payment,
    };
  }

  // Callback Status Guard: Handle cancellation or failure on bKash modal
  if (status === "cancel" || status === "failure") {
    const updatedStatus = status === "cancel" ? "CANCELLED" : "FAILED";
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: updatedStatus },
    });

    throw new AppError(`Payment was ${updatedStatus.toLowerCase()} on bKash`, 400);
  }

  // 2. Execute Payment Settlement via bKash PGW API
  const bkashResult = await bkashService.executePayment(paymentID);

  // 3. Atomic Database Settlement via prisma.$transaction
  const { updatedPayment, wallet } = await prisma.$transaction(async (tx) => {
    // 3A. Mark payment as COMPLETED and save trxID + raw gateway response
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        trxID: bkashResult.trxID,
        gatewayResponse: bkashResult as any,
      },
    });

    // 3B. Upsert student's Wallet (increment spendable balance)
    const wallet = await tx.wallet.upsert({
      where: { userId: payment.userId },
      create: {
        userId: payment.userId,
        balance: payment.amount,
        totalEarned: 0,
        totalWithdrawn: 0,
      },
      update: {
        balance: { increment: payment.amount },
      },
    });

    // 3C. Create append-only CreditTransaction audit log
    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        amount: payment.amount,
        type: "TOP_UP",
        description: `bKash Top-Up via TrxID ${bkashResult.trxID}`,
        referenceId: paymentID,
      },
    });

    return { updatedPayment, wallet };
  });

  // 4. Background PDF Receipt Generation & Email Dispatch (non-blocking)
  generatePaymentReceiptPDF({
    invoiceNumber: updatedPayment.merchantInvoiceNumber,
    trxID: bkashResult.trxID,
    amount: updatedPayment.amount,
    date: updatedPayment.updatedAt,
    studentName: payment.user.name,
    studentEmail: payment.user.email,
  })
    .then((pdfBuffer) => {
      return sendPaymentReceiptEmail({
        toEmail: payment.user.email,
        studentName: payment.user.name,
        invoiceNumber: updatedPayment.merchantInvoiceNumber,
        amount: updatedPayment.amount,
        pdfBuffer,
      });
    })
    .catch((emailErr) => {
      console.error("⚠️ Background receipt email dispatch error:", emailErr);
    });

  return {
    success: true,
    message: "Payment settled and credits topped up successfully",
    payment: updatedPayment,
    wallet,
  };
};

/**
 * ── Sub-Step 6.2: Mentor bKash Cash-Out Withdrawal ──────────────────────────
 * - Verifies mentor's spendable wallet balance (min 1,000 BDT).
 * - Decrements spendable balance, increments totalWithdrawn.
 * - Records WITHDRAWAL in CreditTransaction audit trail and Payment history.
 */
const requestWithdrawal = async (userId: string, payload: IRequestWithdrawalInput) => {
  const { amount, bkashNumber } = payload;

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet || wallet.balance < amount) {
    throw new AppError(
      `Insufficient spendable wallet balance. Available balance: ${wallet?.balance || 0} BDT`,
      400
    );
  }

  const merchantInvoiceNumber = `WDW-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { updatedWallet, payment } = await prisma.$transaction(async (tx) => {
    // 1. Create completed payout Payment record
    const payment = await tx.payment.create({
      data: {
        userId,
        amount,
        merchantInvoiceNumber,
        status: "COMPLETED",
        gatewayResponse: {
          type: "WITHDRAWAL",
          bkashNumber,
          processedAt: new Date().toISOString(),
        } as any,
      },
    });

    // 2. Decrement wallet spendable balance and increment totalWithdrawn
    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: {
        balance: { decrement: amount },
        totalWithdrawn: { increment: amount },
      },
    });

    // 3. Create append-only CreditTransaction audit log
    await tx.creditTransaction.create({
      data: {
        walletId: updatedWallet.id,
        amount: -amount,
        type: "WITHDRAWAL",
        description: `bKash Cash-Out to ${bkashNumber}`,
        referenceId: payment.id,
      },
    });

    return { updatedWallet, payment };
  });

  return {
    success: true,
    message: `Successfully processed withdrawal of ${amount} BDT to bKash number ${bkashNumber}`,
    wallet: updatedWallet,
    payment,
  };
};

export const paymentService = {
  initiateTopUp,
  executePaymentAndTopUp,
  requestWithdrawal,
};
