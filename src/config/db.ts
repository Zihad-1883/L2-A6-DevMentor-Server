import { prisma } from "../lib/prisma.js";

export async function connectDB(): Promise<void> {
  await prisma.$connect();
  console.log("🗄️  Database connected successfully");
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
  console.log("🗄️  Database disconnected");
}
