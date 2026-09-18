/**
 * @file src/lib/auth.ts
 * @description Better Auth Configuration & Initialization
 * 
 * WHAT WILL BE DONE HERE:
 * - Configure Better Auth instance with Prisma adapter.
 * - Enable Email/Password, Google OAuth, and Bearer token plugins.
 * - Export `auth` helper for session/token verification across backend services.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";

export const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",  // must match where it's mounted in app.ts
    trustedOrigins: [env.CLIENT_URL, env.BETTER_AUTH_URL],

    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "student",
                required: false,
            },
        },
    },

    emailAndPassword: { enabled: true },

    socialProviders: {
        google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
    },

    advanced: {
        database: { joins: true },  // 2-3x faster session queries
    },
});
