import type { Request, Response, NextFunction } from "express";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  (error as NodeJS.ErrnoException).code = "404";
  next(error);
};
