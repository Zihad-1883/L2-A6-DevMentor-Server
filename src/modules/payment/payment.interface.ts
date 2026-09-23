/**
 * @file src/modules/payment/payment.interface.ts
 * @description DTOs and Interfaces for bKash Payment Gateway integration and Wallet operations.
 */

export interface IBKashGrantTokenResponse {
  statusCode: string;
  statusMessage: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface IBKashCreatePaymentInput {
  amount: number;
  merchantInvoiceNumber: string;
  payerReference?: string;
}

export interface IBKashCreatePaymentResponse {
  statusCode: string;
  statusMessage: string;
  paymentID: string;
  bkashURL: string;
  callbackURL: string;
  successCallbackURL: string;
  failureCallbackURL: string;
  cancelledCallbackURL: string;
  amount: string;
  intent: string;
  currency: string;
  paymentCreateTime: string;
  transactionStatus: string;
  merchantInvoiceNumber: string;
}

export interface IBKashExecutePaymentResponse {
  statusCode: string;
  statusMessage: string;
  paymentID: string;
  payerReference: string;
  customerMsisdn: string;
  trxID: string;
  amount: string;
  transactionStatus: string;
  paymentExecuteTime: string;
  currency: string;
  intent: string;
  merchantInvoiceNumber: string;
}

export interface IBKashQueryPaymentResponse {
  statusCode: string;
  statusMessage: string;
  paymentID: string;
  trxID: string;
  amount: string;
  transactionStatus: string;
  verificationStatus: string;
  intent: string;
  currency: string;
  merchantInvoiceNumber: string;
}

export interface IInitiateTopUpInput {
  amount: number;
}

export interface IRequestWithdrawalInput {
  amount: number;
  bkashNumber: string;
}
