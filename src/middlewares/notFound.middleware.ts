/**
 * @file src/middlewares/notFound.middleware.ts
 * @description 404 Not Found Middleware
 *
 * Catches every request that didn't match any route,
 * and passes a 404 error to the global error handler.
 */

import type { Request, Response, NextFunction } from "express";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  (error as NodeJS.ErrnoException).code = "404";
  next(error);
};
