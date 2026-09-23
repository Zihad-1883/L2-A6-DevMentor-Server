import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";

export const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    trustedOrigins: [
        env.CLIENT_URL,
        env.BETTER_AUTH_URL,
        "http://localhost:5000",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:3000"
    ],

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
        database: { joins: true },
        disableCSRFCheck: true,
        defaultCookieAttributes: {
            sameSite: "lax",
            secure: false,
        },
    },
});
