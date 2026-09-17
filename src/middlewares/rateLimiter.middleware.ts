/**
 * @file src/middlewares/rateLimiter.middleware.ts
 * @description Express Rate Limiting Middleware
 *
 * General rate limiter: 100 requests / 15 min per IP.
 * A stricter limiter (authLimiter) is exported for sensitive routes.
 */

import rateLimit from "express-rate-limit";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many auth attempts from this IP, please try again after 15 minutes.",
  },
});
