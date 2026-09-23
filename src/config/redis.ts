import { Redis } from "@upstash/redis";
import { env } from "./env.js";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const BKASH_TOKEN_KEY = "bkash:id_token";

export const bkashTokenCache = {
  get: async () => {
    try {
      return await redis.get<string>(BKASH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: async (token: string) => {
    try {
      await redis.set(BKASH_TOKEN_KEY, token, { ex: 3540 });
    } catch (err) {
      console.warn("Upstash Redis token set warning:", err);
    }
  },
  clear: async () => {
    try {
      await redis.del(BKASH_TOKEN_KEY);
    } catch {

    }
  },
};
