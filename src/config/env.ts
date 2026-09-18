/**
 * @file src/config/env.ts
 * @description Environment Variables Configuration & Validation
 *
 * Validates process.env at startup using Zod.
 * Import `env` instead of accessing process.env directly — it is fully typed.
 */

import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),

  // OAuth – Google
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // bKash Payment Gateway
  BKASH_APP_KEY: z.string().min(1),
  BKASH_APP_SECRET: z.string().min(1),
  BKASH_USERNAME: z.string().min(1),
  BKASH_PASSWORD: z.string().min(1),
  BKASH_BASE_URL: z.string().url(),
  BKASH_CALLBACK_URL: z.string().url(),

});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
