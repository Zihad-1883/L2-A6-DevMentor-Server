import { Redis } from "@upstash/redis";
import { env } from "./env.js";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const BKASH_TOKEN_KEY = "bkash:id_token";

export const bkashTokenCache = {
  get: () => redis.get<string>(BKASH_TOKEN_KEY),
  set: (token: string) => redis.set(BKASH_TOKEN_KEY, token, { ex: 3540 }),
  clear: () => redis.del(BKASH_TOKEN_KEY),
};
