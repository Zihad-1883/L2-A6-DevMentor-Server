/**
 * @file src/middlewares/rbac.middleware.ts
 * @description Role-Based Access Control (RBAC) Middleware
 * 
 * WHAT WILL BE DONE HERE:
 * - Accept allowed roles (`STUDENT`, `MENTOR`, `ADMIN`) as parameters.
 * - Compare authenticated user's role (`req.user.role`) against required roles.
 * - Allow request through if authorized; otherwise throw 403 Forbidden error.
 */
