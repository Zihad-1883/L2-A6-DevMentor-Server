import cron from "node-cron";
import { prisma } from "../lib/prisma.js";

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

export const initCronJobs = () => {
  cron.schedule("*/5 * * * *", async () => {
    await expireAbandonedPayments();
  });

  console.log("⏰ackground Cron Worker initialized (Running cleanup every 5 minutes).");
};
