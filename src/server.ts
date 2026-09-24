import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { initCronJobs } from "./jobs/cron.js";

async function bootstrap(): Promise<void> {
  // 1. Verify DB is reachable before accepting any traffic
  await connectDB();

  // 2. Initialize background cron jobs
  initCronJobs();

  // 3. Start HTTP server
  const server = app.listen(env.PORT, () => {
    console.log(`✅  DevMentor Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`🔗  http://localhost:${env.PORT}/api/v1/health`);
  });

  // 4. Graceful shutdown 
  const shutdown = async (signal: string) => {
    console.log(`\n ${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      console.log("Server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));   // Ctrl+C

  process.on("unhandledRejection", (reason: unknown) => {
    console.error("💥 Unhandled Rejection:", reason);
    server.close(async () => {
      await disconnectDB();
      process.exit(1);
    });
  });

  process.on("uncaughtException", (error: Error) => {
    console.error("💥 Uncaught Exception:", error.message);
    server.close(async () => {
      await disconnectDB();
      process.exit(1);
    });
  });
}

// Only start standalone HTTP server in non-Vercel environments
if (!process.env.VERCEL) {
  bootstrap().catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });
}

// Export for Vercel / serverless platforms
export default app;
