/**
 * @file src/config/db.ts
 * @description Prisma Database Client Singleton
 * 
 * WHAT WILL BE DONE HERE:
 * - Instantiates and exports a global PrismaClient instance.
 * - Handles connection pooling setup for serverless execution (Neon PostgreSQL).
 * - Implements graceful connection teardown on server shutdown.
 */
