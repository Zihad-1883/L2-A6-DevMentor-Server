/**
 * @file src/lib/redis.ts
 * @description Upstash Redis Client Singleton
 *
 * Provides a high-performance REST-based Redis client for session caching,
 * rate limiting, and secondary OTP storage in Better Auth.
 */

import { Redis } from "@upstash/redis";
import { env } from "../config/env.js";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
