import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "./prisma.js";
import { redis } from "./redis.js";
import { sendOTPEmail } from "./email.js";
import { env } from "../config/env.js";

export const auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),

    secondaryStorage: {
        get: async (key: string) => {
            const value = await redis.get<string>(key);
            return value ? (typeof value === "string" ? value : JSON.stringify(value)) : null;
        },
        set: async (key: string, value: string, ttl?: number) => {
            if (ttl) {
                await redis.set(key, value, { ex: ttl });
            } else {
                await redis.set(key, value);
            }
        },
        delete: async (key: string) => {
            await redis.del(key);
        },
        getAndDelete: async (key: string) => {
            const value = await redis.get<string>(key);
            if (value !== null && value !== undefined) {
                await redis.del(key);
                return typeof value === "string" ? value : JSON.stringify(value);
            }
            return null;
        },
        increment: async (key: string, amount: number = 1) => {
            const count = await redis.incrby(key, amount);
            if (count === amount) {
                await redis.expire(key, 60);
            }
            return count;
        },
    },

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",

    rateLimit: {
        window: 60,
        max: 20,
        customRules: {
            "/sign-in/email": { window: 60, max: 10 },
            "/sign-up/email": { window: 60, max: 10 },
            "/email-otp/send-verification-otp": { window: 60, max: 10 },
            "/email-otp/verify-email": { window: 60, max: 20 },
            "/email-otp/request-password-reset": { window: 60, max: 10 },
            "/email-otp/reset-password": { window: 60, max: 10 },
        },
        storage: "secondary-storage",
    },
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

    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },

    plugins: [
        emailOTP({
            otpLength: 6,
            expiresIn: 300,
            sendVerificationOnSignUp: true,
            async sendVerificationOTP({ email, otp, type }) {
                if (type === "forget-password") {
                    await sendOTPEmail({
                        toEmail: email,
                        subject: "Reset Your DevMentor Password 🔑",
                        title: "Password Reset OTP",
                        otp,
                        description: "You requested to reset your DevMentor account password. Use the 6-digit code below to set a new password. If you didn't request this, please ignore this email.",
                    });
                } else {
                    await sendOTPEmail({
                        toEmail: email,
                        subject: "Verify Your DevMentor Account 🔐",
                        title: "Email Verification OTP",
                        otp,
                        description: "Use the 6-digit code below to complete your registration on DevMentor. This code is valid for 5 minutes.",
                    });
                }
            },
        }),
    ],

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
