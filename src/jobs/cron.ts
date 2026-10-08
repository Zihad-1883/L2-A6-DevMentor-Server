import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { cleanExpiredPreviewLocks } from "../modules/codeReview/codeReview.service.js";

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
      console.log(`Cron Job: Auto-expired ${result.count} abandoned payment intent(s).`);
    }
  } catch (err) {
    console.error("Error running expireAbandonedPayments cron job:", err);
  }
};

export const expireCodeReviewPreviewLocks = async () => {
  try {
    const result = await cleanExpiredPreviewLocks();
    if (result.count > 0) {
      console.log(`Cron Job: Auto-released ${result.count} expired code review preview lock(s).`);
    }
  } catch (err) {
    console.error("Error running expireCodeReviewPreviewLocks cron job:", err);
  }
};

export const initCronJobs = () => {
  // Check and release expired 10-minute preview locks every 1 minute
  cron.schedule("*/1 * * * *", async () => {
    await expireCodeReviewPreviewLocks();
  });

  // Check abandoned payments every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    await expireAbandonedPayments();
  });

  console.log("Background Cron Worker initialized (Running preview lock checks every 1 min & payment cleanup every 5 min).");
};

