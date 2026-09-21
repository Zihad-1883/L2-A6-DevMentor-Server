import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/apiError.js";



export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Determine HTTP status
  let statusCode = err.statusCode ?? 500;

  // Map 404 errors set by notFoundHandler
  if (err.code === "404") statusCode = 404;

  // Prisma known request error (e.g., unique constraint)
  if (err.code === "P2002") {
    statusCode = 409;
    err.message = "A record with this value already exists.";
  }

  // Multer error handling (e.g., file size limit, unexpected field)
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      err.message = "File size limit exceeded. Maximum allowed size is 10MB per file.";
    }
  }

  // Prisma record not found
  if (err.code === "P2025") {
    statusCode = 404;
    err.message = "The requested record was not found.";
  }

  const payload: Record<string, unknown> = {
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors
      ? Array.isArray(err.errors)
        ? err.errors
        : [err.errors]
      : [],
  };

  if (env.NODE_ENV === "development") payload.stack = err.stack;

  console.error(`[${req.method}] ${req.originalUrl} → ${statusCode}:`, err.message);

  res.status(statusCode).json(payload);
};
