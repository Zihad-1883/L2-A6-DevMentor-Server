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
