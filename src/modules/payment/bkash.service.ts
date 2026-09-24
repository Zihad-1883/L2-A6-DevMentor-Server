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


// Helper to ensure header values contain strictly ASCII characters
const sanitizeASCII = (val: string) => (val || "").replace(/[^\x00-\x7F]/g, "").trim();

// Helper to safely parse JSON from bKash API responses (stripping control chars)
const parseBkashJSON = async <T>(response: Response): Promise<T> => {
  const rawText = await response.text();
  try {
    // Replace unescaped control characters in JSON strings
    const sanitized = rawText.replace(/[\x00-\x1F\x7F-\x9F]/g, (match) => {
      if (match === "\n" || match === "\r" || match === "\t") return match;
      return "";
    });
    return JSON.parse(sanitized) as T;
  } catch {
    // If strict JSON.parse failed due to bad control characters in string values, do a full strip
    try {
      const cleaned = rawText.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
      return JSON.parse(cleaned) as T;
    } catch (err) {
      console.error("bKash Invalid JSON Body:", rawText);
      throw new AppError("Failed to parse bKash gateway response", 500);
    }
  }
};

// 1. Grant Token 
const grantToken = async (): Promise<string> => {
  const cachedToken = await bkashTokenCache.get();
  if (cachedToken) {
    return cachedToken;
  }

  // Clean env inputs to remove any non-ASCII characters or control chars
  const username = sanitizeASCII(env.BKASH_USERNAME);
  const password = sanitizeASCII(env.BKASH_PASSWORD);
  const appKey = sanitizeASCII(env.BKASH_APP_KEY);
  const appSecret = sanitizeASCII(env.BKASH_APP_SECRET);

  const response = await fetch(`${env.BKASH_BASE_URL.trim()}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username,
      password,
    },
    body: JSON.stringify({
      app_key: appKey,
      app_secret: appSecret,
    }),
  });

  const data = await parseBkashJSON<IBKashGrantTokenResponse>(response);

  if (!response.ok || data.statusCode !== "0000" || !data.id_token) {
    await bkashTokenCache.clear();
    console.error("❌ bKash Grant Token Response Error:", {
      status: response.status,
      data,
      env: {
        baseUrl: env.BKASH_BASE_URL,
        username,
        appKey: appKey ? `${appKey.substring(0, 5)}...` : undefined,
      },
    });

    throw new AppError(
      `bKash authentication failed: ${data.statusMessage || (data as unknown as Record<string, string>).statusText || "Invalid grant token response"}`,
      500
    );
  }

  await bkashTokenCache.set(data.id_token);

  return data.id_token;
};


// 2. Create Payment Intent
const createPayment = async (
  payload: IBKashCreatePaymentInput
): Promise<IBKashCreatePaymentResponse> => {
  const token = sanitizeASCII(await grantToken());
  const appKey = sanitizeASCII(env.BKASH_APP_KEY);
  const payerRef = sanitizeASCII(payload.payerReference || "DevMentorStudent") || "DevMentorStudent";

  const response = await fetch(`${env.BKASH_BASE_URL.trim()}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": appKey,
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: payerRef,
      callbackURL: env.BKASH_CALLBACK_URL.trim(),
      amount: String(payload.amount),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: payload.merchantInvoiceNumber,
    }),
  });

  const data = await parseBkashJSON<IBKashCreatePaymentResponse>(response);

  if (!response.ok || data.statusCode !== "0000" || !data.paymentID) {
    if (data.statusCode === "2001" || data.statusCode === "2002" || data.statusCode === "9999") {
      await bkashTokenCache.clear();
    }
    console.error("bKash Create Payment Raw Response:", { status: response.status, data });
    throw new AppError(
      `bKash payment creation failed: ${data.statusMessage || "Unable to generate bKash checkout session"}`,
      400
    );
  }

  return data;
};


// 3. Execute Payment Settlement
const executePayment = async (
  paymentID: string
): Promise<IBKashExecutePaymentResponse> => {
  const token = sanitizeASCII(await grantToken());
  const appKey = sanitizeASCII(env.BKASH_APP_KEY);

  const response = await fetch(`${env.BKASH_BASE_URL.trim()}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": appKey,
    },
    body: JSON.stringify({ paymentID }),
  });

  const data = await parseBkashJSON<IBKashExecutePaymentResponse>(response);

  if (!response.ok || (data.statusCode !== "0000" && data.statusCode !== "2018" && data.statusCode !== "2029" && data.statusCode !== "2117")) {
    console.error("bKash Execute Payment Raw Response:", { status: response.status, data });
    throw new AppError(
      `bKash payment execution failed: ${data.statusMessage || "Payment execution declined"}`,
      400
    );
  }

  return data;
};


// 4. Query Payment Status
const queryPayment = async (
  paymentID: string
): Promise<IBKashQueryPaymentResponse> => {
  const token = sanitizeASCII(await grantToken());
  const appKey = sanitizeASCII(env.BKASH_APP_KEY);

  const response = await fetch(`${env.BKASH_BASE_URL.trim()}/tokenized/checkout/payment/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": appKey,
    },
    body: JSON.stringify({ paymentID }),
  });

  const data = await parseBkashJSON<IBKashQueryPaymentResponse>(response);
  return data;
};

export const bkashService = {
  grantToken,
  createPayment,
  executePayment,
  queryPayment,
};
