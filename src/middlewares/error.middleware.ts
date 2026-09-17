/**
 * @file src/middlewares/error.middleware.ts
 * @description Centralized Application Error Handling Middleware
 *
 * Formats every error into:  { success: false, message, errors?, stack? }
 * - In production: stack trace is hidden.
 * - Prisma known errors are mapped to readable messages.
 */

import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  errors?: unknown;
  meta?: unknown;
}

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
