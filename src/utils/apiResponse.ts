import type { Response } from "express";

// Sends a standardized success response matching the required format:
// { success: true, message: "...", data: {} }
//
// Usage:
//   sendSuccess(res, "User created", newUser, 201);
//   sendSuccess(res, "Users fetched", { users, pagination });

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data: T = null as T,
  statusCode: number = 200,
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};
