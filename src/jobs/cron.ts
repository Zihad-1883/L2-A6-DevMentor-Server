/**
 * @file src/jobs/cron.ts
 * @description Background Cron Worker Jobs for DevMentor.
 * 
 * WHY:
 * - Automatically expires abandoned bKash payment intents older than 30 minutes.
 * - Runs silently every 5 minutes without affecting active user HTTP requests.
 */

import cron from "node-cron";
import { prisma } from "../lib/prisma.js";

/**
 * Finds all INITIATED payments created more than 30 minutes ago and updates status to EXPIRED.
 */
export const expireAbandonedPayments = async () => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const result = await prisma.payment.updateMany({
      where: {
        status: "INITIATED",
        createdAt: { lt: thirtyMinutesAgo },
      },
      data: {
        status: "EXPIRED",
      },
    });

    if (result.count > 0) {
      console.log(`⏰ Cron Job: Auto-expired ${result.count} abandoned payment intent(s).`);
    }
  } catch (err) {
    console.error("❌ Error running expireAbandonedPayments cron job:", err);
  }
};

/**
 * Initializes all background cron jobs at server startup.
 */
export const initCronJobs = () => {
  // Schedule to run every 5 minutes: "*/5 * * * *"
  cron.schedule("*/5 * * * *", async () => {
    await expireAbandonedPayments();
  });

  console.log("⏰ Background Cron Worker initialized (Running cleanup every 5 minutes).");
};
