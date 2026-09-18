// Custom operational error class.
// Throw this anywhere in the app — the global errorHandler catches it.
//
// Usage:
//   throw new AppError("User not found", 404);
//   throw new AppError("Validation failed", 400, zodIssues);

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: unknown[];
  public readonly isOperational: boolean;
  public readonly code?: string;  // for Prisma error codes (P2002, P2025, etc.)

  constructor(message: string, statusCode: number, errors: unknown[] = [], code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}
