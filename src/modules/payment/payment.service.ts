/**
 * @file src/modules/payment/payment.service.ts
 * @description Business logic for Payment Top-Up initiation and bKash workflow.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import { bkashService } from "./bkash.service.js";
import type { IInitiateTopUpInput } from "./payment.interface.js";

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

export const paymentService = {
  initiateTopUp,
};
