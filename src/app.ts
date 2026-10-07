import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { notFoundHandler } from "./middlewares/notFound.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { paymentController } from "./modules/payment/payment.controller.js";
import v1Router from "./routes/v1/index.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: [
      env.CLIENT_URL,
      "http://localhost:5000",
      "http://localhost:3000",
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to Kōdex API",
    data: { name: "Kōdex API", version: "1.0.0", docs: "/api/v1/health" },
  });
});

app.all("/api/v1/auth/*splat", (req, _res, next) => {
  if (!req.headers.origin) {
    req.headers.origin = env.CLIENT_URL || env.BETTER_AUTH_URL || "http://localhost:5000";
  }
  next();
}, toNodeHandler(auth));

app.all(
  [
    "/payment/status",
    "/payments/status",
    "/api/v1/payment/status",
    "/api/v1/payments/status",
    "/api/v1/payment/callback",
    "/api/v1/payment/bkash/callback",
  ],
  (req, res, next) => {
    paymentController.bkashCallbackHandler(req, res, next);
  }
);

app.use("/api/v1", v1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
