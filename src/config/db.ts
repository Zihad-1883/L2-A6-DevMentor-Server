/**
 * @file src/config/db.ts
 * @description Prisma Database Connection Helper
 *
 * Exports a function to verify the DB is reachable at server startup.
 * The actual prisma singleton lives in src/lib/prisma.ts.
 */

import { prisma } from "../lib/prisma.js";

export async function connectDB(): Promise<void> {
  await prisma.$connect();
  console.log("🗄️  Database connected successfully");
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
  console.log("🗄️  Database disconnected");
}
