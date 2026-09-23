/**
 * @file src/modules/payment/bkash.service.ts
 * @description HTTP Service Integration for bKash Tokenized Checkout API v1.2.0-beta.
 */

import { env } from "../../config/env.js";
import { bkashTokenCache } from "../../config/redis.js";
import { AppError } from "../../utils/apiError.js";
import type {
  IBKashGrantTokenResponse,
  IBKashCreatePaymentInput,
  IBKashCreatePaymentResponse,
  IBKashExecutePaymentResponse,
  IBKashQueryPaymentResponse,
} from "./payment.interface.js";

/**
 * 1. Grant Token (Smart Redis Cache Manager)
 * - Checks Upstash Redis RAM cache for an active id_token.
 * - If cache hit, returns token immediately (0ms DB delay).
 * - If cache miss, requests a new id_token from bKash PGW API & caches it for 59 minutes (3540s).
 */
const grantToken = async (): Promise<string> => {
  // 1. Check Upstash Redis RAM cache
  const cachedToken = await bkashTokenCache.get();
  if (cachedToken) {
    return cachedToken;
  }

  // 2. Fetch fresh token from bKash API
  const response = await fetch(`${env.BKASH_BASE_URL}/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username: env.BKASH_USERNAME,
      password: env.BKASH_PASSWORD,
    },
    body: JSON.stringify({
      app_key: env.BKASH_APP_KEY,
      app_secret: env.BKASH_APP_SECRET,
    }),
  });

  const data = (await response.json()) as IBKashGrantTokenResponse;

  if (!response.ok || data.statusCode !== "0000" || !data.id_token) {
    throw new AppError(
      `bKash authentication failed: ${data.statusMessage || "Invalid grant token response"}`,
      500
    );
  }

  // 3. Cache the token in Redis for 3540s (59 minutes)
  await bkashTokenCache.set(data.id_token);

  return data.id_token;
};

/**
 * 2. Create Payment Intent
 * - Requests a new payment session from bKash PGW API.
 */
const createPayment = async (
  payload: IBKashCreatePaymentInput
): Promise<IBKashCreatePaymentResponse> => {
  const token = await grantToken();

  const response = await fetch(`${env.BKASH_BASE_URL}/checkout/payment/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": env.BKASH_APP_KEY,
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: payload.payerReference || "DevMentorStudent",
      callbackURL: env.BKASH_CALLBACK_URL,
      amount: String(payload.amount),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: payload.merchantInvoiceNumber,
    }),
  });

  const data = (await response.json()) as IBKashCreatePaymentResponse;

  if (!response.ok || data.statusCode !== "0000" || !data.paymentID) {
    throw new AppError(
      `bKash payment creation failed: ${data.statusMessage || "Unable to generate bKash checkout session"}`,
      400
    );
  }

  return data;
};

/**
 * 3. Execute Payment Settlement
 * - Finalizes payment settlement after customer authorizes via OTP & PIN.
 */
const executePayment = async (
  paymentID: string
): Promise<IBKashExecutePaymentResponse> => {
  const token = await grantToken();

  const response = await fetch(`${env.BKASH_BASE_URL}/checkout/payment/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": env.BKASH_APP_KEY,
    },
    body: JSON.stringify({ paymentID }),
  });

  const data = (await response.json()) as IBKashExecutePaymentResponse;

  if (!response.ok || (data.statusCode !== "0000" && data.statusCode !== "2018")) {
    throw new AppError(
      `bKash payment execution failed: ${data.statusMessage || "Payment execution declined"}`,
      400
    );
  }

  return data;
};

/**
 * 4. Query Payment Status
 * - Queries status of a specific paymentID.
 */
const queryPayment = async (
  paymentID: string
): Promise<IBKashQueryPaymentResponse> => {
  const token = await grantToken();

  const response = await fetch(`${env.BKASH_BASE_URL}/checkout/payment/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": env.BKASH_APP_KEY,
    },
    body: JSON.stringify({ paymentID }),
  });

  const data = (await response.json()) as IBKashQueryPaymentResponse;
  return data;
};

export const bkashService = {
  grantToken,
  createPayment,
  executePayment,
  queryPayment,
};
