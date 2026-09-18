import type { Response } from "express";

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
