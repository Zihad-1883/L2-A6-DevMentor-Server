/**
 * @file src/middlewares/auth.middleware.ts
 * @description Session & Bearer Token Authentication Middleware
 * 
 * WHAT WILL BE DONE HERE:
 * - Extract authorization headers or cookies from incoming HTTP requests.
 * - Verify user session/token using Better Auth.
 * - Attach authenticated user object (`req.user`) to Express request context.
 * - Throw 401 Unauthorized error if session/token is invalid or missing.
 */
