/**
 * @file src/server.ts
 * @description Application Server Entry Point
 *
 * - Loads .env via dotenv
 * - Starts the HTTP server on PORT from env
 * - Handles unhandledRejection and uncaughtException for safe shutdown
 * - Exports `app` for Vercel serverless deployment
 */

import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  console.log(`✅  Kōdex Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  console.log(`🔗  http://localhost:${env.PORT}/api/v1/health`);
});

// ── Graceful shutdown on unhandled errors ─────────────────────────────────────
process.on("unhandledRejection", (reason: unknown) => {
  console.error("💥 Unhandled Rejection:", reason);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (error: Error) => {
  console.error("💥 Uncaught Exception:", error.message);
  server.close(() => process.exit(1));
});

// Export for Vercel / serverless platforms
export default app;
