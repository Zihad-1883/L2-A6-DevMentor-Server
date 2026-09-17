/**
 * @file src/middlewares/error.middleware.ts
 * @description Centralized Application Error Handling Middleware
 * 
 * WHAT WILL BE DONE HERE:
 * - Catch all uncaught exceptions, operational AppErrors, and Prisma errors.
 * - Format error responses into standardized JSON shape `{ success: false, message, errors }`.
 * - Hide stack traces in production environment while logging detailed traces in development.
 */
