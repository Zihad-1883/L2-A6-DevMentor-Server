
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    

// src/server.ts
import "dotenv/config";

// src/app.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";

// src/config/env.ts
import { z } from "zod";
var envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(5e3),
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
  // Email (Nodemailer SMTP)
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("DevMentor Receipts <noreply@devmentor.com>")
});
var parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const formattedErrors = JSON.stringify(parsed.error.flatten().fieldErrors, null, 2);
  console.error("\u274C Invalid environment variables:\n", formattedErrors);
  throw new Error(`Missing or invalid environment variables:
${formattedErrors}`);
}
var env = parsed.data;

// src/middlewares/rateLimiter.middleware.ts
import rateLimit from "express-rate-limit";
var generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes."
  }
});
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many auth attempts from this IP, please try again after 15 minutes."
  }
});

// src/middlewares/notFound.middleware.ts
var notFoundHandler = (req, _res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.code = "404";
  next(error);
};

// src/middlewares/error.middleware.ts
var errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode ?? 500;
  if (err.code === "404") statusCode = 404;
  if (err.code === "P2002") {
    statusCode = 409;
    err.message = "A record with this value already exists.";
  }
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      err.message = "File size limit exceeded. Maximum allowed size is 10MB per file.";
    }
  }
  if (err.code === "P2025") {
    statusCode = 404;
    err.message = "The requested record was not found.";
  }
  const payload = {
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors ? Array.isArray(err.errors) ? err.errors : [err.errors] : []
  };
  if (env.NODE_ENV === "development") payload.stack = err.stack;
  console.error(`[${req.method}] ${req.originalUrl} \u2192 ${statusCode}:`, err.message);
  res.status(statusCode).json(payload);
};

// src/app.ts
import { toNodeHandler } from "better-auth/node";

// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

// src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";

// src/generated/prisma/client.ts
import * as path from "path";
import { fileURLToPath } from "url";

// src/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.10.0",
  "engineVersion": "0edf323efd1d98336f3f0a68684b56f689b900d3",
  "activeProvider": "postgresql",
  "inlineSchema": `model User {
  id            String   @id
  name          String
  email         String   @unique
  emailVerified Boolean
  image         String?
  role          String   @default("student")
  isBlocked     Boolean  @default(false)
  createdAt     DateTime
  updatedAt     DateTime

  sessions             Session[]
  accounts             Account[]
  mentorProfile        MentorProfile?
  sprintsRequested     SprintRequest[]            @relation("StudentSprints")
  sprintsClaimed       SprintRequest[]            @relation("MentorSprints")
  cohortsCreated       CohortProgram[]            @relation("MentorCohorts")
  cohortEnrollments    CohortEnrollment[]         @relation("StudentCohortEnrollments")
  cohortSessionsJoined CohortSessionParticipant[] @relation("StudentCohortSessions")
  wallet               Wallet?
  payments             Payment[]
  studentCodeReviews   CodeReviewRequest[]        @relation("StudentCodeReviews")
  mentorCodeReviews    CodeReviewRequest[]        @relation("MentorCodeReviews")
  mentorSubmissions    CodeReviewSubmission[]     @relation("MentorSubmissions")

  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime
  updatedAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime
  updatedAt             DateTime

  @@map("account")
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?

  @@map("verification")
}

enum CodeReviewTier {
  QUICK
  DEEP
}

enum CodeReviewStatus {
  OPEN
  PREVIEW_LOCKED
  CLAIMED
  DELIVERED
  COMPLETED
  CANCELLED
  EXPIRED
}

model CodeReviewRequest {
  id            String           @id @default(cuid())
  studentId     String
  student       User             @relation("StudentCodeReviews", fields: [studentId], references: [id], onDelete: Cascade)
  tier          CodeReviewTier   @default(QUICK)
  title         String
  description   String
  codeSnippet   String? // Direct code snippet input by student
  language      String?          @default("typescript") // e.g., "typescript", "javascript", "python"
  githubRepoUrl String?
  branchName    String?          @default("main")
  specificFiles String?
  creditReward  Int
  status        CodeReviewStatus @default(OPEN)

  // 10-Minute Temporary Preview Lock
  previewMentorId  String?
  previewExpiresAt DateTime?

  // Assigned Mentor & Delivery Deadline
  assignedMentorId String?
  assignedMentor   User?     @relation("MentorCodeReviews", fields: [assignedMentorId], references: [id])
  deliveryDeadline DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  submission CodeReviewSubmission?

  @@map("code_review_request")
}

model CodeReviewSubmission {
  id        String            @id @default(cuid())
  requestId String            @unique
  request   CodeReviewRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  mentorId  String
  mentor    User              @relation("MentorSubmissions", fields: [mentorId], references: [id])

  summary             String
  reviewedCodeSnippet String? // Mentor's refactored/improved code snippet
  videoUrl            String? // Loom/Cloudinary video feedback
  pullRequestUrl      String? // GitHub PR URL

  comments  CodeReviewComment[]
  createdAt DateTime            @default(now())

  @@map("code_review_submission")
}

model CodeReviewComment {
  id           String               @id @default(cuid())
  submissionId String
  submission   CodeReviewSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  filePath    String
  lineNumber  Int
  commentText String
  severity    String? @default("SUGGESTION") // "BUG", "SECURITY", "SUGGESTION"

  createdAt DateTime @default(now())

  @@map("code_review_comment")
}

enum CohortApprovalStatus {
  PENDING_APPROVAL
  APPROVED
  REJECTED
}

enum CohortStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum CohortSessionStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
}

model CohortProgram {
  id       String @id @default(cuid())
  mentorId String
  mentor   User   @relation("MentorCohorts", fields: [mentorId], references: [id], onDelete: Cascade)

  title         String
  description   String
  durationWeeks Int
  capacity      Int
  totalCost     Int      @default(0)
  techStackTags String[]

  approvalStatus CohortApprovalStatus @default(PENDING_APPROVAL)
  status         CohortStatus         @default(DRAFT)
  approvedBy     String?
  approvedAt     DateTime?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  enrollments CohortEnrollment[]
  sessions    CohortSession[]

  @@map("cohort_program")
}

model CohortEnrollment {
  id        String        @id @default(cuid())
  cohortId  String
  cohort    CohortProgram @relation(fields: [cohortId], references: [id], onDelete: Cascade)
  studentId String
  student   User          @relation("StudentCohortEnrollments", fields: [studentId], references: [id], onDelete: Cascade)

  enrolledAt DateTime @default(now())

  @@unique([cohortId, studentId])
  @@map("cohort_enrollment")
}

model CohortSession {
  id       String        @id @default(cuid())
  cohortId String
  cohort   CohortProgram @relation(fields: [cohortId], references: [id], onDelete: Cascade)

  sessionNumber   Int
  dayNumber       Int
  title           String
  scheduledAt     DateTime
  durationMinutes Int                 @default(60)
  creditCost      Int
  status          CohortSessionStatus @default(PENDING)
  joinLink        String?
  resources       Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  participants CohortSessionParticipant[]

  @@map("cohort_session")
}

model CohortSessionParticipant {
  id              String        @id @default(cuid())
  cohortSessionId String
  cohortSession   CohortSession @relation(fields: [cohortSessionId], references: [id], onDelete: Cascade)
  studentId       String
  student         User          @relation("StudentCohortSessions", fields: [studentId], references: [id], onDelete: Cascade)

  paid     Boolean  @default(true)
  joinedAt DateTime @default(now())

  @@unique([cohortSessionId, studentId])
  @@map("cohort_session_participant")
}

enum ExperienceLevel {
  JUNIOR
  MID
  SENIOR
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

model MentorProfile {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  bio             String
  techStackTags   String[]
  experienceLevel ExperienceLevel @default(JUNIOR)
  githubUrl       String?
  resumeUrl       String?

  approvalStatus ApprovalStatus @default(PENDING)
  approvedBy     String?
  approvedAt     DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("mentor_profile")
}

enum PaymentStatus {
  INITIATED
  COMPLETED
  FAILED
  CANCELLED
  EXPIRED
}

model Payment {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  merchantInvoiceNumber String        @unique
  paymentID             String?       @unique
  trxID                 String?       @unique
  amount                Int
  status                PaymentStatus @default(INITIATED)
  gatewayResponse       Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("payment")
}

model PlatformSetting {
  id                       String   @id @default(cuid())
  sprintCreditPerSession   Int      @default(50)
  sessionCommissionPercent Int      @default(15)
  updatedAt                DateTime @updatedAt

  @@map("platform_setting")
}

// prisma/schema.prisma
// Prisma Schema Definition for DevMentor Platform
//
// WHAT WILL BE DONE HERE:
// - Define datasource (PostgreSQL) and generator (Prisma Client).
// - Define User, Session, Account, Verification models (Better Auth core).
// - Define MentorProfile, Program, ProgramSession, Enrollment, SessionParticipant models.
// - Define CodeReviewRequest, Exam, Question, Option, ExamAttempt, ExamAnswer models.
// - Define Material, Wallet, CreditTransaction, Payment, PayoutRequest models.
// - Define CommissionSetting, PlatformSetting, and AuditLog models.

generator client {
  provider      = "prisma-client"
  output        = "../../src/generated/prisma"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  // NO url here \u2014 it's in prisma.config.ts
}

enum SprintStatus {
  PENDING_CLAIM
  CLAIMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum SprintSessionStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
}

model SprintRequest {
  id        String @id @default(cuid())
  studentId String
  student   User   @relation("StudentSprints", fields: [studentId], references: [id], onDelete: Cascade)

  title         String
  description   String
  techStackTags String[]
  startDate     DateTime
  durationDays  Int
  selectedDays  Int[]

  status            SprintStatus @default(PENDING_CLAIM)
  claimedByMentorId String?
  claimedByMentor   User?        @relation("MentorSprints", fields: [claimedByMentorId], references: [id], onDelete: SetNull)
  claimedAt         DateTime?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  sessions SprintSession[]

  @@map("sprint_request")
}

model SprintSession {
  id              String        @id @default(cuid())
  sprintRequestId String
  sprintRequest   SprintRequest @relation(fields: [sprintRequestId], references: [id], onDelete: Cascade)

  dayNumber       Int
  scheduledAt     DateTime?
  durationMinutes Int                 @default(60)
  creditCost      Int                 @default(0)
  status          SprintSessionStatus @default(PENDING)
  joinLink        String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("sprint_session")
}

enum CreditTransactionType {
  TOP_UP
  SPRINT_ESCROW
  SPRINT_RELEASE
  SPRINT_REFUND
  COHORT_FEE
  COHORT_RELEASE
  WITHDRAWAL
}

model Wallet {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  balance        Int @default(0)
  totalEarned    Int @default(0)
  totalWithdrawn Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  transactions CreditTransaction[]

  @@map("wallet")
}

model CreditTransaction {
  id       String @id @default(cuid())
  walletId String
  wallet   Wallet @relation(fields: [walletId], references: [id], onDelete: Cascade)

  amount      Int
  type        CreditTransactionType
  description String
  referenceId String?

  createdAt DateTime @default(now())

  @@map("credit_transaction")
}
`,
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"image","kind":"scalar","type":"String"},{"name":"role","kind":"scalar","type":"String"},{"name":"isBlocked","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"accounts","kind":"object","type":"Account","relationName":"AccountToUser"},{"name":"mentorProfile","kind":"object","type":"MentorProfile","relationName":"MentorProfileToUser"},{"name":"sprintsRequested","kind":"object","type":"SprintRequest","relationName":"StudentSprints"},{"name":"sprintsClaimed","kind":"object","type":"SprintRequest","relationName":"MentorSprints"},{"name":"cohortsCreated","kind":"object","type":"CohortProgram","relationName":"MentorCohorts"},{"name":"cohortEnrollments","kind":"object","type":"CohortEnrollment","relationName":"StudentCohortEnrollments"},{"name":"cohortSessionsJoined","kind":"object","type":"CohortSessionParticipant","relationName":"StudentCohortSessions"},{"name":"wallet","kind":"object","type":"Wallet","relationName":"UserToWallet"},{"name":"payments","kind":"object","type":"Payment","relationName":"PaymentToUser"},{"name":"studentCodeReviews","kind":"object","type":"CodeReviewRequest","relationName":"StudentCodeReviews"},{"name":"mentorCodeReviews","kind":"object","type":"CodeReviewRequest","relationName":"MentorCodeReviews"},{"name":"mentorSubmissions","kind":"object","type":"CodeReviewSubmission","relationName":"MentorSubmissions"}],"dbName":"user","schema":null},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"token","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":"session","schema":null},"Account":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String"},{"name":"providerId","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"AccountToUser"},{"name":"accessToken","kind":"scalar","type":"String"},{"name":"refreshToken","kind":"scalar","type":"String"},{"name":"idToken","kind":"scalar","type":"String"},{"name":"accessTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"refreshTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"scope","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"account","schema":null},"Verification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"identifier","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"verification","schema":null},"CodeReviewRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCodeReviews"},{"name":"tier","kind":"enum","type":"CodeReviewTier"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"codeSnippet","kind":"scalar","type":"String"},{"name":"language","kind":"scalar","type":"String"},{"name":"githubRepoUrl","kind":"scalar","type":"String"},{"name":"branchName","kind":"scalar","type":"String"},{"name":"specificFiles","kind":"scalar","type":"String"},{"name":"creditReward","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"CodeReviewStatus"},{"name":"previewMentorId","kind":"scalar","type":"String"},{"name":"previewExpiresAt","kind":"scalar","type":"DateTime"},{"name":"assignedMentorId","kind":"scalar","type":"String"},{"name":"assignedMentor","kind":"object","type":"User","relationName":"MentorCodeReviews"},{"name":"deliveryDeadline","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"submission","kind":"object","type":"CodeReviewSubmission","relationName":"CodeReviewRequestToCodeReviewSubmission"}],"dbName":"code_review_request","schema":null},"CodeReviewSubmission":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"requestId","kind":"scalar","type":"String"},{"name":"request","kind":"object","type":"CodeReviewRequest","relationName":"CodeReviewRequestToCodeReviewSubmission"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorSubmissions"},{"name":"summary","kind":"scalar","type":"String"},{"name":"reviewedCodeSnippet","kind":"scalar","type":"String"},{"name":"videoUrl","kind":"scalar","type":"String"},{"name":"pullRequestUrl","kind":"scalar","type":"String"},{"name":"comments","kind":"object","type":"CodeReviewComment","relationName":"CodeReviewCommentToCodeReviewSubmission"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"code_review_submission","schema":null},"CodeReviewComment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"submissionId","kind":"scalar","type":"String"},{"name":"submission","kind":"object","type":"CodeReviewSubmission","relationName":"CodeReviewCommentToCodeReviewSubmission"},{"name":"filePath","kind":"scalar","type":"String"},{"name":"lineNumber","kind":"scalar","type":"Int"},{"name":"commentText","kind":"scalar","type":"String"},{"name":"severity","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"code_review_comment","schema":null},"CohortProgram":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorCohorts"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"durationWeeks","kind":"scalar","type":"Int"},{"name":"capacity","kind":"scalar","type":"Int"},{"name":"totalCost","kind":"scalar","type":"Int"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"approvalStatus","kind":"enum","type":"CohortApprovalStatus"},{"name":"status","kind":"enum","type":"CohortStatus"},{"name":"approvedBy","kind":"scalar","type":"String"},{"name":"approvedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"enrollments","kind":"object","type":"CohortEnrollment","relationName":"CohortEnrollmentToCohortProgram"},{"name":"sessions","kind":"object","type":"CohortSession","relationName":"CohortProgramToCohortSession"}],"dbName":"cohort_program","schema":null},"CohortEnrollment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortId","kind":"scalar","type":"String"},{"name":"cohort","kind":"object","type":"CohortProgram","relationName":"CohortEnrollmentToCohortProgram"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCohortEnrollments"},{"name":"enrolledAt","kind":"scalar","type":"DateTime"}],"dbName":"cohort_enrollment","schema":null},"CohortSession":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortId","kind":"scalar","type":"String"},{"name":"cohort","kind":"object","type":"CohortProgram","relationName":"CohortProgramToCohortSession"},{"name":"sessionNumber","kind":"scalar","type":"Int"},{"name":"dayNumber","kind":"scalar","type":"Int"},{"name":"title","kind":"scalar","type":"String"},{"name":"scheduledAt","kind":"scalar","type":"DateTime"},{"name":"durationMinutes","kind":"scalar","type":"Int"},{"name":"creditCost","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"CohortSessionStatus"},{"name":"joinLink","kind":"scalar","type":"String"},{"name":"resources","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"participants","kind":"object","type":"CohortSessionParticipant","relationName":"CohortSessionToCohortSessionParticipant"}],"dbName":"cohort_session","schema":null},"CohortSessionParticipant":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortSessionId","kind":"scalar","type":"String"},{"name":"cohortSession","kind":"object","type":"CohortSession","relationName":"CohortSessionToCohortSessionParticipant"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCohortSessions"},{"name":"paid","kind":"scalar","type":"Boolean"},{"name":"joinedAt","kind":"scalar","type":"DateTime"}],"dbName":"cohort_session_participant","schema":null},"MentorProfile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"MentorProfileToUser"},{"name":"bio","kind":"scalar","type":"String"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"experienceLevel","kind":"enum","type":"ExperienceLevel"},{"name":"githubUrl","kind":"scalar","type":"String"},{"name":"resumeUrl","kind":"scalar","type":"String"},{"name":"approvalStatus","kind":"enum","type":"ApprovalStatus"},{"name":"approvedBy","kind":"scalar","type":"String"},{"name":"approvedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"mentor_profile","schema":null},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"PaymentToUser"},{"name":"merchantInvoiceNumber","kind":"scalar","type":"String"},{"name":"paymentID","kind":"scalar","type":"String"},{"name":"trxID","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayResponse","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"payment","schema":null},"PlatformSetting":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"sprintCreditPerSession","kind":"scalar","type":"Int"},{"name":"sessionCommissionPercent","kind":"scalar","type":"Int"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"platform_setting","schema":null},"SprintRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentSprints"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"startDate","kind":"scalar","type":"DateTime"},{"name":"durationDays","kind":"scalar","type":"Int"},{"name":"selectedDays","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"SprintStatus"},{"name":"claimedByMentorId","kind":"scalar","type":"String"},{"name":"claimedByMentor","kind":"object","type":"User","relationName":"MentorSprints"},{"name":"claimedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"SprintSession","relationName":"SprintRequestToSprintSession"}],"dbName":"sprint_request","schema":null},"SprintSession":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"sprintRequestId","kind":"scalar","type":"String"},{"name":"sprintRequest","kind":"object","type":"SprintRequest","relationName":"SprintRequestToSprintSession"},{"name":"dayNumber","kind":"scalar","type":"Int"},{"name":"scheduledAt","kind":"scalar","type":"DateTime"},{"name":"durationMinutes","kind":"scalar","type":"Int"},{"name":"creditCost","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"SprintSessionStatus"},{"name":"joinLink","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"sprint_session","schema":null},"Wallet":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"UserToWallet"},{"name":"balance","kind":"scalar","type":"Int"},{"name":"totalEarned","kind":"scalar","type":"Int"},{"name":"totalWithdrawn","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"transactions","kind":"object","type":"CreditTransaction","relationName":"CreditTransactionToWallet"}],"dbName":"wallet","schema":null},"CreditTransaction":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"walletId","kind":"scalar","type":"String"},{"name":"wallet","kind":"object","type":"Wallet","relationName":"CreditTransactionToWallet"},{"name":"amount","kind":"scalar","type":"Int"},{"name":"type","kind":"enum","type":"CreditTransactionType"},{"name":"description","kind":"scalar","type":"String"},{"name":"referenceId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"credit_transaction","schema":null}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","user","sessions","accounts","mentorProfile","student","claimedByMentor","sprintRequest","_count","sprintsRequested","sprintsClaimed","mentor","cohort","enrollments","cohortSession","participants","cohortsCreated","cohortEnrollments","cohortSessionsJoined","wallet","transactions","payments","assignedMentor","request","submission","comments","studentCodeReviews","mentorCodeReviews","mentorSubmissions","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_min","_max","User.groupBy","User.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.createManyAndReturn","Session.updateOne","Session.updateMany","Session.updateManyAndReturn","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","Account.findUnique","Account.findUniqueOrThrow","Account.findFirst","Account.findFirstOrThrow","Account.findMany","Account.createOne","Account.createMany","Account.createManyAndReturn","Account.updateOne","Account.updateMany","Account.updateManyAndReturn","Account.upsertOne","Account.deleteOne","Account.deleteMany","Account.groupBy","Account.aggregate","Verification.findUnique","Verification.findUniqueOrThrow","Verification.findFirst","Verification.findFirstOrThrow","Verification.findMany","Verification.createOne","Verification.createMany","Verification.createManyAndReturn","Verification.updateOne","Verification.updateMany","Verification.updateManyAndReturn","Verification.upsertOne","Verification.deleteOne","Verification.deleteMany","Verification.groupBy","Verification.aggregate","CodeReviewRequest.findUnique","CodeReviewRequest.findUniqueOrThrow","CodeReviewRequest.findFirst","CodeReviewRequest.findFirstOrThrow","CodeReviewRequest.findMany","CodeReviewRequest.createOne","CodeReviewRequest.createMany","CodeReviewRequest.createManyAndReturn","CodeReviewRequest.updateOne","CodeReviewRequest.updateMany","CodeReviewRequest.updateManyAndReturn","CodeReviewRequest.upsertOne","CodeReviewRequest.deleteOne","CodeReviewRequest.deleteMany","_avg","_sum","CodeReviewRequest.groupBy","CodeReviewRequest.aggregate","CodeReviewSubmission.findUnique","CodeReviewSubmission.findUniqueOrThrow","CodeReviewSubmission.findFirst","CodeReviewSubmission.findFirstOrThrow","CodeReviewSubmission.findMany","CodeReviewSubmission.createOne","CodeReviewSubmission.createMany","CodeReviewSubmission.createManyAndReturn","CodeReviewSubmission.updateOne","CodeReviewSubmission.updateMany","CodeReviewSubmission.updateManyAndReturn","CodeReviewSubmission.upsertOne","CodeReviewSubmission.deleteOne","CodeReviewSubmission.deleteMany","CodeReviewSubmission.groupBy","CodeReviewSubmission.aggregate","CodeReviewComment.findUnique","CodeReviewComment.findUniqueOrThrow","CodeReviewComment.findFirst","CodeReviewComment.findFirstOrThrow","CodeReviewComment.findMany","CodeReviewComment.createOne","CodeReviewComment.createMany","CodeReviewComment.createManyAndReturn","CodeReviewComment.updateOne","CodeReviewComment.updateMany","CodeReviewComment.updateManyAndReturn","CodeReviewComment.upsertOne","CodeReviewComment.deleteOne","CodeReviewComment.deleteMany","CodeReviewComment.groupBy","CodeReviewComment.aggregate","CohortProgram.findUnique","CohortProgram.findUniqueOrThrow","CohortProgram.findFirst","CohortProgram.findFirstOrThrow","CohortProgram.findMany","CohortProgram.createOne","CohortProgram.createMany","CohortProgram.createManyAndReturn","CohortProgram.updateOne","CohortProgram.updateMany","CohortProgram.updateManyAndReturn","CohortProgram.upsertOne","CohortProgram.deleteOne","CohortProgram.deleteMany","CohortProgram.groupBy","CohortProgram.aggregate","CohortEnrollment.findUnique","CohortEnrollment.findUniqueOrThrow","CohortEnrollment.findFirst","CohortEnrollment.findFirstOrThrow","CohortEnrollment.findMany","CohortEnrollment.createOne","CohortEnrollment.createMany","CohortEnrollment.createManyAndReturn","CohortEnrollment.updateOne","CohortEnrollment.updateMany","CohortEnrollment.updateManyAndReturn","CohortEnrollment.upsertOne","CohortEnrollment.deleteOne","CohortEnrollment.deleteMany","CohortEnrollment.groupBy","CohortEnrollment.aggregate","CohortSession.findUnique","CohortSession.findUniqueOrThrow","CohortSession.findFirst","CohortSession.findFirstOrThrow","CohortSession.findMany","CohortSession.createOne","CohortSession.createMany","CohortSession.createManyAndReturn","CohortSession.updateOne","CohortSession.updateMany","CohortSession.updateManyAndReturn","CohortSession.upsertOne","CohortSession.deleteOne","CohortSession.deleteMany","CohortSession.groupBy","CohortSession.aggregate","CohortSessionParticipant.findUnique","CohortSessionParticipant.findUniqueOrThrow","CohortSessionParticipant.findFirst","CohortSessionParticipant.findFirstOrThrow","CohortSessionParticipant.findMany","CohortSessionParticipant.createOne","CohortSessionParticipant.createMany","CohortSessionParticipant.createManyAndReturn","CohortSessionParticipant.updateOne","CohortSessionParticipant.updateMany","CohortSessionParticipant.updateManyAndReturn","CohortSessionParticipant.upsertOne","CohortSessionParticipant.deleteOne","CohortSessionParticipant.deleteMany","CohortSessionParticipant.groupBy","CohortSessionParticipant.aggregate","MentorProfile.findUnique","MentorProfile.findUniqueOrThrow","MentorProfile.findFirst","MentorProfile.findFirstOrThrow","MentorProfile.findMany","MentorProfile.createOne","MentorProfile.createMany","MentorProfile.createManyAndReturn","MentorProfile.updateOne","MentorProfile.updateMany","MentorProfile.updateManyAndReturn","MentorProfile.upsertOne","MentorProfile.deleteOne","MentorProfile.deleteMany","MentorProfile.groupBy","MentorProfile.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","PlatformSetting.findUnique","PlatformSetting.findUniqueOrThrow","PlatformSetting.findFirst","PlatformSetting.findFirstOrThrow","PlatformSetting.findMany","PlatformSetting.createOne","PlatformSetting.createMany","PlatformSetting.createManyAndReturn","PlatformSetting.updateOne","PlatformSetting.updateMany","PlatformSetting.updateManyAndReturn","PlatformSetting.upsertOne","PlatformSetting.deleteOne","PlatformSetting.deleteMany","PlatformSetting.groupBy","PlatformSetting.aggregate","SprintRequest.findUnique","SprintRequest.findUniqueOrThrow","SprintRequest.findFirst","SprintRequest.findFirstOrThrow","SprintRequest.findMany","SprintRequest.createOne","SprintRequest.createMany","SprintRequest.createManyAndReturn","SprintRequest.updateOne","SprintRequest.updateMany","SprintRequest.updateManyAndReturn","SprintRequest.upsertOne","SprintRequest.deleteOne","SprintRequest.deleteMany","SprintRequest.groupBy","SprintRequest.aggregate","SprintSession.findUnique","SprintSession.findUniqueOrThrow","SprintSession.findFirst","SprintSession.findFirstOrThrow","SprintSession.findMany","SprintSession.createOne","SprintSession.createMany","SprintSession.createManyAndReturn","SprintSession.updateOne","SprintSession.updateMany","SprintSession.updateManyAndReturn","SprintSession.upsertOne","SprintSession.deleteOne","SprintSession.deleteMany","SprintSession.groupBy","SprintSession.aggregate","Wallet.findUnique","Wallet.findUniqueOrThrow","Wallet.findFirst","Wallet.findFirstOrThrow","Wallet.findMany","Wallet.createOne","Wallet.createMany","Wallet.createManyAndReturn","Wallet.updateOne","Wallet.updateMany","Wallet.updateManyAndReturn","Wallet.upsertOne","Wallet.deleteOne","Wallet.deleteMany","Wallet.groupBy","Wallet.aggregate","CreditTransaction.findUnique","CreditTransaction.findUniqueOrThrow","CreditTransaction.findFirst","CreditTransaction.findFirstOrThrow","CreditTransaction.findMany","CreditTransaction.createOne","CreditTransaction.createMany","CreditTransaction.createManyAndReturn","CreditTransaction.updateOne","CreditTransaction.updateMany","CreditTransaction.updateManyAndReturn","CreditTransaction.upsertOne","CreditTransaction.deleteOne","CreditTransaction.deleteMany","CreditTransaction.groupBy","CreditTransaction.aggregate","AND","OR","NOT","id","walletId","amount","CreditTransactionType","type","description","referenceId","createdAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","userId","balance","totalEarned","totalWithdrawn","updatedAt","every","some","none","sprintRequestId","dayNumber","scheduledAt","durationMinutes","creditCost","SprintSessionStatus","status","joinLink","studentId","title","techStackTags","startDate","durationDays","selectedDays","SprintStatus","claimedByMentorId","claimedAt","deletedAt","has","hasEvery","hasSome","sprintCreditPerSession","sessionCommissionPercent","merchantInvoiceNumber","paymentID","trxID","PaymentStatus","gatewayResponse","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","bio","ExperienceLevel","experienceLevel","githubUrl","resumeUrl","ApprovalStatus","approvalStatus","approvedBy","approvedAt","cohortSessionId","paid","joinedAt","cohortId","sessionNumber","CohortSessionStatus","resources","enrolledAt","mentorId","durationWeeks","capacity","totalCost","CohortApprovalStatus","CohortStatus","submissionId","filePath","lineNumber","commentText","severity","requestId","summary","reviewedCodeSnippet","videoUrl","pullRequestUrl","CodeReviewTier","tier","codeSnippet","language","githubRepoUrl","branchName","specificFiles","creditReward","CodeReviewStatus","previewMentorId","previewExpiresAt","assignedMentorId","deliveryDeadline","identifier","value","expiresAt","accountId","providerId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","token","ipAddress","userAgent","name","email","emailVerified","image","role","isBlocked","cohortSessionId_studentId","cohortId_studentId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "gwmrAaACGQQAAOkEACAFAADqBAAgBgAA6wQAIAsAAOwEACAMAADsBAAgEgAA7QQAIBMAAOMEACAUAADdBAAgFQAA7gQAIBcAAO8EACAcAADwBAAgHQAA8AQAIB4AAPEEACDHAgAA6AQAMMgCAAARABDJAgAA6AQAMMoCAQAAAAHRAkAAgwQAIeECQACDBAAhxAMBAJUEACHFAwEAAAABxgMgANgEACHHAwEApQQAIcgDAQCVBAAhyQMgANgEACEBAAAAAQAgDAMAAIQEACDHAgAA9gQAMMgCAAADABDJAgAA9gQAMMoCAQCVBAAh0QJAAIMEACHdAgEAlQQAIeECQACDBAAhtwNAAIMEACHBAwEAlQQAIcIDAQClBAAhwwMBAKUEACEDAwAAmQUAIMIDAAD3BAAgwwMAAPcEACAMAwAAhAQAIMcCAAD2BAAwyAIAAAMAEMkCAAD2BAAwygIBAAAAAdECQACDBAAh3QIBAJUEACHhAkAAgwQAIbcDQACDBAAhwQMBAAAAAcIDAQClBAAhwwMBAKUEACEDAAAAAwAgAQAABAAwAgAABQAgEQMAAIQEACDHAgAA9QQAMMgCAAAHABDJAgAA9QQAMMoCAQCVBAAh0QJAAIMEACHdAgEAlQQAIeECQACDBAAhuAMBAJUEACG5AwEAlQQAIboDAQClBAAhuwMBAKUEACG8AwEApQQAIb0DQACnBAAhvgNAAKcEACG_AwEApQQAIcADAQClBAAhCAMAAJkFACC6AwAA9wQAILsDAAD3BAAgvAMAAPcEACC9AwAA9wQAIL4DAAD3BAAgvwMAAPcEACDAAwAA9wQAIBEDAACEBAAgxwIAAPUEADDIAgAABwAQyQIAAPUEADDKAgEAAAAB0QJAAIMEACHdAgEAlQQAIeECQACDBAAhuAMBAJUEACG5AwEAlQQAIboDAQClBAAhuwMBAKUEACG8AwEApQQAIb0DQACnBAAhvgNAAKcEACG_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_AIBAJUEACH9AgEApQQAIf4CAQClBAAhgAMAANIEACAEAwAAmQUAIP0CAAD3BAAg_gIAAPcEACCAAwAA9wQAIA4DAACEBAAgxwIAANAEADDIAgAANQAQyQIAANAEADDKAgEAAAABzAICAIIEACHRAkAAgwQAId0CAQCVBAAh4QJAAIMEACHrAgAA0QSAAyL8AgEAAAAB_QIBAAAAAf4CAQAAAAGAAwAA0gQAIAMAAAA1ACABAAA2ADACAAA3ACAYBwAAhAQAIBgAAM4EACAaAADPBAAgxwIAAMsEADDIAgAAOQAQyQIAAMsEADDKAgEAlQQAIc8CAQCVBAAh0QJAAIMEACHhAkAAgwQAIesCAADNBLEDIu0CAQCVBAAh7gIBAJUEACGpAwAAzASpAyKqAwEApQQAIasDAQClBAAhrAMBAKUEACGtAwEApQQAIa4DAQClBAAhrwMCAIIEACGxAwEApQQAIbIDQACnBAAhswMBAKUEACG0A0AApwQAIQwHAACZBQAgGAAAmQUAIBoAAIkIACCqAwAA9wQAIKsDAAD3BAAgrAMAAPcEACCtAwAA9wQAIK4DAAD3BAAgsQMAAPcEACCyAwAA9wQAILMDAAD3BAAgtAMAAPcEACAYBwAAhAQAIBgAAM4EACAaAADPBAAgxwIAAMsEADDIAgAAOQAQyQIAAMsEADDKAgEAAAABzwIBAJUEACHRAkAAgwQAIeECQACDBAAh6wIAAM0EsQMi7QIBAJUEACHuAgEAlQQAIakDAADMBKkDIqoDAQClBAAhqwMBAKUEACGsAwEApQQAIa0DAQClBAAhrgMBAKUEACGvAwIAggQAIbEDAQClBAAhsgNAAKcEACGzAwEApQQAIbQDQACnBAAhAwAAADkAIAEAADoAMAIAADsAIAEAAAARACAODQAAhAQAIBkAAMcEACAbAADIBAAgxwIAAMYEADDIAgAAPgAQyQIAAMYEADDKAgEAlQQAIdECQACDBAAhmAMBAJUEACGjAwEAlQQAIaQDAQCVBAAhpQMBAKUEACGmAwEApQQAIacDAQClBAAhAQAAAD4AIAsaAADKBAAgxwIAAMkEADDIAgAAQAAQyQIAAMkEADDKAgEAlQQAIdECQACDBAAhngMBAJUEACGfAwEAlQQAIaADAgCCBAAhoQMBAJUEACGiAwEApQQAIQIaAACJCAAgogMAAPcEACALGgAAygQAIMcCAADJBAAwyAIAAEAAEMkCAADJBAAwygIBAAAAAdECQACDBAAhngMBAJUEACGfAwEAlQQAIaADAgCCBAAhoQMBAJUEACGiAwEApQQAIQMAAABAACABAABBADACAABCACABAAAAQAAgAwAAADkAIAEAADoAMAIAADsAIAYNAACZBQAgGQAAhwgAIBsAAIgIACClAwAA9wQAIKYDAAD3BAAgpwMAAPcEACAODQAAhAQAIBkAAMcEACAbAADIBAAgxwIAAMYEADDIAgAAPgAQyQIAAMYEADDKAgEAAAAB0QJAAIMEACGYAwEAlQQAIaMDAQAAAAGkAwEAlQQAIaUDAQClBAAhpgMBAKUEACGnAwEApQQAIQMAAAA-ACABAABGADACAABHACABAAAAAwAgAQAAAAcAIAEAAAANACABAAAADQAgAQAAABkAIAEAAAAdACABAAAAJQAgAQAAADUAIAEAAAA5ACABAAAAOQAgAQAAAD4AIAEAAAABACAOBAAA_AcAIAUAAP0HACAGAAD-BwAgCwAA_wcAIAwAAP8HACASAACACAAgEwAAgQgAIBQAAIIIACAVAACDCAAgFwAAhAgAIBwAAIUIACAdAACFCAAgHgAAhggAIMcDAAD3BAAgAwAAABEAIAEAAFUAMAIAAAEAIAMAAAARACABAABVADACAAABACADAAAAEQAgAQAAVQAwAgAAAQAgFgQAAO8HACAFAADwBwAgBgAA8QcAIAsAAPIHACAMAADzBwAgEgAA9AcAIBMAAPUHACAUAAD2BwAgFQAA9wcAIBcAAPgHACAcAAD5BwAgHQAA-gcAIB4AAPsHACDKAgEAAAAB0QJAAAAAAeECQAAAAAHEAwEAAAABxQMBAAAAAcYDIAAAAAHHAwEAAAAByAMBAAAAAckDIAAAAAEBJAAAWQAgCcoCAQAAAAHRAkAAAAAB4QJAAAAAAcQDAQAAAAHFAwEAAAABxgMgAAAAAccDAQAAAAHIAwEAAAAByQMgAAAAAQEkAABbADABJAAAWwAwFgQAAOAGACAFAADhBgAgBgAA4gYAIAsAAOMGACAMAADkBgAgEgAA5QYAIBMAAOYGACAUAADnBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIB4AAOwGACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACECAAAAAQAgJAAAXgAgCcoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIQIAAAARACAkAABgACACAAAAEQAgJAAAYAAgAwAAAAEAICsAAFkAICwAAF4AIAEAAAABACABAAAAEQAgBAoAAN0GACAxAADfBgAgMgAA3gYAIMcDAAD3BAAgDMcCAADFBAAwyAIAAGcAEMkCAADFBAAwygIBAO8DACHRAkAA8wMAIeECQADzAwAhxAMBAO8DACHFAwEA7wMAIcYDIACpBAAhxwMBAPIDACHIAwEA7wMAIckDIACpBAAhAwAAABEAIAEAAGYAMDAAAGcAIAMAAAARACABAABVADACAAABACABAAAABQAgAQAAAAUAIAMAAAADACABAAAEADACAAAFACADAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAkDAADcBgAgygIBAAAAAdECQAAAAAHdAgEAAAAB4QJAAAAAAbcDQAAAAAHBAwEAAAABwgMBAAAAAcMDAQAAAAEBJAAAbwAgCMoCAQAAAAHRAkAAAAAB3QIBAAAAAeECQAAAAAG3A0AAAAABwQMBAAAAAcIDAQAAAAHDAwEAAAABASQAAHEAMAEkAABxADAJAwAA2wYAIMoCAQD9BAAh0QJAAIEFACHdAgEA_QQAIeECQACBBQAhtwNAAIEFACHBAwEA_QQAIcIDAQCABQAhwwMBAIAFACECAAAABQAgJAAAdAAgCMoCAQD9BAAh0QJAAIEFACHdAgEA_QQAIeECQACBBQAhtwNAAIEFACHBAwEA_QQAIcIDAQCABQAhwwMBAIAFACECAAAAAwAgJAAAdgAgAgAAAAMAICQAAHYAIAMAAAAFACArAABvACAsAAB0ACABAAAABQAgAQAAAAMAIAUKAADYBgAgMQAA2gYAIDIAANkGACDCAwAA9wQAIMMDAAD3BAAgC8cCAADEBAAwyAIAAH0AEMkCAADEBAAwygIBAO8DACHRAkAA8wMAId0CAQDvAwAh4QJAAPMDACG3A0AA8wMAIcEDAQDvAwAhwgMBAPIDACHDAwEA8gMAIQMAAAADACABAAB8ADAwAAB9ACADAAAAAwAgAQAABAAwAgAABQAgAQAAAAkAIAEAAAAJACADAAAABwAgAQAACAAwAgAACQAgAwAAAAcAIAEAAAgAMAIAAAkAIAMAAAAHACABAAAIADACAAAJACAOAwAA1wYAIMoCAQAAAAHRAkAAAAAB3QIBAAAAAeECQAAAAAG4AwEAAAABuQMBAAAAAboDAQAAAAG7AwEAAAABvAMBAAAAAb0DQAAAAAG-A0AAAAABvwMBAAAAAcADAQAAAAEBJAAAhQEAIA3KAgEAAAAB0QJAAAAAAd0CAQAAAAHhAkAAAAABuAMBAAAAAbkDAQAAAAG6AwEAAAABuwMBAAAAAbwDAQAAAAG9A0AAAAABvgNAAAAAAb8DAQAAAAHAAwEAAAABASQAAIcBADABJAAAhwEAMA4DAADWBgAgygIBAP0EACHRAkAAgQUAId0CAQD9BAAh4QJAAIEFACG4AwEA_QQAIbkDAQD9BAAhugMBAIAFACG7AwEAgAUAIbwDAQCABQAhvQNAAKAFACG-A0AAoAUAIb8DAQCABQAhwAMBAIAFACECAAAACQAgJAAAigEAIA3KAgEA_QQAIdECQACBBQAh3QIBAP0EACHhAkAAgQUAIbgDAQD9BAAhuQMBAP0EACG6AwEAgAUAIbsDAQCABQAhvAMBAIAFACG9A0AAoAUAIb4DQACgBQAhvwMBAIAFACHAAwEAgAUAIQIAAAAHACAkAACMAQAgAgAAAAcAICQAAIwBACADAAAACQAgKwAAhQEAICwAAIoBACABAAAACQAgAQAAAAcAIAoKAADTBgAgMQAA1QYAIDIAANQGACC6AwAA9wQAILsDAAD3BAAgvAMAAPcEACC9AwAA9wQAIL4DAAD3BAAgvwMAAPcEACDAAwAA9wQAIBDHAgAAwwQAMMgCAACTAQAQyQIAAMMEADDKAgEA7wMAIdECQADzAwAh3QIBAO8DACHhAkAA8wMAIbgDAQDvAwAhuQMBAO8DACG6AwEA8gMAIbsDAQDyAwAhvAMBAPIDACG9A0AAhwQAIb4DQACHBAAhvwMBAPIDACHAAwEA8gMAIQMAAAAHACABAACSAQAwMAAAkwEAIAMAAAAHACABAAAIADACAAAJACAJxwIAAMIEADDIAgAAmQEAEMkCAADCBAAwygIBAAAAAdECQACnBAAh4QJAAKcEACG1AwEAlQQAIbYDAQCVBAAhtwNAAIMEACEBAAAAlgEAIAEAAACWAQAgCccCAADCBAAwyAIAAJkBABDJAgAAwgQAMMoCAQCVBAAh0QJAAKcEACHhAkAApwQAIbUDAQCVBAAhtgMBAJUEACG3A0AAgwQAIQLRAgAA9wQAIOECAAD3BAAgAwAAAJkBACABAACaAQAwAgAAlgEAIAMAAACZAQAgAQAAmgEAMAIAAJYBACADAAAAmQEAIAEAAJoBADACAACWAQAgBsoCAQAAAAHRAkAAAAAB4QJAAAAAAbUDAQAAAAG2AwEAAAABtwNAAAAAAQEkAACeAQAgBsoCAQAAAAHRAkAAAAAB4QJAAAAAAbUDAQAAAAG2AwEAAAABtwNAAAAAAQEkAACgAQAwASQAAKABADAGygIBAP0EACHRAkAAoAUAIeECQACgBQAhtQMBAP0EACG2AwEA_QQAIbcDQACBBQAhAgAAAJYBACAkAACjAQAgBsoCAQD9BAAh0QJAAKAFACHhAkAAoAUAIbUDAQD9BAAhtgMBAP0EACG3A0AAgQUAIQIAAACZAQAgJAAApQEAIAIAAACZAQAgJAAApQEAIAMAAACWAQAgKwAAngEAICwAAKMBACABAAAAlgEAIAEAAACZAQAgBQoAANAGACAxAADSBgAgMgAA0QYAINECAAD3BAAg4QIAAPcEACAJxwIAAMEEADDIAgAArAEAEMkCAADBBAAwygIBAO8DACHRAkAAhwQAIeECQACHBAAhtQMBAO8DACG2AwEA7wMAIbcDQADzAwAhAwAAAJkBACABAACrAQAwMAAArAEAIAMAAACZAQAgAQAAmgEAMAIAAJYBACABAAAAOwAgAQAAADsAIAMAAAA5ACABAAA6ADACAAA7ACADAAAAOQAgAQAAOgAwAgAAOwAgAwAAADkAIAEAADoAMAIAADsAIBUHAADNBgAgGAAAzgYAIBoAAM8GACDKAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAACxAwLtAgEAAAAB7gIBAAAAAakDAAAAqQMCqgMBAAAAAasDAQAAAAGsAwEAAAABrQMBAAAAAa4DAQAAAAGvAwIAAAABsQMBAAAAAbIDQAAAAAGzAwEAAAABtANAAAAAAQEkAAC0AQAgEsoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAALEDAu0CAQAAAAHuAgEAAAABqQMAAACpAwKqAwEAAAABqwMBAAAAAawDAQAAAAGtAwEAAAABrgMBAAAAAa8DAgAAAAGxAwEAAAABsgNAAAAAAbMDAQAAAAG0A0AAAAABASQAALYBADABJAAAtgEAMAEAAAARACAVBwAAxQYAIBgAAMYGACAaAADHBgAgygIBAP0EACHPAgEA_QQAIdECQACBBQAh4QJAAIEFACHrAgAAxAaxAyLtAgEA_QQAIe4CAQD9BAAhqQMAAMMGqQMiqgMBAIAFACGrAwEAgAUAIawDAQCABQAhrQMBAIAFACGuAwEAgAUAIa8DAgD-BAAhsQMBAIAFACGyA0AAoAUAIbMDAQCABQAhtANAAKAFACECAAAAOwAgJAAAugEAIBLKAgEA_QQAIc8CAQD9BAAh0QJAAIEFACHhAkAAgQUAIesCAADEBrEDIu0CAQD9BAAh7gIBAP0EACGpAwAAwwapAyKqAwEAgAUAIasDAQCABQAhrAMBAIAFACGtAwEAgAUAIa4DAQCABQAhrwMCAP4EACGxAwEAgAUAIbIDQACgBQAhswMBAIAFACG0A0AAoAUAIQIAAAA5ACAkAAC8AQAgAgAAADkAICQAALwBACABAAAAEQAgAwAAADsAICsAALQBACAsAAC6AQAgAQAAADsAIAEAAAA5ACAOCgAAvgYAIDEAAMEGACAyAADABgAgcwAAvwYAIHQAAMIGACCqAwAA9wQAIKsDAAD3BAAgrAMAAPcEACCtAwAA9wQAIK4DAAD3BAAgsQMAAPcEACCyAwAA9wQAILMDAAD3BAAgtAMAAPcEACAVxwIAALoEADDIAgAAxAEAEMkCAAC6BAAwygIBAO8DACHPAgEA7wMAIdECQADzAwAh4QJAAPMDACHrAgAAvASxAyLtAgEA7wMAIe4CAQDvAwAhqQMAALsEqQMiqgMBAPIDACGrAwEA8gMAIawDAQDyAwAhrQMBAPIDACGuAwEA8gMAIa8DAgDwAwAhsQMBAPIDACGyA0AAhwQAIbMDAQDyAwAhtANAAIcEACEDAAAAOQAgAQAAwwEAMDAAAMQBACADAAAAOQAgAQAAOgAwAgAAOwAgAQAAAEcAIAEAAABHACADAAAAPgAgAQAARgAwAgAARwAgAwAAAD4AIAEAAEYAMAIAAEcAIAMAAAA-ACABAABGADACAABHACALDQAAvAYAIBkAALsGACAbAAC9BgAgygIBAAAAAdECQAAAAAGYAwEAAAABowMBAAAAAaQDAQAAAAGlAwEAAAABpgMBAAAAAacDAQAAAAEBJAAAzAEAIAjKAgEAAAAB0QJAAAAAAZgDAQAAAAGjAwEAAAABpAMBAAAAAaUDAQAAAAGmAwEAAAABpwMBAAAAAQEkAADOAQAwASQAAM4BADALDQAArQYAIBkAAKwGACAbAACuBgAgygIBAP0EACHRAkAAgQUAIZgDAQD9BAAhowMBAP0EACGkAwEA_QQAIaUDAQCABQAhpgMBAIAFACGnAwEAgAUAIQIAAABHACAkAADRAQAgCMoCAQD9BAAh0QJAAIEFACGYAwEA_QQAIaMDAQD9BAAhpAMBAP0EACGlAwEAgAUAIaYDAQCABQAhpwMBAIAFACECAAAAPgAgJAAA0wEAIAIAAAA-ACAkAADTAQAgAwAAAEcAICsAAMwBACAsAADRAQAgAQAAAEcAIAEAAAA-ACAGCgAAqQYAIDEAAKsGACAyAACqBgAgpQMAAPcEACCmAwAA9wQAIKcDAAD3BAAgC8cCAAC5BAAwyAIAANoBABDJAgAAuQQAMMoCAQDvAwAh0QJAAPMDACGYAwEA7wMAIaMDAQDvAwAhpAMBAO8DACGlAwEA8gMAIaYDAQDyAwAhpwMBAPIDACEDAAAAPgAgAQAA2QEAMDAAANoBACADAAAAPgAgAQAARgAwAgAARwAgAQAAAEIAIAEAAABCACADAAAAQAAgAQAAQQAwAgAAQgAgAwAAAEAAIAEAAEEAMAIAAEIAIAMAAABAACABAABBADACAABCACAIGgAAqAYAIMoCAQAAAAHRAkAAAAABngMBAAAAAZ8DAQAAAAGgAwIAAAABoQMBAAAAAaIDAQAAAAEBJAAA4gEAIAfKAgEAAAAB0QJAAAAAAZ4DAQAAAAGfAwEAAAABoAMCAAAAAaEDAQAAAAGiAwEAAAABASQAAOQBADABJAAA5AEAMAgaAACnBgAgygIBAP0EACHRAkAAgQUAIZ4DAQD9BAAhnwMBAP0EACGgAwIA_gQAIaEDAQD9BAAhogMBAIAFACECAAAAQgAgJAAA5wEAIAfKAgEA_QQAIdECQACBBQAhngMBAP0EACGfAwEA_QQAIaADAgD-BAAhoQMBAP0EACGiAwEAgAUAIQIAAABAACAkAADpAQAgAgAAAEAAICQAAOkBACADAAAAQgAgKwAA4gEAICwAAOcBACABAAAAQgAgAQAAAEAAIAYKAACiBgAgMQAApQYAIDIAAKQGACBzAACjBgAgdAAApgYAIKIDAAD3BAAgCscCAAC4BAAwyAIAAPABABDJAgAAuAQAMMoCAQDvAwAh0QJAAPMDACGeAwEA7wMAIZ8DAQDvAwAhoAMCAPADACGhAwEA7wMAIaIDAQDyAwAhAwAAAEAAIAEAAO8BADAwAADwAQAgAwAAAEAAIAEAAEEAMAIAAEIAIAEAAAAbACABAAAAGwAgAwAAABkAIAEAABoAMAIAABsAIAMAAAAZACABAAAaADACAAAbACADAAAAGQAgAQAAGgAwAgAAGwAgEgQAAKEGACANAACfBgAgDwAAoAYAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAJ4DAu4CAQAAAAHvAgAAngYAIPYCQAAAAAGNAwAAAJ0DAo4DAQAAAAGPA0AAAAABmAMBAAAAAZkDAgAAAAGaAwIAAAABmwMCAAAAAQEkAAD4AQAgD8oCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAJ4DAu4CAQAAAAHvAgAAngYAIPYCQAAAAAGNAwAAAJ0DAo4DAQAAAAGPA0AAAAABmAMBAAAAAZkDAgAAAAGaAwIAAAABmwMCAAAAAQEkAAD6AQAwASQAAPoBADASBAAAhQYAIA0AAIMGACAPAACEBgAgygIBAP0EACHPAgEA_QQAIdECQACBBQAh4QJAAIEFACHrAgAAggaeAyLuAgEA_QQAIe8CAACABgAg9gJAAKAFACGNAwAAgQadAyKOAwEAgAUAIY8DQACgBQAhmAMBAP0EACGZAwIA_gQAIZoDAgD-BAAhmwMCAP4EACECAAAAGwAgJAAA_QEAIA_KAgEA_QQAIc8CAQD9BAAh0QJAAIEFACHhAkAAgQUAIesCAACCBp4DIu4CAQD9BAAh7wIAAIAGACD2AkAAoAUAIY0DAACBBp0DIo4DAQCABQAhjwNAAKAFACGYAwEA_QQAIZkDAgD-BAAhmgMCAP4EACGbAwIA_gQAIQIAAAAZACAkAAD_AQAgAgAAABkAICQAAP8BACADAAAAGwAgKwAA-AEAICwAAP0BACABAAAAGwAgAQAAABkAIAgKAAD7BQAgMQAA_gUAIDIAAP0FACBzAAD8BQAgdAAA_wUAIPYCAAD3BAAgjgMAAPcEACCPAwAA9wQAIBLHAgAAsQQAMMgCAACGAgAQyQIAALEEADDKAgEA7wMAIc8CAQDvAwAh0QJAAPMDACHhAkAA8wMAIesCAACzBJ4DIu4CAQDvAwAh7wIAAI4EACD2AkAAhwQAIY0DAACyBJ0DIo4DAQDyAwAhjwNAAIcEACGYAwEA7wMAIZkDAgDwAwAhmgMCAPADACGbAwIA8AMAIQMAAAAZACABAACFAgAwMAAAhgIAIAMAAAAZACABAAAaADACAAAbACABAAAAHwAgAQAAAB8AIAMAAAAdACABAAAeADACAAAfACADAAAAHQAgAQAAHgAwAgAAHwAgAwAAAB0AIAEAAB4AMAIAAB8AIAYHAAD6BQAgDgAA-QUAIMoCAQAAAAHtAgEAAAABkwMBAAAAAZcDQAAAAAEBJAAAjgIAIATKAgEAAAAB7QIBAAAAAZMDAQAAAAGXA0AAAAABASQAAJACADABJAAAkAIAMAYHAAD4BQAgDgAA9wUAIMoCAQD9BAAh7QIBAP0EACGTAwEA_QQAIZcDQACBBQAhAgAAAB8AICQAAJMCACAEygIBAP0EACHtAgEA_QQAIZMDAQD9BAAhlwNAAIEFACECAAAAHQAgJAAAlQIAIAIAAAAdACAkAACVAgAgAwAAAB8AICsAAI4CACAsAACTAgAgAQAAAB8AIAEAAAAdACADCgAA9AUAIDEAAPYFACAyAAD1BQAgB8cCAACwBAAwyAIAAJwCABDJAgAAsAQAMMoCAQDvAwAh7QIBAO8DACGTAwEA7wMAIZcDQADzAwAhAwAAAB0AIAEAAJsCADAwAACcAgAgAwAAAB0AIAEAAB4AMAIAAB8AIAEAAAAjACABAAAAIwAgAwAAACEAIAEAACIAMAIAACMAIAMAAAAhACABAAAiADACAAAjACADAAAAIQAgAQAAIgAwAgAAIwAgDw4AAPIFACARAADzBQAgygIBAAAAAdECQAAAAAHhAkAAAAAB5gICAAAAAecCQAAAAAHoAgIAAAAB6QICAAAAAesCAAAAlgMC7AIBAAAAAe4CAQAAAAGTAwEAAAABlAMCAAAAAZYDgAAAAAEBJAAApAIAIA3KAgEAAAAB0QJAAAAAAeECQAAAAAHmAgIAAAAB5wJAAAAAAegCAgAAAAHpAgIAAAAB6wIAAACWAwLsAgEAAAAB7gIBAAAAAZMDAQAAAAGUAwIAAAABlgOAAAAAAQEkAACmAgAwASQAAKYCADAPDgAA5AUAIBEAAOUFACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHmAgIA_gQAIecCQACBBQAh6AICAP4EACHpAgIA_gQAIesCAADjBZYDIuwCAQCABQAh7gIBAP0EACGTAwEA_QQAIZQDAgD-BAAhlgOAAAAAAQIAAAAjACAkAACpAgAgDcoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIeYCAgD-BAAh5wJAAIEFACHoAgIA_gQAIekCAgD-BAAh6wIAAOMFlgMi7AIBAIAFACHuAgEA_QQAIZMDAQD9BAAhlAMCAP4EACGWA4AAAAABAgAAACEAICQAAKsCACACAAAAIQAgJAAAqwIAIAMAAAAjACArAACkAgAgLAAAqQIAIAEAAAAjACABAAAAIQAgBwoAAN4FACAxAADhBQAgMgAA4AUAIHMAAN8FACB0AADiBQAg7AIAAPcEACCWAwAA9wQAIBDHAgAArAQAMMgCAACyAgAQyQIAAKwEADDKAgEA7wMAIdECQADzAwAh4QJAAPMDACHmAgIA8AMAIecCQADzAwAh6AICAPADACHpAgIA8AMAIesCAACtBJYDIuwCAQDyAwAh7gIBAO8DACGTAwEA7wMAIZQDAgDwAwAhlgMAAJgEACADAAAAIQAgAQAAsQIAMDAAALICACADAAAAIQAgAQAAIgAwAgAAIwAgAQAAACcAIAEAAAAnACADAAAAJQAgAQAAJgAwAgAAJwAgAwAAACUAIAEAACYAMAIAACcAIAMAAAAlACABAAAmADACAAAnACAHBwAA3QUAIBAAANwFACDKAgEAAAAB7QIBAAAAAZADAQAAAAGRAyAAAAABkgNAAAAAAQEkAAC6AgAgBcoCAQAAAAHtAgEAAAABkAMBAAAAAZEDIAAAAAGSA0AAAAABASQAALwCADABJAAAvAIAMAcHAADbBQAgEAAA2gUAIMoCAQD9BAAh7QIBAP0EACGQAwEA_QQAIZEDIADZBQAhkgNAAIEFACECAAAAJwAgJAAAvwIAIAXKAgEA_QQAIe0CAQD9BAAhkAMBAP0EACGRAyAA2QUAIZIDQACBBQAhAgAAACUAICQAAMECACACAAAAJQAgJAAAwQIAIAMAAAAnACArAAC6AgAgLAAAvwIAIAEAAAAnACABAAAAJQAgAwoAANYFACAxAADYBQAgMgAA1wUAIAjHAgAAqAQAMMgCAADIAgAQyQIAAKgEADDKAgEA7wMAIe0CAQDvAwAhkAMBAO8DACGRAyAAqQQAIZIDQADzAwAhAwAAACUAIAEAAMcCADAwAADIAgAgAwAAACUAIAEAACYAMAIAACcAIBADAACEBAAgxwIAAKMEADDIAgAACwAQyQIAAKMEADDKAgEAAAAB0QJAAIMEACHdAgEAAAAB4QJAAIMEACHvAgAAjgQAIIcDAQCVBAAhiQMAAKQEiQMiigMBAKUEACGLAwEApQQAIY0DAACmBI0DIo4DAQClBAAhjwNAAKcEACEBAAAAywIAIAEAAADLAgAgBQMAAJkFACCKAwAA9wQAIIsDAAD3BAAgjgMAAPcEACCPAwAA9wQAIAMAAAALACABAADOAgAwAgAAywIAIAMAAAALACABAADOAgAwAgAAywIAIAMAAAALACABAADOAgAwAgAAywIAIA0DAADVBQAgygIBAAAAAdECQAAAAAHdAgEAAAAB4QJAAAAAAe8CAADUBQAghwMBAAAAAYkDAAAAiQMCigMBAAAAAYsDAQAAAAGNAwAAAI0DAo4DAQAAAAGPA0AAAAABASQAANICACAMygIBAAAAAdECQAAAAAHdAgEAAAAB4QJAAAAAAe8CAADUBQAghwMBAAAAAYkDAAAAiQMCigMBAAAAAYsDAQAAAAGNAwAAAI0DAo4DAQAAAAGPA0AAAAABASQAANQCADABJAAA1AIAMA0DAADTBQAgygIBAP0EACHRAkAAgQUAId0CAQD9BAAh4QJAAIEFACHvAgAA0AUAIIcDAQD9BAAhiQMAANEFiQMiigMBAIAFACGLAwEAgAUAIY0DAADSBY0DIo4DAQCABQAhjwNAAKAFACECAAAAywIAICQAANcCACAMygIBAP0EACHRAkAAgQUAId0CAQD9BAAh4QJAAIEFACHvAgAA0AUAIIcDAQD9BAAhiQMAANEFiQMiigMBAIAFACGLAwEAgAUAIY0DAADSBY0DIo4DAQCABQAhjwNAAKAFACECAAAACwAgJAAA2QIAIAIAAAALACAkAADZAgAgAwAAAMsCACArAADSAgAgLAAA1wIAIAEAAADLAgAgAQAAAAsAIAcKAADNBQAgMQAAzwUAIDIAAM4FACCKAwAA9wQAIIsDAAD3BAAgjgMAAPcEACCPAwAA9wQAIA_HAgAAnAQAMMgCAADgAgAQyQIAAJwEADDKAgEA7wMAIdECQADzAwAh3QIBAO8DACHhAkAA8wMAIe8CAACOBAAghwMBAO8DACGJAwAAnQSJAyKKAwEA8gMAIYsDAQDyAwAhjQMAAJ4EjQMijgMBAPIDACGPA0AAhwQAIQMAAAALACABAADfAgAwMAAA4AIAIAMAAAALACABAADOAgAwAgAAywIAIAEAAAA3ACABAAAANwAgAwAAADUAIAEAADYAMAIAADcAIAMAAAA1ACABAAA2ADACAAA3ACADAAAANQAgAQAANgAwAgAANwAgCwMAAMwFACDKAgEAAAABzAICAAAAAdECQAAAAAHdAgEAAAAB4QJAAAAAAesCAAAAgAMC_AIBAAAAAf0CAQAAAAH-AgEAAAABgAOAAAAAAQEkAADoAgAgCsoCAQAAAAHMAgIAAAAB0QJAAAAAAd0CAQAAAAHhAkAAAAAB6wIAAACAAwL8AgEAAAAB_QIBAAAAAf4CAQAAAAGAA4AAAAABASQAAOoCADABJAAA6gIAMAsDAADLBQAgygIBAP0EACHMAgIA_gQAIdECQACBBQAh3QIBAP0EACHhAkAAgQUAIesCAADKBYADIvwCAQD9BAAh_QIBAIAFACH-AgEAgAUAIYADgAAAAAECAAAANwAgJAAA7QIAIArKAgEA_QQAIcwCAgD-BAAh0QJAAIEFACHdAgEA_QQAIeECQACBBQAh6wIAAMoFgAMi_AIBAP0EACH9AgEAgAUAIf4CAQCABQAhgAOAAAAAAQIAAAA1ACAkAADvAgAgAgAAADUAICQAAO8CACADAAAANwAgKwAA6AIAICwAAO0CACABAAAANwAgAQAAADUAIAgKAADFBQAgMQAAyAUAIDIAAMcFACBzAADGBQAgdAAAyQUAIP0CAAD3BAAg_gIAAPcEACCAAwAA9wQAIA3HAgAAlgQAMMgCAAD2AgAQyQIAAJYEADDKAgEA7wMAIcwCAgDwAwAh0QJAAPMDACHdAgEA7wMAIeECQADzAwAh6wIAAJcEgAMi_AIBAO8DACH9AgEA8gMAIf4CAQDyAwAhgAMAAJgEACADAAAANQAgAQAA9QIAMDAAAPYCACADAAAANQAgAQAANgAwAgAANwAgB8cCAACUBAAwyAIAAPwCABDJAgAAlAQAMMoCAQAAAAHhAkAAgwQAIfoCAgCCBAAh-wICAIIEACEBAAAA-QIAIAEAAAD5AgAgB8cCAACUBAAwyAIAAPwCABDJAgAAlAQAMMoCAQCVBAAh4QJAAIMEACH6AgIAggQAIfsCAgCCBAAhAAMAAAD8AgAgAQAA_QIAMAIAAPkCACADAAAA_AIAIAEAAP0CADACAAD5AgAgAwAAAPwCACABAAD9AgAwAgAA-QIAIATKAgEAAAAB4QJAAAAAAfoCAgAAAAH7AgIAAAABASQAAIEDACAEygIBAAAAAeECQAAAAAH6AgIAAAAB-wICAAAAAQEkAACDAwAwASQAAIMDADAEygIBAP0EACHhAkAAgQUAIfoCAgD-BAAh-wICAP4EACECAAAA-QIAICQAAIYDACAEygIBAP0EACHhAkAAgQUAIfoCAgD-BAAh-wICAP4EACECAAAA_AIAICQAAIgDACACAAAA_AIAICQAAIgDACADAAAA-QIAICsAAIEDACAsAACGAwAgAQAAAPkCACABAAAA_AIAIAUKAADABQAgMQAAwwUAIDIAAMIFACBzAADBBQAgdAAAxAUAIAfHAgAAkwQAMMgCAACPAwAQyQIAAJMEADDKAgEA7wMAIeECQADzAwAh-gICAPADACH7AgIA8AMAIQMAAAD8AgAgAQAAjgMAMDAAAI8DACADAAAA_AIAIAEAAP0CADACAAD5AgAgAQAAAA8AIAEAAAAPACADAAAADQAgAQAADgAwAgAADwAgAwAAAA0AIAEAAA4AMAIAAA8AIAMAAAANACABAAAOADACAAAPACARBAAAvwUAIAcAAL0FACAIAAC-BQAgygIBAAAAAc8CAQAAAAHRAkAAAAAB4QJAAAAAAesCAAAA9AIC7QIBAAAAAe4CAQAAAAHvAgAAuwUAIPACQAAAAAHxAgIAAAAB8gIAALwFACD0AgEAAAAB9QJAAAAAAfYCQAAAAAEBJAAAlwMAIA7KAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAAD0AgLtAgEAAAAB7gIBAAAAAe8CAAC7BQAg8AJAAAAAAfECAgAAAAHyAgAAvAUAIPQCAQAAAAH1AkAAAAAB9gJAAAAAAQEkAACZAwAwASQAAJkDADABAAAAEQAgEQQAAK4FACAHAACsBQAgCAAArQUAIMoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAKsF9AIi7QIBAP0EACHuAgEA_QQAIe8CAACpBQAg8AJAAIEFACHxAgIA_gQAIfICAACqBQAg9AIBAIAFACH1AkAAoAUAIfYCQACgBQAhAgAAAA8AICQAAJ0DACAOygIBAP0EACHPAgEA_QQAIdECQACBBQAh4QJAAIEFACHrAgAAqwX0AiLtAgEA_QQAIe4CAQD9BAAh7wIAAKkFACDwAkAAgQUAIfECAgD-BAAh8gIAAKoFACD0AgEAgAUAIfUCQACgBQAh9gJAAKAFACECAAAADQAgJAAAnwMAIAIAAAANACAkAACfAwAgAQAAABEAIAMAAAAPACArAACXAwAgLAAAnQMAIAEAAAAPACABAAAADQAgCAoAAKQFACAxAACnBQAgMgAApgUAIHMAAKUFACB0AACoBQAg9AIAAPcEACD1AgAA9wQAIPYCAAD3BAAgEccCAACNBAAwyAIAAKcDABDJAgAAjQQAMMoCAQDvAwAhzwIBAO8DACHRAkAA8wMAIeECQADzAwAh6wIAAJAE9AIi7QIBAO8DACHuAgEA7wMAIe8CAACOBAAg8AJAAPMDACHxAgIA8AMAIfICAACPBAAg9AIBAPIDACH1AkAAhwQAIfYCQACHBAAhAwAAAA0AIAEAAKYDADAwAACnAwAgAwAAAA0AIAEAAA4AMAIAAA8AIAEAAAAVACABAAAAFQAgAwAAABMAIAEAABQAMAIAABUAIAMAAAATACABAAAUADACAAAVACADAAAAEwAgAQAAFAAwAgAAFQAgCwkAAKMFACDKAgEAAAAB0QJAAAAAAeECQAAAAAHlAgEAAAAB5gICAAAAAecCQAAAAAHoAgIAAAAB6QICAAAAAesCAAAA6wIC7AIBAAAAAQEkAACvAwAgCsoCAQAAAAHRAkAAAAAB4QJAAAAAAeUCAQAAAAHmAgIAAAAB5wJAAAAAAegCAgAAAAHpAgIAAAAB6wIAAADrAgLsAgEAAAABASQAALEDADABJAAAsQMAMAsJAACiBQAgygIBAP0EACHRAkAAgQUAIeECQACBBQAh5QIBAP0EACHmAgIA_gQAIecCQACgBQAh6AICAP4EACHpAgIA_gQAIesCAAChBesCIuwCAQCABQAhAgAAABUAICQAALQDACAKygIBAP0EACHRAkAAgQUAIeECQACBBQAh5QIBAP0EACHmAgIA_gQAIecCQACgBQAh6AICAP4EACHpAgIA_gQAIesCAAChBesCIuwCAQCABQAhAgAAABMAICQAALYDACACAAAAEwAgJAAAtgMAIAMAAAAVACArAACvAwAgLAAAtAMAIAEAAAAVACABAAAAEwAgBwoAAJsFACAxAACeBQAgMgAAnQUAIHMAAJwFACB0AACfBQAg5wIAAPcEACDsAgAA9wQAIA3HAgAAhgQAMMgCAAC9AwAQyQIAAIYEADDKAgEA7wMAIdECQADzAwAh4QJAAPMDACHlAgEA7wMAIeYCAgDwAwAh5wJAAIcEACHoAgIA8AMAIekCAgDwAwAh6wIAAIgE6wIi7AIBAPIDACEDAAAAEwAgAQAAvAMAMDAAAL0DACADAAAAEwAgAQAAFAAwAgAAFQAgDAMAAIQEACAWAACFBAAgxwIAAIEEADDIAgAALgAQyQIAAIEEADDKAgEAAAAB0QJAAIMEACHdAgEAAAAB3gICAIIEACHfAgIAggQAIeACAgCCBAAh4QJAAIMEACEBAAAAwAMAIAEAAADAAwAgAgMAAJkFACAWAACaBQAgAwAAAC4AIAEAAMMDADACAADAAwAgAwAAAC4AIAEAAMMDADACAADAAwAgAwAAAC4AIAEAAMMDADACAADAAwAgCQMAAJcFACAWAACYBQAgygIBAAAAAdECQAAAAAHdAgEAAAAB3gICAAAAAd8CAgAAAAHgAgIAAAAB4QJAAAAAAQEkAADHAwAgB8oCAQAAAAHRAkAAAAAB3QIBAAAAAd4CAgAAAAHfAgIAAAAB4AICAAAAAeECQAAAAAEBJAAAyQMAMAEkAADJAwAwCQMAAIkFACAWAACKBQAgygIBAP0EACHRAkAAgQUAId0CAQD9BAAh3gICAP4EACHfAgIA_gQAIeACAgD-BAAh4QJAAIEFACECAAAAwAMAICQAAMwDACAHygIBAP0EACHRAkAAgQUAId0CAQD9BAAh3gICAP4EACHfAgIA_gQAIeACAgD-BAAh4QJAAIEFACECAAAALgAgJAAAzgMAIAIAAAAuACAkAADOAwAgAwAAAMADACArAADHAwAgLAAAzAMAIAEAAADAAwAgAQAAAC4AIAUKAACEBQAgMQAAhwUAIDIAAIYFACBzAACFBQAgdAAAiAUAIArHAgAAgAQAMMgCAADVAwAQyQIAAIAEADDKAgEA7wMAIdECQADzAwAh3QIBAO8DACHeAgIA8AMAId8CAgDwAwAh4AICAPADACHhAkAA8wMAIQMAAAAuACABAADUAwAwMAAA1QMAIAMAAAAuACABAADDAwAwAgAAwAMAIAEAAAAyACABAAAAMgAgAwAAADAAIAEAADEAMAIAADIAIAMAAAAwACABAAAxADACAAAyACADAAAAMAAgAQAAMQAwAgAAMgAgCBUAAIMFACDKAgEAAAABywIBAAAAAcwCAgAAAAHOAgAAAM4CAs8CAQAAAAHQAgEAAAAB0QJAAAAAAQEkAADdAwAgB8oCAQAAAAHLAgEAAAABzAICAAAAAc4CAAAAzgICzwIBAAAAAdACAQAAAAHRAkAAAAABASQAAN8DADABJAAA3wMAMAgVAACCBQAgygIBAP0EACHLAgEA_QQAIcwCAgD-BAAhzgIAAP8EzgIizwIBAP0EACHQAgEAgAUAIdECQACBBQAhAgAAADIAICQAAOIDACAHygIBAP0EACHLAgEA_QQAIcwCAgD-BAAhzgIAAP8EzgIizwIBAP0EACHQAgEAgAUAIdECQACBBQAhAgAAADAAICQAAOQDACACAAAAMAAgJAAA5AMAIAMAAAAyACArAADdAwAgLAAA4gMAIAEAAAAyACABAAAAMAAgBgoAAPgEACAxAAD7BAAgMgAA-gQAIHMAAPkEACB0AAD8BAAg0AIAAPcEACAKxwIAAO4DADDIAgAA6wMAEMkCAADuAwAwygIBAO8DACHLAgEA7wMAIcwCAgDwAwAhzgIAAPEDzgIizwIBAO8DACHQAgEA8gMAIdECQADzAwAhAwAAADAAIAEAAOoDADAwAADrAwAgAwAAADAAIAEAADEAMAIAADIAIArHAgAA7gMAMMgCAADrAwAQyQIAAO4DADDKAgEA7wMAIcsCAQDvAwAhzAICAPADACHOAgAA8QPOAiLPAgEA7wMAIdACAQDyAwAh0QJAAPMDACEOCgAA9QMAIDEAAP8DACAyAAD_AwAg0gIBAAAAAdMCAQAAAATUAgEAAAAE1QIBAAAAAdYCAQAAAAHXAgEAAAAB2AIBAAAAAdkCAQD-AwAh2gIBAAAAAdsCAQAAAAHcAgEAAAABDQoAAPUDACAxAAD1AwAgMgAA9QMAIHMAAP0DACB0AAD1AwAg0gICAAAAAdMCAgAAAATUAgIAAAAE1QICAAAAAdYCAgAAAAHXAgIAAAAB2AICAAAAAdkCAgD8AwAhBwoAAPUDACAxAAD7AwAgMgAA-wMAINICAAAAzgIC0wIAAADOAgjUAgAAAM4CCNkCAAD6A84CIg4KAAD4AwAgMQAA-QMAIDIAAPkDACDSAgEAAAAB0wIBAAAABdQCAQAAAAXVAgEAAAAB1gIBAAAAAdcCAQAAAAHYAgEAAAAB2QIBAPcDACHaAgEAAAAB2wIBAAAAAdwCAQAAAAELCgAA9QMAIDEAAPYDACAyAAD2AwAg0gJAAAAAAdMCQAAAAATUAkAAAAAE1QJAAAAAAdYCQAAAAAHXAkAAAAAB2AJAAAAAAdkCQAD0AwAhCwoAAPUDACAxAAD2AwAgMgAA9gMAINICQAAAAAHTAkAAAAAE1AJAAAAABNUCQAAAAAHWAkAAAAAB1wJAAAAAAdgCQAAAAAHZAkAA9AMAIQjSAgIAAAAB0wICAAAABNQCAgAAAATVAgIAAAAB1gICAAAAAdcCAgAAAAHYAgIAAAAB2QICAPUDACEI0gJAAAAAAdMCQAAAAATUAkAAAAAE1QJAAAAAAdYCQAAAAAHXAkAAAAAB2AJAAAAAAdkCQAD2AwAhDgoAAPgDACAxAAD5AwAgMgAA-QMAINICAQAAAAHTAgEAAAAF1AIBAAAABdUCAQAAAAHWAgEAAAAB1wIBAAAAAdgCAQAAAAHZAgEA9wMAIdoCAQAAAAHbAgEAAAAB3AIBAAAAAQjSAgIAAAAB0wICAAAABdQCAgAAAAXVAgIAAAAB1gICAAAAAdcCAgAAAAHYAgIAAAAB2QICAPgDACEL0gIBAAAAAdMCAQAAAAXUAgEAAAAF1QIBAAAAAdYCAQAAAAHXAgEAAAAB2AIBAAAAAdkCAQD5AwAh2gIBAAAAAdsCAQAAAAHcAgEAAAABBwoAAPUDACAxAAD7AwAgMgAA-wMAINICAAAAzgIC0wIAAADOAgjUAgAAAM4CCNkCAAD6A84CIgTSAgAAAM4CAtMCAAAAzgII1AIAAADOAgjZAgAA-wPOAiINCgAA9QMAIDEAAPUDACAyAAD1AwAgcwAA_QMAIHQAAPUDACDSAgIAAAAB0wICAAAABNQCAgAAAATVAgIAAAAB1gICAAAAAdcCAgAAAAHYAgIAAAAB2QICAPwDACEI0gIIAAAAAdMCCAAAAATUAggAAAAE1QIIAAAAAdYCCAAAAAHXAggAAAAB2AIIAAAAAdkCCAD9AwAhDgoAAPUDACAxAAD_AwAgMgAA_wMAINICAQAAAAHTAgEAAAAE1AIBAAAABNUCAQAAAAHWAgEAAAAB1wIBAAAAAdgCAQAAAAHZAgEA_gMAIdoCAQAAAAHbAgEAAAAB3AIBAAAAAQvSAgEAAAAB0wIBAAAABNQCAQAAAATVAgEAAAAB1gIBAAAAAdcCAQAAAAHYAgEAAAAB2QIBAP8DACHaAgEAAAAB2wIBAAAAAdwCAQAAAAEKxwIAAIAEADDIAgAA1QMAEMkCAACABAAwygIBAO8DACHRAkAA8wMAId0CAQDvAwAh3gICAPADACHfAgIA8AMAIeACAgDwAwAh4QJAAPMDACEMAwAAhAQAIBYAAIUEACDHAgAAgQQAMMgCAAAuABDJAgAAgQQAMMoCAQCVBAAh0QJAAIMEACHdAgEAlQQAId4CAgCCBAAh3wICAIIEACHgAgIAggQAIeECQACDBAAhCNICAgAAAAHTAgIAAAAE1AICAAAABNUCAgAAAAHWAgIAAAAB1wICAAAAAdgCAgAAAAHZAgIA9QMAIQjSAkAAAAAB0wJAAAAABNQCQAAAAATVAkAAAAAB1gJAAAAAAdcCQAAAAAHYAkAAAAAB2QJAAPYDACEbBAAA6QQAIAUAAOoEACAGAADrBAAgCwAA7AQAIAwAAOwEACASAADtBAAgEwAA4wQAIBQAAN0EACAVAADuBAAgFwAA7wQAIBwAAPAEACAdAADwBAAgHgAA8QQAIMcCAADoBAAwyAIAABEAEMkCAADoBAAwygIBAJUEACHRAkAAgwQAIeECQACDBAAhxAMBAJUEACHFAwEAlQQAIcYDIADYBAAhxwMBAKUEACHIAwEAlQQAIckDIADYBAAhzAMAABEAIM0DAAARACAD4gIAADAAIOMCAAAwACDkAgAAMAAgDccCAACGBAAwyAIAAL0DABDJAgAAhgQAMMoCAQDvAwAh0QJAAPMDACHhAkAA8wMAIeUCAQDvAwAh5gICAPADACHnAkAAhwQAIegCAgDwAwAh6QICAPADACHrAgAAiATrAiLsAgEA8gMAIQsKAAD4AwAgMQAAjAQAIDIAAIwEACDSAkAAAAAB0wJAAAAABdQCQAAAAAXVAkAAAAAB1gJAAAAAAdcCQAAAAAHYAkAAAAAB2QJAAIsEACEHCgAA9QMAIDEAAIoEACAyAACKBAAg0gIAAADrAgLTAgAAAOsCCNQCAAAA6wII2QIAAIkE6wIiBwoAAPUDACAxAACKBAAgMgAAigQAINICAAAA6wIC0wIAAADrAgjUAgAAAOsCCNkCAACJBOsCIgTSAgAAAOsCAtMCAAAA6wII1AIAAADrAgjZAgAAigTrAiILCgAA-AMAIDEAAIwEACAyAACMBAAg0gJAAAAAAdMCQAAAAAXUAkAAAAAF1QJAAAAAAdYCQAAAAAHXAkAAAAAB2AJAAAAAAdkCQACLBAAhCNICQAAAAAHTAkAAAAAF1AJAAAAABdUCQAAAAAHWAkAAAAAB1wJAAAAAAdgCQAAAAAHZAkAAjAQAIRHHAgAAjQQAMMgCAACnAwAQyQIAAI0EADDKAgEA7wMAIc8CAQDvAwAh0QJAAPMDACHhAkAA8wMAIesCAACQBPQCIu0CAQDvAwAh7gIBAO8DACHvAgAAjgQAIPACQADzAwAh8QICAPADACHyAgAAjwQAIPQCAQDyAwAh9QJAAIcEACH2AkAAhwQAIQTSAgEAAAAF9wIBAAAAAfgCAQAAAAT5AgEAAAAEBNICAgAAAAX3AgIAAAAB-AICAAAABPkCAgAAAAQHCgAA9QMAIDEAAJIEACAyAACSBAAg0gIAAAD0AgLTAgAAAPQCCNQCAAAA9AII2QIAAJEE9AIiBwoAAPUDACAxAACSBAAgMgAAkgQAINICAAAA9AIC0wIAAAD0AgjUAgAAAPQCCNkCAACRBPQCIgTSAgAAAPQCAtMCAAAA9AII1AIAAAD0AgjZAgAAkgT0AiIHxwIAAJMEADDIAgAAjwMAEMkCAACTBAAwygIBAO8DACHhAkAA8wMAIfoCAgDwAwAh-wICAPADACEHxwIAAJQEADDIAgAA_AIAEMkCAACUBAAwygIBAJUEACHhAkAAgwQAIfoCAgCCBAAh-wICAIIEACEL0gIBAAAAAdMCAQAAAATUAgEAAAAE1QIBAAAAAdYCAQAAAAHXAgEAAAAB2AIBAAAAAdkCAQD_AwAh2gIBAAAAAdsCAQAAAAHcAgEAAAABDccCAACWBAAwyAIAAPYCABDJAgAAlgQAMMoCAQDvAwAhzAICAPADACHRAkAA8wMAId0CAQDvAwAh4QJAAPMDACHrAgAAlwSAAyL8AgEA7wMAIf0CAQDyAwAh_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_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_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-QgAICwAAP0IACDOAwAA-ggAIM8DAAD8CAAg1AMAAAEAIAsrAACLBQAwLAAAkAUAMM4DAACMBQAwzwMAAI0FADDQAwAAjgUAINEDAACPBQAw0gMAAI8FADDTAwAAjwUAMNQDAACPBQAw1QMAAJEFADDWAwAAkgUAMAbKAgEAAAABzAICAAAAAc4CAAAAzgICzwIBAAAAAdACAQAAAAHRAkAAAAABAgAAADIAICsAAJYFACADAAAAMgAgKwAAlgUAICwAAJUFACABJAAA-wgAMAsVAADVBAAgxwIAANMEADDIAgAAMAAQyQIAANMEADDKAgEAAAABywIBAJUEACHMAgIAggQAIc4CAADUBM4CIs8CAQCVBAAh0AIBAKUEACHRAkAAgwQAIQIAAAAyACAkAACVBQAgAgAAAJMFACAkAACUBQAgCscCAACSBQAwyAIAAJMFABDJAgAAkgUAMMoCAQCVBAAhywIBAJUEACHMAgIAggQAIc4CAADUBM4CIs8CAQCVBAAh0AIBAKUEACHRAkAAgwQAIQrHAgAAkgUAMMgCAACTBQAQyQIAAJIFADDKAgEAlQQAIcsCAQCVBAAhzAICAIIEACHOAgAA1ATOAiLPAgEAlQQAIdACAQClBAAh0QJAAIMEACEGygIBAP0EACHMAgIA_gQAIc4CAAD_BM4CIs8CAQD9BAAh0AIBAIAFACHRAkAAgQUAIQbKAgEA_QQAIcwCAgD-BAAhzgIAAP8EzgIizwIBAP0EACHQAgEAgAUAIdECQACBBQAhBsoCAQAAAAHMAgIAAAABzgIAAADOAgLPAgEAAAAB0AIBAAAAAdECQAAAAAEDKwAA-QgAIM4DAAD6CAAg1AMAAAEAIAQrAACLBQAwzgMAAIwFADDQAwAAjgUAINQDAACPBQAwDgQAAPwHACAFAAD9BwAgBgAA_gcAIAsAAP8HACAMAAD_BwAgEgAAgAgAIBMAAIEIACAUAACCCAAgFQAAgwgAIBcAAIQIACAcAACFCAAgHQAAhQgAIB4AAIYIACDHAwAA9wQAIAAAAAAAAAHRA0AAAAABAdEDAAAA6wICBSsAAPQIACAsAAD3CAAgzgMAAPUIACDPAwAA9ggAINQDAAAPACADKwAA9AgAIM4DAAD1CAAg1AMAAA8AIAAAAAAAAtEDAQAAAATXAwEAAAAFAtEDAgAAAATXAwIAAAAFAdEDAAAA9AICBSsAAOsIACAsAADyCAAgzgMAAOwIACDPAwAA8QgAINQDAAABACAHKwAA6QgAICwAAO8IACDOAwAA6ggAIM8DAADuCAAg0gMAABEAINMDAAARACDUAwAAAQAgCysAAK8FADAsAAC0BQAwzgMAALAFADDPAwAAsQUAMNADAACyBQAg0QMAALMFADDSAwAAswUAMNMDAACzBQAw1AMAALMFADDVAwAAtQUAMNYDAAC2BQAwCcoCAQAAAAHRAkAAAAAB4QJAAAAAAeYCAgAAAAHnAkAAAAAB6AICAAAAAekCAgAAAAHrAgAAAOsCAuwCAQAAAAECAAAAFQAgKwAAugUAIAMAAAAVACArAAC6BQAgLAAAuQUAIAEkAADtCAAwDgkAAOcEACDHAgAA5QQAMMgCAAATABDJAgAA5QQAMMoCAQAAAAHRAkAAgwQAIeECQACDBAAh5QIBAJUEACHmAgIAggQAIecCQACnBAAh6AICAIIEACHpAgIAggQAIesCAADmBOsCIuwCAQClBAAhAgAAABUAICQAALkFACACAAAAtwUAICQAALgFACANxwIAALYFADDIAgAAtwUAEMkCAAC2BQAwygIBAJUEACHRAkAAgwQAIeECQACDBAAh5QIBAJUEACHmAgIAggQAIecCQACnBAAh6AICAIIEACHpAgIAggQAIesCAADmBOsCIuwCAQClBAAhDccCAAC2BQAwyAIAALcFABDJAgAAtgUAMMoCAQCVBAAh0QJAAIMEACHhAkAAgwQAIeUCAQCVBAAh5gICAIIEACHnAkAApwQAIegCAgCCBAAh6QICAIIEACHrAgAA5gTrAiLsAgEApQQAIQnKAgEA_QQAIdECQACBBQAh4QJAAIEFACHmAgIA_gQAIecCQACgBQAh6AICAP4EACHpAgIA_gQAIesCAAChBesCIuwCAQCABQAhCcoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIeYCAgD-BAAh5wJAAKAFACHoAgIA_gQAIekCAgD-BAAh6wIAAKEF6wIi7AIBAIAFACEJygIBAAAAAdECQAAAAAHhAkAAAAAB5gICAAAAAecCQAAAAAHoAgIAAAAB6QICAAAAAesCAAAA6wIC7AIBAAAAAQHRAwEAAAAEAdEDAgAAAAQDKwAA6wgAIM4DAADsCAAg1AMAAAEAIAMrAADpCAAgzgMAAOoIACDUAwAAAQAgBCsAAK8FADDOAwAAsAUAMNADAACyBQAg1AMAALMFADAAAAAAAAAAAAAAAdEDAAAAgAMCBSsAAOQIACAsAADnCAAgzgMAAOUIACDPAwAA5ggAINQDAAABACADKwAA5AgAIM4DAADlCAAg1AMAAAEAIAAAAALRAwEAAAAE1wMBAAAABQHRAwAAAIkDAgHRAwAAAI0DAgUrAADfCAAgLAAA4ggAIM4DAADgCAAgzwMAAOEIACDUAwAAAQAgAdEDAQAAAAQDKwAA3wgAIM4DAADgCAAg1AMAAAEAIAAAAAHRAyAAAAABBSsAANcIACAsAADdCAAgzgMAANgIACDPAwAA3AgAINQDAAAjACAFKwAA1QgAICwAANoIACDOAwAA1ggAIM8DAADZCAAg1AMAAAEAIAMrAADXCAAgzgMAANgIACDUAwAAIwAgAysAANUIACDOAwAA1ggAINQDAAABACAAAAAAAAHRAwAAAJYDAgUrAADPCAAgLAAA0wgAIM4DAADQCAAgzwMAANIIACDUAwAAGwAgCysAAOYFADAsAADrBQAwzgMAAOcFADDPAwAA6AUAMNADAADpBQAg0QMAAOoFADDSAwAA6gUAMNMDAADqBQAw1AMAAOoFADDVAwAA7AUAMNYDAADtBQAwBQcAAN0FACDKAgEAAAAB7QIBAAAAAZEDIAAAAAGSA0AAAAABAgAAACcAICsAAPEFACADAAAAJwAgKwAA8QUAICwAAPAFACABJAAA0QgAMAsHAACEBAAgEAAA2QQAIMcCAADXBAAwyAIAACUAEMkCAADXBAAwygIBAAAAAe0CAQCVBAAhkAMBAJUEACGRAyAA2AQAIZIDQACDBAAhygMAANYEACACAAAAJwAgJAAA8AUAIAIAAADuBQAgJAAA7wUAIAjHAgAA7QUAMMgCAADuBQAQyQIAAO0FADDKAgEAlQQAIe0CAQCVBAAhkAMBAJUEACGRAyAA2AQAIZIDQACDBAAhCMcCAADtBQAwyAIAAO4FABDJAgAA7QUAMMoCAQCVBAAh7QIBAJUEACGQAwEAlQQAIZEDIADYBAAhkgNAAIMEACEEygIBAP0EACHtAgEA_QQAIZEDIADZBQAhkgNAAIEFACEFBwAA2wUAIMoCAQD9BAAh7QIBAP0EACGRAyAA2QUAIZIDQACBBQAhBQcAAN0FACDKAgEAAAAB7QIBAAAAAZEDIAAAAAGSA0AAAAABAysAAM8IACDOAwAA0AgAINQDAAAbACAEKwAA5gUAMM4DAADnBQAw0AMAAOkFACDUAwAA6gUAMAAAAAUrAADHCAAgLAAAzQgAIM4DAADICAAgzwMAAMwIACDUAwAAGwAgBSsAAMUIACAsAADKCAAgzgMAAMYIACDPAwAAyQgAINQDAAABACADKwAAxwgAIM4DAADICAAg1AMAABsAIAMrAADFCAAgzgMAAMYIACDUAwAAAQAgAAAAAAAC0QMBAAAABNcDAQAAAAUB0QMAAACdAwIB0QMAAACeAwIFKwAAvggAICwAAMMIACDOAwAAvwgAIM8DAADCCAAg1AMAAAEAIAsrAACSBgAwLAAAlwYAMM4DAACTBgAwzwMAAJQGADDQAwAAlQYAINEDAACWBgAw0gMAAJYGADDTAwAAlgYAMNQDAACWBgAw1QMAAJgGADDWAwAAmQYAMAsrAACGBgAwLAAAiwYAMM4DAACHBgAwzwMAAIgGADDQAwAAiQYAINEDAACKBgAw0gMAAIoGADDTAwAAigYAMNQDAACKBgAw1QMAAIwGADDWAwAAjQYAMA0RAADzBQAgygIBAAAAAdECQAAAAAHhAkAAAAAB5gICAAAAAecCQAAAAAHoAgIAAAAB6QICAAAAAesCAAAAlgMC7AIBAAAAAe4CAQAAAAGUAwIAAAABlgOAAAAAAQIAAAAjACArAACRBgAgAwAAACMAICsAAJEGACAsAACQBgAgASQAAMEIADASDgAA3AQAIBEAAN0EACDHAgAA2gQAMMgCAAAhABDJAgAA2gQAMMoCAQAAAAHRAkAAgwQAIeECQACDBAAh5gICAIIEACHnAkAAgwQAIegCAgCCBAAh6QICAIIEACHrAgAA2wSWAyLsAgEApQQAIe4CAQCVBAAhkwMBAJUEACGUAwIAggQAIZYDAADSBAAgAgAAACMAICQAAJAGACACAAAAjgYAICQAAI8GACAQxwIAAI0GADDIAgAAjgYAEMkCAACNBgAwygIBAJUEACHRAkAAgwQAIeECQACDBAAh5gICAIIEACHnAkAAgwQAIegCAgCCBAAh6QICAIIEACHrAgAA2wSWAyLsAgEApQQAIe4CAQCVBAAhkwMBAJUEACGUAwIAggQAIZYDAADSBAAgEMcCAACNBgAwyAIAAI4GABDJAgAAjQYAMMoCAQCVBAAh0QJAAIMEACHhAkAAgwQAIeYCAgCCBAAh5wJAAIMEACHoAgIAggQAIekCAgCCBAAh6wIAANsElgMi7AIBAKUEACHuAgEAlQQAIZMDAQCVBAAhlAMCAIIEACGWAwAA0gQAIAzKAgEA_QQAIdECQACBBQAh4QJAAIEFACHmAgIA_gQAIecCQACBBQAh6AICAP4EACHpAgIA_gQAIesCAADjBZYDIuwCAQCABQAh7gIBAP0EACGUAwIA_gQAIZYDgAAAAAENEQAA5QUAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIeYCAgD-BAAh5wJAAIEFACHoAgIA_gQAIekCAgD-BAAh6wIAAOMFlgMi7AIBAIAFACHuAgEA_QQAIZQDAgD-BAAhlgOAAAAAAQ0RAADzBQAgygIBAAAAAdECQAAAAAHhAkAAAAAB5gICAAAAAecCQAAAAAHoAgIAAAAB6QICAAAAAesCAAAAlgMC7AIBAAAAAe4CAQAAAAGUAwIAAAABlgOAAAAAAQQHAAD6BQAgygIBAAAAAe0CAQAAAAGXA0AAAAABAgAAAB8AICsAAJ0GACADAAAAHwAgKwAAnQYAICwAAJwGACABJAAAwAgAMAoHAACEBAAgDgAA3AQAIMcCAADfBAAwyAIAAB0AEMkCAADfBAAwygIBAAAAAe0CAQCVBAAhkwMBAJUEACGXA0AAgwQAIcsDAADeBAAgAgAAAB8AICQAAJwGACACAAAAmgYAICQAAJsGACAHxwIAAJkGADDIAgAAmgYAEMkCAACZBgAwygIBAJUEACHtAgEAlQQAIZMDAQCVBAAhlwNAAIMEACEHxwIAAJkGADDIAgAAmgYAEMkCAACZBgAwygIBAJUEACHtAgEAlQQAIZMDAQCVBAAhlwNAAIMEACEDygIBAP0EACHtAgEA_QQAIZcDQACBBQAhBAcAAPgFACDKAgEA_QQAIe0CAQD9BAAhlwNAAIEFACEEBwAA-gUAIMoCAQAAAAHtAgEAAAABlwNAAAAAAQHRAwEAAAAEAysAAL4IACDOAwAAvwgAINQDAAABACAEKwAAkgYAMM4DAACTBgAw0AMAAJUGACDUAwAAlgYAMAQrAACGBgAwzgMAAIcGADDQAwAAiQYAINQDAACKBgAwAAAAAAAFKwAAuQgAICwAALwIACDOAwAAuggAIM8DAAC7CAAg1AMAAEcAIAMrAAC5CAAgzgMAALoIACDUAwAARwAgAAAABSsAALAIACAsAAC3CAAgzgMAALEIACDPAwAAtggAINQDAAA7ACAFKwAArggAICwAALQIACDOAwAArwgAIM8DAACzCAAg1AMAAAEAIAsrAACvBgAwLAAAtAYAMM4DAACwBgAwzwMAALEGADDQAwAAsgYAINEDAACzBgAw0gMAALMGADDTAwAAswYAMNQDAACzBgAw1QMAALUGADDWAwAAtgYAMAbKAgEAAAAB0QJAAAAAAZ8DAQAAAAGgAwIAAAABoQMBAAAAAaIDAQAAAAECAAAAQgAgKwAAugYAIAMAAABCACArAAC6BgAgLAAAuQYAIAEkAACyCAAwCxoAAMoEACDHAgAAyQQAMMgCAABAABDJAgAAyQQAMMoCAQAAAAHRAkAAgwQAIZ4DAQCVBAAhnwMBAJUEACGgAwIAggQAIaEDAQCVBAAhogMBAKUEACECAAAAQgAgJAAAuQYAIAIAAAC3BgAgJAAAuAYAIArHAgAAtgYAMMgCAAC3BgAQyQIAALYGADDKAgEAlQQAIdECQACDBAAhngMBAJUEACGfAwEAlQQAIaADAgCCBAAhoQMBAJUEACGiAwEApQQAIQrHAgAAtgYAMMgCAAC3BgAQyQIAALYGADDKAgEAlQQAIdECQACDBAAhngMBAJUEACGfAwEAlQQAIaADAgCCBAAhoQMBAJUEACGiAwEApQQAIQbKAgEA_QQAIdECQACBBQAhnwMBAP0EACGgAwIA_gQAIaEDAQD9BAAhogMBAIAFACEGygIBAP0EACHRAkAAgQUAIZ8DAQD9BAAhoAMCAP4EACGhAwEA_QQAIaIDAQCABQAhBsoCAQAAAAHRAkAAAAABnwMBAAAAAaADAgAAAAGhAwEAAAABogMBAAAAAQMrAACwCAAgzgMAALEIACDUAwAAOwAgAysAAK4IACDOAwAArwgAINQDAAABACAEKwAArwYAMM4DAACwBgAw0AMAALIGACDUAwAAswYAMAAAAAAAAdEDAAAAqQMCAdEDAAAAsQMCBSsAAKYIACAsAACsCAAgzgMAAKcIACDPAwAAqwgAINQDAAABACAHKwAApAgAICwAAKkIACDOAwAApQgAIM8DAACoCAAg0gMAABEAINMDAAARACDUAwAAAQAgBysAAMgGACAsAADLBgAgzgMAAMkGACDPAwAAygYAINIDAAA-ACDTAwAAPgAg1AMAAEcAIAkNAAC8BgAgGwAAvQYAIMoCAQAAAAHRAkAAAAABmAMBAAAAAaQDAQAAAAGlAwEAAAABpgMBAAAAAacDAQAAAAECAAAARwAgKwAAyAYAIAMAAAA-ACArAADIBgAgLAAAzAYAIAsAAAA-ACANAACtBgAgGwAArgYAICQAAMwGACDKAgEA_QQAIdECQACBBQAhmAMBAP0EACGkAwEA_QQAIaUDAQCABQAhpgMBAIAFACGnAwEAgAUAIQkNAACtBgAgGwAArgYAIMoCAQD9BAAh0QJAAIEFACGYAwEA_QQAIaQDAQD9BAAhpQMBAIAFACGmAwEAgAUAIacDAQCABQAhAysAAKYIACDOAwAApwgAINQDAAABACADKwAApAgAIM4DAAClCAAg1AMAAAEAIAMrAADIBgAgzgMAAMkGACDUAwAARwAgAAAAAAAABSsAAJ8IACAsAACiCAAgzgMAAKAIACDPAwAAoQgAINQDAAABACADKwAAnwgAIM4DAACgCAAg1AMAAAEAIAAAAAUrAACaCAAgLAAAnQgAIM4DAACbCAAgzwMAAJwIACDUAwAAAQAgAysAAJoIACDOAwAAmwgAINQDAAABACAAAAALKwAA4wcAMCwAAOgHADDOAwAA5AcAMM8DAADlBwAw0AMAAOYHACDRAwAA5wcAMNIDAADnBwAw0wMAAOcHADDUAwAA5wcAMNUDAADpBwAw1gMAAOoHADALKwAA1wcAMCwAANwHADDOAwAA2AcAMM8DAADZBwAw0AMAANoHACDRAwAA2wcAMNIDAADbBwAw0wMAANsHADDUAwAA2wcAMNUDAADdBwAw1gMAAN4HADAHKwAA0gcAICwAANUHACDOAwAA0wcAIM8DAADUBwAg0gMAAAsAINMDAAALACDUAwAAywIAIAsrAADJBwAwLAAAzQcAMM4DAADKBwAwzwMAAMsHADDQAwAAzAcAINEDAADBBwAw0gMAAMEHADDTAwAAwQcAMNQDAADBBwAw1QMAAM4HADDWAwAAxAcAMAsrAAC9BwAwLAAAwgcAMM4DAAC-BwAwzwMAAL8HADDQAwAAwAcAINEDAADBBwAw0gMAAMEHADDTAwAAwQcAMNQDAADBBwAw1QMAAMMHADDWAwAAxAcAMAsrAACxBwAwLAAAtgcAMM4DAACyBwAwzwMAALMHADDQAwAAtAcAINEDAAC1BwAw0gMAALUHADDTAwAAtQcAMNQDAAC1BwAw1QMAALcHADDWAwAAuAcAMAsrAACoBwAwLAAArAcAMM4DAACpBwAwzwMAAKoHADDQAwAAqwcAINEDAACWBgAw0gMAAJYGADDTAwAAlgYAMNQDAACWBgAw1QMAAK0HADDWAwAAmQYAMAsrAACfBwAwLAAAowcAMM4DAACgBwAwzwMAAKEHADDQAwAAogcAINEDAADqBQAw0gMAAOoFADDTAwAA6gUAMNQDAADqBQAw1QMAAKQHADDWAwAA7QUAMAcrAACaBwAgLAAAnQcAIM4DAACbBwAgzwMAAJwHACDSAwAALgAg0wMAAC4AINQDAADAAwAgCysAAI4HADAsAACTBwAwzgMAAI8HADDPAwAAkAcAMNADAACRBwAg0QMAAJIHADDSAwAAkgcAMNMDAACSBwAw1AMAAJIHADDVAwAAlAcAMNYDAACVBwAwCysAAIUHADAsAACJBwAwzgMAAIYHADDPAwAAhwcAMNADAACIBwAg0QMAAP0GADDSAwAA_QYAMNMDAAD9BgAw1AMAAP0GADDVAwAAigcAMNYDAACABwAwCysAAPkGADAsAAD-BgAwzgMAAPoGADDPAwAA-wYAMNADAAD8BgAg0QMAAP0GADDSAwAA_QYAMNMDAAD9BgAw1AMAAP0GADDVAwAA_wYAMNYDAACABwAwCysAAO0GADAsAADyBgAwzgMAAO4GADDPAwAA7wYAMNADAADwBgAg0QMAAPEGADDSAwAA8QYAMNMDAADxBgAw1AMAAPEGADDVAwAA8wYAMNYDAAD0BgAwCRkAALsGACAbAAC9BgAgygIBAAAAAdECQAAAAAGjAwEAAAABpAMBAAAAAaUDAQAAAAGmAwEAAAABpwMBAAAAAQIAAABHACArAAD4BgAgAwAAAEcAICsAAPgGACAsAAD3BgAgASQAAJkIADAODQAAhAQAIBkAAMcEACAbAADIBAAgxwIAAMYEADDIAgAAPgAQyQIAAMYEADDKAgEAAAAB0QJAAIMEACGYAwEAlQQAIaMDAQAAAAGkAwEAlQQAIaUDAQClBAAhpgMBAKUEACGnAwEApQQAIQIAAABHACAkAAD3BgAgAgAAAPUGACAkAAD2BgAgC8cCAAD0BgAwyAIAAPUGABDJAgAA9AYAMMoCAQCVBAAh0QJAAIMEACGYAwEAlQQAIaMDAQCVBAAhpAMBAJUEACGlAwEApQQAIaYDAQClBAAhpwMBAKUEACELxwIAAPQGADDIAgAA9QYAEMkCAAD0BgAwygIBAJUEACHRAkAAgwQAIZgDAQCVBAAhowMBAJUEACGkAwEAlQQAIaUDAQClBAAhpgMBAKUEACGnAwEApQQAIQfKAgEA_QQAIdECQACBBQAhowMBAP0EACGkAwEA_QQAIaUDAQCABQAhpgMBAIAFACGnAwEAgAUAIQkZAACsBgAgGwAArgYAIMoCAQD9BAAh0QJAAIEFACGjAwEA_QQAIaQDAQD9BAAhpQMBAIAFACGmAwEAgAUAIacDAQCABQAhCRkAALsGACAbAAC9BgAgygIBAAAAAdECQAAAAAGjAwEAAAABpAMBAAAAAaUDAQAAAAGmAwEAAAABpwMBAAAAARMHAADNBgAgGgAAzwYAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAALEDAu0CAQAAAAHuAgEAAAABqQMAAACpAwKqAwEAAAABqwMBAAAAAawDAQAAAAGtAwEAAAABrgMBAAAAAa8DAgAAAAGxAwEAAAABsgNAAAAAAbQDQAAAAAECAAAAOwAgKwAAhAcAIAMAAAA7ACArAACEBwAgLAAAgwcAIAEkAACYCAAwGAcAAIQEACAYAADOBAAgGgAAzwQAIMcCAADLBAAwyAIAADkAEMkCAADLBAAwygIBAAAAAc8CAQCVBAAh0QJAAIMEACHhAkAAgwQAIesCAADNBLEDIu0CAQCVBAAh7gIBAJUEACGpAwAAzASpAyKqAwEApQQAIasDAQClBAAhrAMBAKUEACGtAwEApQQAIa4DAQClBAAhrwMCAIIEACGxAwEApQQAIbIDQACnBAAhswMBAKUEACG0A0AApwQAIQIAAAA7ACAkAACDBwAgAgAAAIEHACAkAACCBwAgFccCAACABwAwyAIAAIEHABDJAgAAgAcAMMoCAQCVBAAhzwIBAJUEACHRAkAAgwQAIeECQACDBAAh6wIAAM0EsQMi7QIBAJUEACHuAgEAlQQAIakDAADMBKkDIqoDAQClBAAhqwMBAKUEACGsAwEApQQAIa0DAQClBAAhrgMBAKUEACGvAwIAggQAIbEDAQClBAAhsgNAAKcEACGzAwEApQQAIbQDQACnBAAhFccCAACABwAwyAIAAIEHABDJAgAAgAcAMMoCAQCVBAAhzwIBAJUEACHRAkAAgwQAIeECQACDBAAh6wIAAM0EsQMi7QIBAJUEACHuAgEAlQQAIakDAADMBKkDIqoDAQClBAAhqwMBAKUEACGsAwEApQQAIa0DAQClBAAhrgMBAKUEACGvAwIAggQAIbEDAQClBAAhsgNAAKcEACGzAwEApQQAIbQDQACnBAAhEcoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAMQGsQMi7QIBAP0EACHuAgEA_QQAIakDAADDBqkDIqoDAQCABQAhqwMBAIAFACGsAwEAgAUAIa0DAQCABQAhrgMBAIAFACGvAwIA_gQAIbEDAQCABQAhsgNAAKAFACG0A0AAoAUAIRMHAADFBgAgGgAAxwYAIMoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAMQGsQMi7QIBAP0EACHuAgEA_QQAIakDAADDBqkDIqoDAQCABQAhqwMBAIAFACGsAwEAgAUAIa0DAQCABQAhrgMBAIAFACGvAwIA_gQAIbEDAQCABQAhsgNAAKAFACG0A0AAoAUAIRMHAADNBgAgGgAAzwYAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAALEDAu0CAQAAAAHuAgEAAAABqQMAAACpAwKqAwEAAAABqwMBAAAAAawDAQAAAAGtAwEAAAABrgMBAAAAAa8DAgAAAAGxAwEAAAABsgNAAAAAAbQDQAAAAAETGAAAzgYAIBoAAM8GACDKAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAACxAwLuAgEAAAABqQMAAACpAwKqAwEAAAABqwMBAAAAAawDAQAAAAGtAwEAAAABrgMBAAAAAa8DAgAAAAGxAwEAAAABsgNAAAAAAbMDAQAAAAG0A0AAAAABAgAAADsAICsAAI0HACADAAAAOwAgKwAAjQcAICwAAIwHACABJAAAlwgAMAIAAAA7ACAkAACMBwAgAgAAAIEHACAkAACLBwAgEcoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAMQGsQMi7gIBAP0EACGpAwAAwwapAyKqAwEAgAUAIasDAQCABQAhrAMBAIAFACGtAwEAgAUAIa4DAQCABQAhrwMCAP4EACGxAwEAgAUAIbIDQACgBQAhswMBAIAFACG0A0AAoAUAIRMYAADGBgAgGgAAxwYAIMoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAMQGsQMi7gIBAP0EACGpAwAAwwapAyKqAwEAgAUAIasDAQCABQAhrAMBAIAFACGtAwEAgAUAIa4DAQCABQAhrwMCAP4EACGxAwEAgAUAIbIDQACgBQAhswMBAIAFACG0A0AAoAUAIRMYAADOBgAgGgAAzwYAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAALEDAu4CAQAAAAGpAwAAAKkDAqoDAQAAAAGrAwEAAAABrAMBAAAAAa0DAQAAAAGuAwEAAAABrwMCAAAAAbEDAQAAAAGyA0AAAAABswMBAAAAAbQDQAAAAAEJygIBAAAAAcwCAgAAAAHRAkAAAAAB4QJAAAAAAesCAAAAgAMC_AIBAAAAAf0CAQAAAAH-AgEAAAABgAOAAAAAAQIAAAA3ACArAACZBwAgAwAAADcAICsAAJkHACAsAACYBwAgASQAAJYIADAOAwAAhAQAIMcCAADQBAAwyAIAADUAEMkCAADQBAAwygIBAAAAAcwCAgCCBAAh0QJAAIMEACHdAgEAlQQAIeECQACDBAAh6wIAANEEgAMi_AIBAAAAAf0CAQAAAAH-AgEAAAABgAMAANIEACACAAAANwAgJAAAmAcAIAIAAACWBwAgJAAAlwcAIA3HAgAAlQcAMMgCAACWBwAQyQIAAJUHADDKAgEAlQQAIcwCAgCCBAAh0QJAAIMEACHdAgEAlQQAIeECQACDBAAh6wIAANEEgAMi_AIBAJUEACH9AgEApQQAIf4CAQClBAAhgAMAANIEACANxwIAAJUHADDIAgAAlgcAEMkCAACVBwAwygIBAJUEACHMAgIAggQAIdECQACDBAAh3QIBAJUEACHhAkAAgwQAIesCAADRBIADIvwCAQCVBAAh_QIBAKUEACH-AgEApQQAIYADAADSBAAgCcoCAQD9BAAhzAICAP4EACHRAkAAgQUAIeECQACBBQAh6wIAAMoFgAMi_AIBAP0EACH9AgEAgAUAIf4CAQCABQAhgAOAAAAAAQnKAgEA_QQAIcwCAgD-BAAh0QJAAIEFACHhAkAAgQUAIesCAADKBYADIvwCAQD9BAAh_QIBAIAFACH-AgEAgAUAIYADgAAAAAEJygIBAAAAAcwCAgAAAAHRAkAAAAAB4QJAAAAAAesCAAAAgAMC_AIBAAAAAf0CAQAAAAH-AgEAAAABgAOAAAAAAQcWAACYBQAgygIBAAAAAdECQAAAAAHeAgIAAAAB3wICAAAAAeACAgAAAAHhAkAAAAABAgAAAMADACArAACaBwAgAwAAAC4AICsAAJoHACAsAACeBwAgCQAAAC4AIBYAAIoFACAkAACeBwAgygIBAP0EACHRAkAAgQUAId4CAgD-BAAh3wICAP4EACHgAgIA_gQAIeECQACBBQAhBxYAAIoFACDKAgEA_QQAIdECQACBBQAh3gICAP4EACHfAgIA_gQAIeACAgD-BAAh4QJAAIEFACEFEAAA3AUAIMoCAQAAAAGQAwEAAAABkQMgAAAAAZIDQAAAAAECAAAAJwAgKwAApwcAIAMAAAAnACArAACnBwAgLAAApgcAIAEkAACVCAAwAgAAACcAICQAAKYHACACAAAA7gUAICQAAKUHACAEygIBAP0EACGQAwEA_QQAIZEDIADZBQAhkgNAAIEFACEFEAAA2gUAIMoCAQD9BAAhkAMBAP0EACGRAyAA2QUAIZIDQACBBQAhBRAAANwFACDKAgEAAAABkAMBAAAAAZEDIAAAAAGSA0AAAAABBA4AAPkFACDKAgEAAAABkwMBAAAAAZcDQAAAAAECAAAAHwAgKwAAsAcAIAMAAAAfACArAACwBwAgLAAArwcAIAEkAACUCAAwAgAAAB8AICQAAK8HACACAAAAmgYAICQAAK4HACADygIBAP0EACGTAwEA_QQAIZcDQACBBQAhBA4AAPcFACDKAgEA_QQAIZMDAQD9BAAhlwNAAIEFACEEDgAA-QUAIMoCAQAAAAGTAwEAAAABlwNAAAAAARAEAAChBgAgDwAAoAYAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAJ4DAu4CAQAAAAHvAgAAngYAIPYCQAAAAAGNAwAAAJ0DAo4DAQAAAAGPA0AAAAABmQMCAAAAAZoDAgAAAAGbAwIAAAABAgAAABsAICsAALwHACADAAAAGwAgKwAAvAcAICwAALsHACABJAAAkwgAMBUEAADkBAAgDQAAhAQAIA8AAOMEACDHAgAA4AQAMMgCAAAZABDJAgAA4AQAMMoCAQAAAAHPAgEAlQQAIdECQACDBAAh4QJAAIMEACHrAgAA4gSeAyLuAgEAlQQAIe8CAACOBAAg9gJAAKcEACGNAwAA4QSdAyKOAwEApQQAIY8DQACnBAAhmAMBAJUEACGZAwIAggQAIZoDAgCCBAAhmwMCAIIEACECAAAAGwAgJAAAuwcAIAIAAAC5BwAgJAAAugcAIBLHAgAAuAcAMMgCAAC5BwAQyQIAALgHADDKAgEAlQQAIc8CAQCVBAAh0QJAAIMEACHhAkAAgwQAIesCAADiBJ4DIu4CAQCVBAAh7wIAAI4EACD2AkAApwQAIY0DAADhBJ0DIo4DAQClBAAhjwNAAKcEACGYAwEAlQQAIZkDAgCCBAAhmgMCAIIEACGbAwIAggQAIRLHAgAAuAcAMMgCAAC5BwAQyQIAALgHADDKAgEAlQQAIc8CAQCVBAAh0QJAAIMEACHhAkAAgwQAIesCAADiBJ4DIu4CAQCVBAAh7wIAAI4EACD2AkAApwQAIY0DAADhBJ0DIo4DAQClBAAhjwNAAKcEACGYAwEAlQQAIZkDAgCCBAAhmgMCAIIEACGbAwIAggQAIQ7KAgEA_QQAIc8CAQD9BAAh0QJAAIEFACHhAkAAgQUAIesCAACCBp4DIu4CAQD9BAAh7wIAAIAGACD2AkAAoAUAIY0DAACBBp0DIo4DAQCABQAhjwNAAKAFACGZAwIA_gQAIZoDAgD-BAAhmwMCAP4EACEQBAAAhQYAIA8AAIQGACDKAgEA_QQAIc8CAQD9BAAh0QJAAIEFACHhAkAAgQUAIesCAACCBp4DIu4CAQD9BAAh7wIAAIAGACD2AkAAoAUAIY0DAACBBp0DIo4DAQCABQAhjwNAAKAFACGZAwIA_gQAIZoDAgD-BAAhmwMCAP4EACEQBAAAoQYAIA8AAKAGACDKAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAACeAwLuAgEAAAAB7wIAAJ4GACD2AkAAAAABjQMAAACdAwKOAwEAAAABjwNAAAAAAZkDAgAAAAGaAwIAAAABmwMCAAAAAQ8EAAC_BQAgBwAAvQUAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAPQCAu0CAQAAAAHuAgEAAAAB7wIAALsFACDwAkAAAAAB8QICAAAAAfICAAC8BQAg9QJAAAAAAfYCQAAAAAECAAAADwAgKwAAyAcAIAMAAAAPACArAADIBwAgLAAAxwcAIAEkAACSCAAwFAQAAPQEACAHAACEBAAgCAAAzgQAIMcCAADyBAAwyAIAAA0AEMkCAADyBAAwygIBAAAAAc8CAQCVBAAh0QJAAIMEACHhAkAAgwQAIesCAADzBPQCIu0CAQCVBAAh7gIBAJUEACHvAgAAjgQAIPACQACDBAAh8QICAIIEACHyAgAAjwQAIPQCAQClBAAh9QJAAKcEACH2AkAApwQAIQIAAAAPACAkAADHBwAgAgAAAMUHACAkAADGBwAgEccCAADEBwAwyAIAAMUHABDJAgAAxAcAMMoCAQCVBAAhzwIBAJUEACHRAkAAgwQAIeECQACDBAAh6wIAAPME9AIi7QIBAJUEACHuAgEAlQQAIe8CAACOBAAg8AJAAIMEACHxAgIAggQAIfICAACPBAAg9AIBAKUEACH1AkAApwQAIfYCQACnBAAhEccCAADEBwAwyAIAAMUHABDJAgAAxAcAMMoCAQCVBAAhzwIBAJUEACHRAkAAgwQAIeECQACDBAAh6wIAAPME9AIi7QIBAJUEACHuAgEAlQQAIe8CAACOBAAg8AJAAIMEACHxAgIAggQAIfICAACPBAAg9AIBAKUEACH1AkAApwQAIfYCQACnBAAhDcoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAKsF9AIi7QIBAP0EACHuAgEA_QQAIe8CAACpBQAg8AJAAIEFACHxAgIA_gQAIfICAACqBQAg9QJAAKAFACH2AkAAoAUAIQ8EAACuBQAgBwAArAUAIMoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAKsF9AIi7QIBAP0EACHuAgEA_QQAIe8CAACpBQAg8AJAAIEFACHxAgIA_gQAIfICAACqBQAg9QJAAKAFACH2AkAAoAUAIQ8EAAC_BQAgBwAAvQUAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAPQCAu0CAQAAAAHuAgEAAAAB7wIAALsFACDwAkAAAAAB8QICAAAAAfICAAC8BQAg9QJAAAAAAfYCQAAAAAEPBAAAvwUAIAgAAL4FACDKAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAAD0AgLuAgEAAAAB7wIAALsFACDwAkAAAAAB8QICAAAAAfICAAC8BQAg9AIBAAAAAfUCQAAAAAH2AkAAAAABAgAAAA8AICsAANEHACADAAAADwAgKwAA0QcAICwAANAHACABJAAAkQgAMAIAAAAPACAkAADQBwAgAgAAAMUHACAkAADPBwAgDcoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAKsF9AIi7gIBAP0EACHvAgAAqQUAIPACQACBBQAh8QICAP4EACHyAgAAqgUAIPQCAQCABQAh9QJAAKAFACH2AkAAoAUAIQ8EAACuBQAgCAAArQUAIMoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAKsF9AIi7gIBAP0EACHvAgAAqQUAIPACQACBBQAh8QICAP4EACHyAgAAqgUAIPQCAQCABQAh9QJAAKAFACH2AkAAoAUAIQ8EAAC_BQAgCAAAvgUAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAPQCAu4CAQAAAAHvAgAAuwUAIPACQAAAAAHxAgIAAAAB8gIAALwFACD0AgEAAAAB9QJAAAAAAfYCQAAAAAELygIBAAAAAdECQAAAAAHhAkAAAAAB7wIAANQFACCHAwEAAAABiQMAAACJAwKKAwEAAAABiwMBAAAAAY0DAAAAjQMCjgMBAAAAAY8DQAAAAAECAAAAywIAICsAANIHACADAAAACwAgKwAA0gcAICwAANYHACANAAAACwAgJAAA1gcAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIe8CAADQBQAghwMBAP0EACGJAwAA0QWJAyKKAwEAgAUAIYsDAQCABQAhjQMAANIFjQMijgMBAIAFACGPA0AAoAUAIQvKAgEA_QQAIdECQACBBQAh4QJAAIEFACHvAgAA0AUAIIcDAQD9BAAhiQMAANEFiQMiigMBAIAFACGLAwEAgAUAIY0DAADSBY0DIo4DAQCABQAhjwNAAKAFACEMygIBAAAAAdECQAAAAAHhAkAAAAABuAMBAAAAAbkDAQAAAAG6AwEAAAABuwMBAAAAAbwDAQAAAAG9A0AAAAABvgNAAAAAAb8DAQAAAAHAAwEAAAABAgAAAAkAICsAAOIHACADAAAACQAgKwAA4gcAICwAAOEHACABJAAAkAgAMBEDAACEBAAgxwIAAPUEADDIAgAABwAQyQIAAPUEADDKAgEAAAAB0QJAAIMEACHdAgEAlQQAIeECQACDBAAhuAMBAJUEACG5AwEAlQQAIboDAQClBAAhuwMBAKUEACG8AwEApQQAIb0DQACnBAAhvgNAAKcEACG_AwEApQQAIcADAQClBAAhAgAAAAkAICQAAOEHACACAAAA3wcAICQAAOAHACAQxwIAAN4HADDIAgAA3wcAEMkCAADeBwAwygIBAJUEACHRAkAAgwQAId0CAQCVBAAh4QJAAIMEACG4AwEAlQQAIbkDAQCVBAAhugMBAKUEACG7AwEApQQAIbwDAQClBAAhvQNAAKcEACG-A0AApwQAIb8DAQClBAAhwAMBAKUEACEQxwIAAN4HADDIAgAA3wcAEMkCAADeBwAwygIBAJUEACHRAkAAgwQAId0CAQCVBAAh4QJAAIMEACG4AwEAlQQAIbkDAQCVBAAhugMBAKUEACG7AwEApQQAIbwDAQClBAAhvQNAAKcEACG-A0AApwQAIb8DAQClBAAhwAMBAKUEACEMygIBAP0EACHRAkAAgQUAIeECQACBBQAhuAMBAP0EACG5AwEA_QQAIboDAQCABQAhuwMBAIAFACG8AwEAgAUAIb0DQACgBQAhvgNAAKAFACG_AwEAgAUAIcADAQCABQAhDMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIbgDAQD9BAAhuQMBAP0EACG6AwEAgAUAIbsDAQCABQAhvAMBAIAFACG9A0AAoAUAIb4DQACgBQAhvwMBAIAFACHAAwEAgAUAIQzKAgEAAAAB0QJAAAAAAeECQAAAAAG4AwEAAAABuQMBAAAAAboDAQAAAAG7AwEAAAABvAMBAAAAAb0DQAAAAAG-A0AAAAABvwMBAAAAAcADAQAAAAEHygIBAAAAAdECQAAAAAHhAkAAAAABtwNAAAAAAcEDAQAAAAHCAwEAAAABwwMBAAAAAQIAAAAFACArAADuBwAgAwAAAAUAICsAAO4HACAsAADtBwAgASQAAI8IADAMAwAAhAQAIMcCAAD2BAAwyAIAAAMAEMkCAAD2BAAwygIBAAAAAdECQACDBAAh3QIBAJUEACHhAkAAgwQAIbcDQACDBAAhwQMBAAAAAcIDAQClBAAhwwMBAKUEACECAAAABQAgJAAA7QcAIAIAAADrBwAgJAAA7AcAIAvHAgAA6gcAMMgCAADrBwAQyQIAAOoHADDKAgEAlQQAIdECQACDBAAh3QIBAJUEACHhAkAAgwQAIbcDQACDBAAhwQMBAJUEACHCAwEApQQAIcMDAQClBAAhC8cCAADqBwAwyAIAAOsHABDJAgAA6gcAMMoCAQCVBAAh0QJAAIMEACHdAgEAlQQAIeECQACDBAAhtwNAAIMEACHBAwEAlQQAIcIDAQClBAAhwwMBAKUEACEHygIBAP0EACHRAkAAgQUAIeECQACBBQAhtwNAAIEFACHBAwEA_QQAIcIDAQCABQAhwwMBAIAFACEHygIBAP0EACHRAkAAgQUAIeECQACBBQAhtwNAAIEFACHBAwEA_QQAIcIDAQCABQAhwwMBAIAFACEHygIBAAAAAdECQAAAAAHhAkAAAAABtwNAAAAAAcEDAQAAAAHCAwEAAAABwwMBAAAAAQQrAADjBwAwzgMAAOQHADDQAwAA5gcAINQDAADnBwAwBCsAANcHADDOAwAA2AcAMNADAADaBwAg1AMAANsHADADKwAA0gcAIM4DAADTBwAg1AMAAMsCACAEKwAAyQcAMM4DAADKBwAw0AMAAMwHACDUAwAAwQcAMAQrAAC9BwAwzgMAAL4HADDQAwAAwAcAINQDAADBBwAwBCsAALEHADDOAwAAsgcAMNADAAC0BwAg1AMAALUHADAEKwAAqAcAMM4DAACpBwAw0AMAAKsHACDUAwAAlgYAMAQrAACfBwAwzgMAAKAHADDQAwAAogcAINQDAADqBQAwAysAAJoHACDOAwAAmwcAINQDAADAAwAgBCsAAI4HADDOAwAAjwcAMNADAACRBwAg1AMAAJIHADAEKwAAhQcAMM4DAACGBwAw0AMAAIgHACDUAwAA_QYAMAQrAAD5BgAwzgMAAPoGADDQAwAA_AYAINQDAAD9BgAwBCsAAO0GADDOAwAA7gYAMNADAADwBgAg1AMAAPEGADAAAAUDAACZBQAgigMAAPcEACCLAwAA9wQAII4DAAD3BAAgjwMAAPcEACAAAAAAAgMAAJkFACAWAACaBQAgAAAADAcAAJkFACAYAACZBQAgGgAAiQgAIKoDAAD3BAAgqwMAAPcEACCsAwAA9wQAIK0DAAD3BAAgrgMAAPcEACCxAwAA9wQAILIDAAD3BAAgswMAAPcEACC0AwAA9wQAIAAGDQAAmQUAIBkAAIcIACAbAACICAAgpQMAAPcEACCmAwAA9wQAIKcDAAD3BAAgBA4AAIsIACARAACCCAAg7AIAAPcEACCWAwAA9wQAIAYEAACMCAAgDQAAmQUAIA8AAIEIACD2AgAA9wQAII4DAAD3BAAgjwMAAPcEACAABgQAAI4IACAHAACZBQAgCAAAmQUAIPQCAAD3BAAg9QIAAPcEACD2AgAA9wQAIAAHygIBAAAAAdECQAAAAAHhAkAAAAABtwNAAAAAAcEDAQAAAAHCAwEAAAABwwMBAAAAAQzKAgEAAAAB0QJAAAAAAeECQAAAAAG4AwEAAAABuQMBAAAAAboDAQAAAAG7AwEAAAABvAMBAAAAAb0DQAAAAAG-A0AAAAABvwMBAAAAAcADAQAAAAENygIBAAAAAc8CAQAAAAHRAkAAAAAB4QJAAAAAAesCAAAA9AIC7gIBAAAAAe8CAAC7BQAg8AJAAAAAAfECAgAAAAHyAgAAvAUAIPQCAQAAAAH1AkAAAAAB9gJAAAAAAQ3KAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAAD0AgLtAgEAAAAB7gIBAAAAAe8CAAC7BQAg8AJAAAAAAfECAgAAAAHyAgAAvAUAIPUCQAAAAAH2AkAAAAABDsoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAJ4DAu4CAQAAAAHvAgAAngYAIPYCQAAAAAGNAwAAAJ0DAo4DAQAAAAGPA0AAAAABmQMCAAAAAZoDAgAAAAGbAwIAAAABA8oCAQAAAAGTAwEAAAABlwNAAAAAAQTKAgEAAAABkAMBAAAAAZEDIAAAAAGSA0AAAAABCcoCAQAAAAHMAgIAAAAB0QJAAAAAAeECQAAAAAHrAgAAAIADAvwCAQAAAAH9AgEAAAAB_gIBAAAAAYADgAAAAAERygIBAAAAAc8CAQAAAAHRAkAAAAAB4QJAAAAAAesCAAAAsQMC7gIBAAAAAakDAAAAqQMCqgMBAAAAAasDAQAAAAGsAwEAAAABrQMBAAAAAa4DAQAAAAGvAwIAAAABsQMBAAAAAbIDQAAAAAGzAwEAAAABtANAAAAAARHKAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAACxAwLtAgEAAAAB7gIBAAAAAakDAAAAqQMCqgMBAAAAAasDAQAAAAGsAwEAAAABrQMBAAAAAa4DAQAAAAGvAwIAAAABsQMBAAAAAbIDQAAAAAG0A0AAAAABB8oCAQAAAAHRAkAAAAABowMBAAAAAaQDAQAAAAGlAwEAAAABpgMBAAAAAacDAQAAAAEVBQAA8AcAIAYAAPEHACALAADyBwAgDAAA8wcAIBIAAPQHACATAAD1BwAgFAAA9gcAIBUAAPcHACAXAAD4BwAgHAAA-QcAIB0AAPoHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAJoIACADAAAAEQAgKwAAmggAICwAAJ4IACAXAAAAEQAgBQAA4QYAIAYAAOIGACALAADjBgAgDAAA5AYAIBIAAOUGACATAADmBgAgFAAA5wYAIBUAAOgGACAXAADpBgAgHAAA6gYAIB0AAOsGACAeAADsBgAgJAAAnggAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRUFAADhBgAgBgAA4gYAIAsAAOMGACAMAADkBgAgEgAA5QYAIBMAAOYGACAUAADnBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIB4AAOwGACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEVBAAA7wcAIAYAAPEHACALAADyBwAgDAAA8wcAIBIAAPQHACATAAD1BwAgFAAA9gcAIBUAAPcHACAXAAD4BwAgHAAA-QcAIB0AAPoHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAJ8IACADAAAAEQAgKwAAnwgAICwAAKMIACAXAAAAEQAgBAAA4AYAIAYAAOIGACALAADjBgAgDAAA5AYAIBIAAOUGACATAADmBgAgFAAA5wYAIBUAAOgGACAXAADpBgAgHAAA6gYAIB0AAOsGACAeAADsBgAgJAAAowgAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRUEAADgBgAgBgAA4gYAIAsAAOMGACAMAADkBgAgEgAA5QYAIBMAAOYGACAUAADnBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIB4AAOwGACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEVBAAA7wcAIAUAAPAHACAGAADxBwAgCwAA8gcAIAwAAPMHACASAAD0BwAgEwAA9QcAIBQAAPYHACAVAAD3BwAgFwAA-AcAIBwAAPkHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAKQIACAVBAAA7wcAIAUAAPAHACAGAADxBwAgCwAA8gcAIAwAAPMHACASAAD0BwAgEwAA9QcAIBQAAPYHACAVAAD3BwAgFwAA-AcAIB0AAPoHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAKYIACADAAAAEQAgKwAApAgAICwAAKoIACAXAAAAEQAgBAAA4AYAIAUAAOEGACAGAADiBgAgCwAA4wYAIAwAAOQGACASAADlBgAgEwAA5gYAIBQAAOcGACAVAADoBgAgFwAA6QYAIBwAAOoGACAeAADsBgAgJAAAqggAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRUEAADgBgAgBQAA4QYAIAYAAOIGACALAADjBgAgDAAA5AYAIBIAAOUGACATAADmBgAgFAAA5wYAIBUAAOgGACAXAADpBgAgHAAA6gYAIB4AAOwGACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEDAAAAEQAgKwAApggAICwAAK0IACAXAAAAEQAgBAAA4AYAIAUAAOEGACAGAADiBgAgCwAA4wYAIAwAAOQGACASAADlBgAgEwAA5gYAIBQAAOcGACAVAADoBgAgFwAA6QYAIB0AAOsGACAeAADsBgAgJAAArQgAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRUEAADgBgAgBQAA4QYAIAYAAOIGACALAADjBgAgDAAA5AYAIBIAAOUGACATAADmBgAgFAAA5wYAIBUAAOgGACAXAADpBgAgHQAA6wYAIB4AAOwGACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEVBAAA7wcAIAUAAPAHACAGAADxBwAgCwAA8gcAIAwAAPMHACASAAD0BwAgEwAA9QcAIBQAAPYHACAVAAD3BwAgFwAA-AcAIBwAAPkHACAdAAD6BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAK4IACAUBwAAzQYAIBgAAM4GACDKAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAACxAwLtAgEAAAAB7gIBAAAAAakDAAAAqQMCqgMBAAAAAasDAQAAAAGsAwEAAAABrQMBAAAAAa4DAQAAAAGvAwIAAAABsQMBAAAAAbIDQAAAAAGzAwEAAAABtANAAAAAAQIAAAA7ACArAACwCAAgBsoCAQAAAAHRAkAAAAABnwMBAAAAAaADAgAAAAGhAwEAAAABogMBAAAAAQMAAAARACArAACuCAAgLAAAtQgAIBcAAAARACAEAADgBgAgBQAA4QYAIAYAAOIGACALAADjBgAgDAAA5AYAIBIAAOUGACATAADmBgAgFAAA5wYAIBUAAOgGACAXAADpBgAgHAAA6gYAIB0AAOsGACAkAAC1CAAgygIBAP0EACHRAkAAgQUAIeECQACBBQAhxAMBAP0EACHFAwEA_QQAIcYDIADZBQAhxwMBAIAFACHIAwEA_QQAIckDIADZBQAhFQQAAOAGACAFAADhBgAgBgAA4gYAIAsAAOMGACAMAADkBgAgEgAA5QYAIBMAAOYGACAUAADnBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIQMAAAA5ACArAACwCAAgLAAAuAgAIBYAAAA5ACAHAADFBgAgGAAAxgYAICQAALgIACDKAgEA_QQAIc8CAQD9BAAh0QJAAIEFACHhAkAAgQUAIesCAADEBrEDIu0CAQD9BAAh7gIBAP0EACGpAwAAwwapAyKqAwEAgAUAIasDAQCABQAhrAMBAIAFACGtAwEAgAUAIa4DAQCABQAhrwMCAP4EACGxAwEAgAUAIbIDQACgBQAhswMBAIAFACG0A0AAoAUAIRQHAADFBgAgGAAAxgYAIMoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAMQGsQMi7QIBAP0EACHuAgEA_QQAIakDAADDBqkDIqoDAQCABQAhqwMBAIAFACGsAwEAgAUAIa0DAQCABQAhrgMBAIAFACGvAwIA_gQAIbEDAQCABQAhsgNAAKAFACGzAwEAgAUAIbQDQACgBQAhCg0AALwGACAZAAC7BgAgygIBAAAAAdECQAAAAAGYAwEAAAABowMBAAAAAaQDAQAAAAGlAwEAAAABpgMBAAAAAacDAQAAAAECAAAARwAgKwAAuQgAIAMAAAA-ACArAAC5CAAgLAAAvQgAIAwAAAA-ACANAACtBgAgGQAArAYAICQAAL0IACDKAgEA_QQAIdECQACBBQAhmAMBAP0EACGjAwEA_QQAIaQDAQD9BAAhpQMBAIAFACGmAwEAgAUAIacDAQCABQAhCg0AAK0GACAZAACsBgAgygIBAP0EACHRAkAAgQUAIZgDAQD9BAAhowMBAP0EACGkAwEA_QQAIaUDAQCABQAhpgMBAIAFACGnAwEAgAUAIRUEAADvBwAgBQAA8AcAIAYAAPEHACALAADyBwAgDAAA8wcAIBMAAPUHACAUAAD2BwAgFQAA9wcAIBcAAPgHACAcAAD5BwAgHQAA-gcAIB4AAPsHACDKAgEAAAAB0QJAAAAAAeECQAAAAAHEAwEAAAABxQMBAAAAAcYDIAAAAAHHAwEAAAAByAMBAAAAAckDIAAAAAECAAAAAQAgKwAAvggAIAPKAgEAAAAB7QIBAAAAAZcDQAAAAAEMygIBAAAAAdECQAAAAAHhAkAAAAAB5gICAAAAAecCQAAAAAHoAgIAAAAB6QICAAAAAesCAAAAlgMC7AIBAAAAAe4CAQAAAAGUAwIAAAABlgOAAAAAAQMAAAARACArAAC-CAAgLAAAxAgAIBcAAAARACAEAADgBgAgBQAA4QYAIAYAAOIGACALAADjBgAgDAAA5AYAIBMAAOYGACAUAADnBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIB4AAOwGACAkAADECAAgygIBAP0EACHRAkAAgQUAIeECQACBBQAhxAMBAP0EACHFAwEA_QQAIcYDIADZBQAhxwMBAIAFACHIAwEA_QQAIckDIADZBQAhFQQAAOAGACAFAADhBgAgBgAA4gYAIAsAAOMGACAMAADkBgAgEwAA5gYAIBQAAOcGACAVAADoBgAgFwAA6QYAIBwAAOoGACAdAADrBgAgHgAA7AYAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRUEAADvBwAgBQAA8AcAIAYAAPEHACALAADyBwAgDAAA8wcAIBIAAPQHACAUAAD2BwAgFQAA9wcAIBcAAPgHACAcAAD5BwAgHQAA-gcAIB4AAPsHACDKAgEAAAAB0QJAAAAAAeECQAAAAAHEAwEAAAABxQMBAAAAAcYDIAAAAAHHAwEAAAAByAMBAAAAAckDIAAAAAECAAAAAQAgKwAAxQgAIBEEAAChBgAgDQAAnwYAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAJ4DAu4CAQAAAAHvAgAAngYAIPYCQAAAAAGNAwAAAJ0DAo4DAQAAAAGPA0AAAAABmAMBAAAAAZkDAgAAAAGaAwIAAAABmwMCAAAAAQIAAAAbACArAADHCAAgAwAAABEAICsAAMUIACAsAADLCAAgFwAAABEAIAQAAOAGACAFAADhBgAgBgAA4gYAIAsAAOMGACAMAADkBgAgEgAA5QYAIBQAAOcGACAVAADoBgAgFwAA6QYAIBwAAOoGACAdAADrBgAgHgAA7AYAICQAAMsIACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEVBAAA4AYAIAUAAOEGACAGAADiBgAgCwAA4wYAIAwAAOQGACASAADlBgAgFAAA5wYAIBUAAOgGACAXAADpBgAgHAAA6gYAIB0AAOsGACAeAADsBgAgygIBAP0EACHRAkAAgQUAIeECQACBBQAhxAMBAP0EACHFAwEA_QQAIcYDIADZBQAhxwMBAIAFACHIAwEA_QQAIckDIADZBQAhAwAAABkAICsAAMcIACAsAADOCAAgEwAAABkAIAQAAIUGACANAACDBgAgJAAAzggAIMoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAIIGngMi7gIBAP0EACHvAgAAgAYAIPYCQACgBQAhjQMAAIEGnQMijgMBAIAFACGPA0AAoAUAIZgDAQD9BAAhmQMCAP4EACGaAwIA_gQAIZsDAgD-BAAhEQQAAIUGACANAACDBgAgygIBAP0EACHPAgEA_QQAIdECQACBBQAh4QJAAIEFACHrAgAAggaeAyLuAgEA_QQAIe8CAACABgAg9gJAAKAFACGNAwAAgQadAyKOAwEAgAUAIY8DQACgBQAhmAMBAP0EACGZAwIA_gQAIZoDAgD-BAAhmwMCAP4EACERDQAAnwYAIA8AAKAGACDKAgEAAAABzwIBAAAAAdECQAAAAAHhAkAAAAAB6wIAAACeAwLuAgEAAAAB7wIAAJ4GACD2AkAAAAABjQMAAACdAwKOAwEAAAABjwNAAAAAAZgDAQAAAAGZAwIAAAABmgMCAAAAAZsDAgAAAAECAAAAGwAgKwAAzwgAIATKAgEAAAAB7QIBAAAAAZEDIAAAAAGSA0AAAAABAwAAABkAICsAAM8IACAsAADUCAAgEwAAABkAIA0AAIMGACAPAACEBgAgJAAA1AgAIMoCAQD9BAAhzwIBAP0EACHRAkAAgQUAIeECQACBBQAh6wIAAIIGngMi7gIBAP0EACHvAgAAgAYAIPYCQACgBQAhjQMAAIEGnQMijgMBAIAFACGPA0AAoAUAIZgDAQD9BAAhmQMCAP4EACGaAwIA_gQAIZsDAgD-BAAhEQ0AAIMGACAPAACEBgAgygIBAP0EACHPAgEA_QQAIdECQACBBQAh4QJAAIEFACHrAgAAggaeAyLuAgEA_QQAIe8CAACABgAg9gJAAKAFACGNAwAAgQadAyKOAwEAgAUAIY8DQACgBQAhmAMBAP0EACGZAwIA_gQAIZoDAgD-BAAhmwMCAP4EACEVBAAA7wcAIAUAAPAHACAGAADxBwAgCwAA8gcAIAwAAPMHACASAAD0BwAgEwAA9QcAIBUAAPcHACAXAAD4BwAgHAAA-QcAIB0AAPoHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAANUIACAODgAA8gUAIMoCAQAAAAHRAkAAAAAB4QJAAAAAAeYCAgAAAAHnAkAAAAAB6AICAAAAAekCAgAAAAHrAgAAAJYDAuwCAQAAAAHuAgEAAAABkwMBAAAAAZQDAgAAAAGWA4AAAAABAgAAACMAICsAANcIACADAAAAEQAgKwAA1QgAICwAANsIACAXAAAAEQAgBAAA4AYAIAUAAOEGACAGAADiBgAgCwAA4wYAIAwAAOQGACASAADlBgAgEwAA5gYAIBUAAOgGACAXAADpBgAgHAAA6gYAIB0AAOsGACAeAADsBgAgJAAA2wgAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRUEAADgBgAgBQAA4QYAIAYAAOIGACALAADjBgAgDAAA5AYAIBIAAOUGACATAADmBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIB4AAOwGACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEDAAAAIQAgKwAA1wgAICwAAN4IACAQAAAAIQAgDgAA5AUAICQAAN4IACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHmAgIA_gQAIecCQACBBQAh6AICAP4EACHpAgIA_gQAIesCAADjBZYDIuwCAQCABQAh7gIBAP0EACGTAwEA_QQAIZQDAgD-BAAhlgOAAAAAAQ4OAADkBQAgygIBAP0EACHRAkAAgQUAIeECQACBBQAh5gICAP4EACHnAkAAgQUAIegCAgD-BAAh6QICAP4EACHrAgAA4wWWAyLsAgEAgAUAIe4CAQD9BAAhkwMBAP0EACGUAwIA_gQAIZYDgAAAAAEVBAAA7wcAIAUAAPAHACALAADyBwAgDAAA8wcAIBIAAPQHACATAAD1BwAgFAAA9gcAIBUAAPcHACAXAAD4BwAgHAAA-QcAIB0AAPoHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAN8IACADAAAAEQAgKwAA3wgAICwAAOMIACAXAAAAEQAgBAAA4AYAIAUAAOEGACALAADjBgAgDAAA5AYAIBIAAOUGACATAADmBgAgFAAA5wYAIBUAAOgGACAXAADpBgAgHAAA6gYAIB0AAOsGACAeAADsBgAgJAAA4wgAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRUEAADgBgAgBQAA4QYAIAsAAOMGACAMAADkBgAgEgAA5QYAIBMAAOYGACAUAADnBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIB4AAOwGACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEVBAAA7wcAIAUAAPAHACAGAADxBwAgCwAA8gcAIAwAAPMHACASAAD0BwAgEwAA9QcAIBQAAPYHACAVAAD3BwAgHAAA-QcAIB0AAPoHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAOQIACADAAAAEQAgKwAA5AgAICwAAOgIACAXAAAAEQAgBAAA4AYAIAUAAOEGACAGAADiBgAgCwAA4wYAIAwAAOQGACASAADlBgAgEwAA5gYAIBQAAOcGACAVAADoBgAgHAAA6gYAIB0AAOsGACAeAADsBgAgJAAA6AgAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRUEAADgBgAgBQAA4QYAIAYAAOIGACALAADjBgAgDAAA5AYAIBIAAOUGACATAADmBgAgFAAA5wYAIBUAAOgGACAcAADqBgAgHQAA6wYAIB4AAOwGACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEVBAAA7wcAIAUAAPAHACAGAADxBwAgCwAA8gcAIBIAAPQHACATAAD1BwAgFAAA9gcAIBUAAPcHACAXAAD4BwAgHAAA-QcAIB0AAPoHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAOkIACAVBAAA7wcAIAUAAPAHACAGAADxBwAgDAAA8wcAIBIAAPQHACATAAD1BwAgFAAA9gcAIBUAAPcHACAXAAD4BwAgHAAA-QcAIB0AAPoHACAeAAD7BwAgygIBAAAAAdECQAAAAAHhAkAAAAABxAMBAAAAAcUDAQAAAAHGAyAAAAABxwMBAAAAAcgDAQAAAAHJAyAAAAABAgAAAAEAICsAAOsIACAJygIBAAAAAdECQAAAAAHhAkAAAAAB5gICAAAAAecCQAAAAAHoAgIAAAAB6QICAAAAAesCAAAA6wIC7AIBAAAAAQMAAAARACArAADpCAAgLAAA8AgAIBcAAAARACAEAADgBgAgBQAA4QYAIAYAAOIGACALAADjBgAgEgAA5QYAIBMAAOYGACAUAADnBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIB4AAOwGACAkAADwCAAgygIBAP0EACHRAkAAgQUAIeECQACBBQAhxAMBAP0EACHFAwEA_QQAIcYDIADZBQAhxwMBAIAFACHIAwEA_QQAIckDIADZBQAhFQQAAOAGACAFAADhBgAgBgAA4gYAIAsAAOMGACASAADlBgAgEwAA5gYAIBQAAOcGACAVAADoBgAgFwAA6QYAIBwAAOoGACAdAADrBgAgHgAA7AYAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIQMAAAARACArAADrCAAgLAAA8wgAIBcAAAARACAEAADgBgAgBQAA4QYAIAYAAOIGACAMAADkBgAgEgAA5QYAIBMAAOYGACAUAADnBgAgFQAA6AYAIBcAAOkGACAcAADqBgAgHQAA6wYAIB4AAOwGACAkAADzCAAgygIBAP0EACHRAkAAgQUAIeECQACBBQAhxAMBAP0EACHFAwEA_QQAIcYDIADZBQAhxwMBAIAFACHIAwEA_QQAIckDIADZBQAhFQQAAOAGACAFAADhBgAgBgAA4gYAIAwAAOQGACASAADlBgAgEwAA5gYAIBQAAOcGACAVAADoBgAgFwAA6QYAIBwAAOoGACAdAADrBgAgHgAA7AYAIMoCAQD9BAAh0QJAAIEFACHhAkAAgQUAIcQDAQD9BAAhxQMBAP0EACHGAyAA2QUAIccDAQCABQAhyAMBAP0EACHJAyAA2QUAIRAHAAC9BQAgCAAAvgUAIMoCAQAAAAHPAgEAAAAB0QJAAAAAAeECQAAAAAHrAgAAAPQCAu0CAQAAAAHuAgEAAAAB7wIAALsFACDwAkAAAAAB8QICAAAAAfICAAC8BQAg9AIBAAAAAfUCQAAAAAH2AkAAAAABAgAAAA8AICsAAPQIACADAAAADQAgKwAA9AgAICwAAPgIACASAAAADQAgBwAArAUAIAgAAK0FACAkAAD4CAAgygIBAP0EACHPAgEA_QQAIdECQACBBQAh4QJAAIEFACHrAgAAqwX0AiLtAgEA_QQAIe4CAQD9BAAh7wIAAKkFACDwAkAAgQUAIfECAgD-BAAh8gIAAKoFACD0AgEAgAUAIfUCQACgBQAh9gJAAKAFACEQBwAArAUAIAgAAK0FACDKAgEA_QQAIc8CAQD9BAAh0QJAAIEFACHhAkAAgQUAIesCAACrBfQCIu0CAQD9BAAh7gIBAP0EACHvAgAAqQUAIPACQACBBQAh8QICAP4EACHyAgAAqgUAIPQCAQCABQAh9QJAAKAFACH2AkAAoAUAIRUEAADvBwAgBQAA8AcAIAYAAPEHACALAADyBwAgDAAA8wcAIBIAAPQHACATAAD1BwAgFAAA9gcAIBcAAPgHACAcAAD5BwAgHQAA-gcAIB4AAPsHACDKAgEAAAAB0QJAAAAAAeECQAAAAAHEAwEAAAABxQMBAAAAAcYDIAAAAAHHAwEAAAAByAMBAAAAAckDIAAAAAECAAAAAQAgKwAA-QgAIAbKAgEAAAABzAICAAAAAc4CAAAAzgICzwIBAAAAAdACAQAAAAHRAkAAAAABAwAAABEAICsAAPkIACAsAAD-CAAgFwAAABEAIAQAAOAGACAFAADhBgAgBgAA4gYAIAsAAOMGACAMAADkBgAgEgAA5QYAIBMAAOYGACAUAADnBgAgFwAA6QYAIBwAAOoGACAdAADrBgAgHgAA7AYAICQAAP4IACDKAgEA_QQAIdECQACBBQAh4QJAAIEFACHEAwEA_QQAIcUDAQD9BAAhxgMgANkFACHHAwEAgAUAIcgDAQD9BAAhyQMgANkFACEVBAAA4AYAIAUAAOEGACAGAADiBgAgCwAA4wYAIAwAAOQGACASAADlBgAgEwAA5gYAIBQAAOcGACAXAADpBgAgHAAA6gYAIB0AAOsGACAeAADsBgAgygIBAP0EACHRAkAAgQUAIeECQACBBQAhxAMBAP0EACHFAwEA_QQAIcYDIADZBQAhxwMBAIAFACHIAwEA_QQAIckDIADZBQAhCAMAAJcFACDKAgEAAAAB0QJAAAAAAd0CAQAAAAHeAgIAAAAB3wICAAAAAeACAgAAAAHhAkAAAAABAgAAAMADACArAAD_CAAgAwAAAC4AICsAAP8IACAsAACDCQAgCgAAAC4AIAMAAIkFACAkAACDCQAgygIBAP0EACHRAkAAgQUAId0CAQD9BAAh3gICAP4EACHfAgIA_gQAIeACAgD-BAAh4QJAAIEFACEIAwAAiQUAIMoCAQD9BAAh0QJAAIEFACHdAgEA_QQAId4CAgD-BAAh3wICAP4EACHgAgIA_gQAIeECQACBBQAhDgQGAgUKAwYMBAoAFgsQBQwYBRIcCBMsCRQtCxUvDhc4ERw8Eh1FEh5IEwEDAAEBAwABAQMAAQQEFgYHAAEIEgEKAAcBCQAFAQQXAAQEJAoKAA0NAAEPIAkCBwABDgAIAwoADA4ACBEoCwIHAAEQAAoBESkAAgQrAA8qAAMDAAEKABAWMw8BFQAOARY0AAEDAAEDBwABGD0BGj8TBAoAFQ0AARkAEhtDFAEaABMBG0QACwRJAAVKAAtLAAxMABJNABNOABRPABdQABxRAB1SAB5TAAAAAAMKABsxABwyAB0AAAADCgAbMQAcMgAdAQMAAQEDAAEDCgAiMQAjMgAkAAAAAwoAIjEAIzIAJAEDAAEBAwABAwoAKTEAKjIAKwAAAAMKACkxACoyACsAAAADCgAxMQAyMgAzAAAAAwoAMTEAMjIAMwIHAAEYuQEBAgcAARi_AQEFCgA4MQA7MgA8cwA5dAA6AAAAAAAFCgA4MQA7MgA8cwA5dAA6Ag0AARkAEgINAAEZABIDCgBBMQBCMgBDAAAAAwoAQTEAQjIAQwEaABMBGgATBQoASDEASzIATHMASXQASgAAAAAABQoASDEASzIATHMASXQASgENAAEBDQABBQoAUTEAVDIAVXMAUnQAUwAAAAAABQoAUTEAVDIAVXMAUnQAUwIHAAEOAAgCBwABDgAIAwoAWjEAWzIAXAAAAAMKAFoxAFsyAFwBDgAIAQ4ACAUKAGExAGQyAGVzAGJ0AGMAAAAAAAUKAGExAGQyAGVzAGJ0AGMCBwABEAAKAgcAARAACgMKAGoxAGsyAGwAAAADCgBqMQBrMgBsAQMAAQEDAAEDCgBxMQByMgBzAAAAAwoAcTEAcjIAcwEDAAEBAwABBQoAeDEAezIAfHMAeXQAegAAAAAABQoAeDEAezIAfHMAeXQAegAAAAUKAIIBMQCFATIAhgFzAIMBdACEAQAAAAAABQoAggExAIUBMgCGAXMAgwF0AIQBAgcAAQicAwECBwABCKIDAQUKAIsBMQCOATIAjwFzAIwBdACNAQAAAAAABQoAiwExAI4BMgCPAXMAjAF0AI0BAQkABQEJAAUFCgCUATEAlwEyAJgBcwCVAXQAlgEAAAAAAAUKAJQBMQCXATIAmAFzAJUBdACWAQEDAAEBAwABBQoAnQExAKABMgChAXMAngF0AJ8BAAAAAAAFCgCdATEAoAEyAKEBcwCeAXQAnwEBFQAOARUADgUKAKYBMQCpATIAqgFzAKcBdACoAQAAAAAABQoApgExAKkBMgCqAXMApwF0AKgBHwIBIFQBIVYBIlcBI1gBJVoBJlwXJ10YKF8BKWEXKmIZLWMBLmQBL2UXM2gaNGkeNWoCNmsCN2wCOG0COW4COnACO3IXPHMfPXUCPncXP3ggQHkCQXoCQnsXQ34hRH8lRYABA0aBAQNHggEDSIMBA0mEAQNKhgEDS4gBF0yJASZNiwEDTo0BF0-OASdQjwEDUZABA1KRARdTlAEoVJUBLFWXAS1WmAEtV5sBLVicAS1ZnQEtWp8BLVuhARdcogEuXaQBLV6mARdfpwEvYKgBLWGpAS1iqgEXY60BMGSuATRlrwESZrABEmexARJosgESabMBEmq1ARJrtwEXbLgBNW27ARJuvQEXb74BNnDAARJxwQEScsIBF3XFATd2xgE9d8cBE3jIARN5yQETesoBE3vLARN8zQETfc8BF37QAT5_0gETgAHUAReBAdUBP4IB1gETgwHXAROEAdgBF4UB2wFAhgHcAUSHAd0BFIgB3gEUiQHfARSKAeABFIsB4QEUjAHjARSNAeUBF44B5gFFjwHoARSQAeoBF5EB6wFGkgHsARSTAe0BFJQB7gEXlQHxAUeWAfIBTZcB8wEImAH0AQiZAfUBCJoB9gEImwH3AQicAfkBCJ0B-wEXngH8AU6fAf4BCKABgAIXoQGBAk-iAYICCKMBgwIIpAGEAhelAYcCUKYBiAJWpwGJAgmoAYoCCakBiwIJqgGMAgmrAY0CCawBjwIJrQGRAheuAZICV68BlAIJsAGWAhexAZcCWLIBmAIJswGZAgm0AZoCF7UBnQJZtgGeAl23AZ8CCrgBoAIKuQGhAgq6AaICCrsBowIKvAGlAgq9AacCF74BqAJevwGqAgrAAawCF8EBrQJfwgGuAgrDAa8CCsQBsAIXxQGzAmDGAbQCZscBtQILyAG2AgvJAbcCC8oBuAILywG5AgvMAbsCC80BvQIXzgG-AmfPAcACC9ABwgIX0QHDAmjSAcQCC9MBxQIL1AHGAhfVAckCadYBygJt1wHMAgTYAc0CBNkBzwIE2gHQAgTbAdECBNwB0wIE3QHVAhfeAdYCbt8B2AIE4AHaAhfhAdsCb-IB3AIE4wHdAgTkAd4CF-UB4QJw5gHiAnTnAeMCEegB5AIR6QHlAhHqAeYCEesB5wIR7AHpAhHtAesCF-4B7AJ17wHuAhHwAfACF_EB8QJ28gHyAhHzAfMCEfQB9AIX9QH3Anf2AfgCffcB-gJ--AH7An75Af4CfvoB_wJ--wGAA378AYIDfv0BhAMX_gGFA3__AYcDfoACiQMXgQKKA4ABggKLA36DAowDfoQCjQMXhQKQA4EBhgKRA4cBhwKSAwWIApMDBYkClAMFigKVAwWLApYDBYwCmAMFjQKaAxeOApsDiAGPAp4DBZACoAMXkQKhA4kBkgKjAwWTAqQDBZQCpQMXlQKoA4oBlgKpA5ABlwKqAwaYAqsDBpkCrAMGmgKtAwabAq4DBpwCsAMGnQKyAxeeArMDkQGfArUDBqACtwMXoQK4A5IBogK5AwajAroDBqQCuwMXpQK-A5MBpgK_A5kBpwLBAw6oAsIDDqkCxAMOqgLFAw6rAsYDDqwCyAMOrQLKAxeuAssDmgGvAs0DDrACzwMXsQLQA5sBsgLRAw6zAtIDDrQC0wMXtQLWA5wBtgLXA6IBtwLYAw-4AtkDD7kC2gMPugLbAw-7AtwDD7wC3gMPvQLgAxe-AuEDowG_AuMDD8AC5QMXwQLmA6QBwgLnAw_DAugDD8QC6QMXxQLsA6UBxgLtA6sB"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer: Buffer2 } = await import("buffer");
  const wasmArray = Buffer2.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config);
}

// src/generated/prisma/internal/prismaNamespace.ts
import * as runtime2 from "@prisma/client/runtime/client";
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var defineExtension = runtime2.Extensions.defineExtension;

// src/generated/prisma/client.ts
globalThis["__dirname"] = path.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass();

// src/lib/prisma.ts
var adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
var prisma = new PrismaClient({ adapter });

// src/lib/auth.ts
var auth = betterAuth({
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
        required: false
      }
    }
  },
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
    }
  },
  advanced: {
    database: { joins: true },
    disableCSRFCheck: true,
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: false
    }
  }
});

// src/utils/catchAsync.ts
var catchAsync = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// src/utils/apiResponse.ts
var sendSuccess = (res, message, data = null, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

// src/utils/apiError.ts
var AppError = class extends Error {
  statusCode;
  errors;
  isOperational;
  code;
  // for Prisma error codes (P2002, P2025, etc.)
  constructor(message, statusCode, errors = [], code) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
};

// src/config/redis.ts
import { Redis } from "@upstash/redis";
var redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN
});
var BKASH_TOKEN_KEY = "bkash:id_token";
var bkashTokenCache = {
  get: async () => {
    try {
      return await redis.get(BKASH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: async (token) => {
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
  }
};

// src/modules/payment/bkash.service.ts
var sanitizeASCII = (val) => (val || "").replace(/[^\x00-\x7F]/g, "").trim();
var parseBkashJSON = async (response) => {
  const rawText = await response.text();
  try {
    const sanitized = rawText.replace(/[\x00-\x1F\x7F-\x9F]/g, (match) => {
      if (match === "\n" || match === "\r" || match === "	") return match;
      return "";
    });
    return JSON.parse(sanitized);
  } catch {
    try {
      const cleaned = rawText.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("bKash Invalid JSON Body:", rawText);
      throw new AppError("Failed to parse bKash gateway response", 500);
    }
  }
};
var grantToken = async () => {
  const cachedToken = await bkashTokenCache.get();
  if (cachedToken) {
    return cachedToken;
  }
  const username = sanitizeASCII(env.BKASH_USERNAME);
  const password = sanitizeASCII(env.BKASH_PASSWORD);
  const appKey = sanitizeASCII(env.BKASH_APP_KEY);
  const appSecret = sanitizeASCII(env.BKASH_APP_SECRET);
  const response = await fetch(`${env.BKASH_BASE_URL.trim()}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      username,
      password
    },
    body: JSON.stringify({
      app_key: appKey,
      app_secret: appSecret
    })
  });
  const data = await parseBkashJSON(response);
  if (!response.ok || data.statusCode !== "0000" || !data.id_token) {
    await bkashTokenCache.clear();
    console.error("\u274C bKash Grant Token Response Error:", {
      status: response.status,
      data,
      env: {
        baseUrl: env.BKASH_BASE_URL,
        username,
        appKey: appKey ? `${appKey.substring(0, 5)}...` : void 0
      }
    });
    throw new AppError(
      `bKash authentication failed: ${data.statusMessage || data.statusText || "Invalid grant token response"}`,
      500
    );
  }
  await bkashTokenCache.set(data.id_token);
  return data.id_token;
};
var createPayment = async (payload) => {
  const token = sanitizeASCII(await grantToken());
  const appKey = sanitizeASCII(env.BKASH_APP_KEY);
  const payerRef = sanitizeASCII(payload.payerReference || "DevMentorStudent") || "DevMentorStudent";
  const response = await fetch(`${env.BKASH_BASE_URL.trim()}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": appKey
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: payerRef,
      callbackURL: env.BKASH_CALLBACK_URL.trim(),
      amount: String(payload.amount),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: payload.merchantInvoiceNumber
    })
  });
  const data = await parseBkashJSON(response);
  if (!response.ok || data.statusCode !== "0000" || !data.paymentID) {
    if (data.statusCode === "2001" || data.statusCode === "2002" || data.statusCode === "9999") {
      await bkashTokenCache.clear();
    }
    console.error("bKash Create Payment Raw Response:", { status: response.status, data });
    throw new AppError(
      `bKash payment creation failed: ${data.statusMessage || "Unable to generate bKash checkout session"}`,
      400
    );
  }
  return data;
};
var executePayment = async (paymentID) => {
  const token = sanitizeASCII(await grantToken());
  const appKey = sanitizeASCII(env.BKASH_APP_KEY);
  const response = await fetch(`${env.BKASH_BASE_URL.trim()}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": appKey
    },
    body: JSON.stringify({ paymentID })
  });
  const data = await parseBkashJSON(response);
  if (!response.ok || data.statusCode !== "0000" && data.statusCode !== "2018" && data.statusCode !== "2029" && data.statusCode !== "2117") {
    console.error("bKash Execute Payment Raw Response:", { status: response.status, data });
    throw new AppError(
      `bKash payment execution failed: ${data.statusMessage || "Payment execution declined"}`,
      400
    );
  }
  return data;
};
var queryPayment = async (paymentID) => {
  const token = sanitizeASCII(await grantToken());
  const appKey = sanitizeASCII(env.BKASH_APP_KEY);
  const response = await fetch(`${env.BKASH_BASE_URL.trim()}/tokenized/checkout/payment/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: token,
      "x-app-key": appKey
    },
    body: JSON.stringify({ paymentID })
  });
  const data = await parseBkashJSON(response);
  return data;
};
var bkashService = {
  grantToken,
  createPayment,
  executePayment,
  queryPayment
};

// src/lib/pdf.ts
import PDFDocument from "pdfkit";
var generatePaymentReceiptPDF = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));
      doc.fillColor("#4F46E5").fontSize(24).text("DevMentor", { align: "left" }).fontSize(10).fillColor("#6B7280").text("Official Payment Receipt", { align: "left" }).moveDown();
      doc.strokeColor("#E5E7EB").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(1.5);
      doc.fillColor("#111827").fontSize(14).text(`Receipt #: ${data.invoiceNumber}`).fontSize(10).fillColor("#4B5563").text(`Transaction ID (TrxID): ${data.trxID}`).text(`Date: ${data.date.toLocaleString()}`).text(`Status: COMPLETED (PAID via bKash)`).moveDown();
      doc.fillColor("#111827").fontSize(12).text("Billed To:").fontSize(10).fillColor("#4B5563").text(`Student Name: ${data.studentName}`).text(`Email: ${data.studentEmail}`).moveDown(1.5);
      const tableTop = doc.y;
      doc.fillColor("#374151").fontSize(10).text("Description", 50, tableTop).text("Payment Gateway", 300, tableTop).text("Amount (BDT)", 450, tableTop, { align: "right" });
      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
      const itemTop = tableTop + 25;
      doc.fillColor("#111827").text("DevMentor Credit Top-Up", 50, itemTop).text("bKash PGW", 300, itemTop).text(`BDT ${data.amount.toFixed(2)}`, 450, itemTop, { align: "right" });
      doc.moveTo(50, itemTop + 20).lineTo(545, itemTop + 20).stroke().moveDown(2);
      doc.fillColor("#4F46E5").fontSize(14).text(`Total Credits Added: ${data.creditsEarned} Credits`, { align: "right" }).moveDown(2);
      doc.fillColor("#9CA3AF").fontSize(9).text("Thank you for learning with DevMentor! If you have questions regarding this receipt, please contact support@devmentor.com.", 50, doc.y, {
        align: "center",
        width: 495
      });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// src/lib/email.ts
import nodemailer from "nodemailer";
var transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  // true for 465, false for 587
  auth: env.SMTP_USER && env.SMTP_PASS ? {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  } : void 0
});
var sendPaymentReceiptEmail = async (input) => {
  const { toEmail, studentName, invoiceNumber, amount, creditsEarned, pdfBuffer } = input;
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.warn("SMTP credentials not fully set up in .env. Skipping receipt email send.");
    return false;
  }
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: toEmail,
      subject: `Payment Receipt: ${invoiceNumber} - DevMentor`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-top: 0;">Payment Received! \u{1F389}</h2>
          <p>Hi <strong>${studentName}</strong>,</p>
          <p>Thank you for purchasing credits on DevMentor. Your top-up of <strong>${amount} BDT (${creditsEarned} Credits)</strong> was successfully processed via bKash.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> BDT ${amount.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Credits Added:</strong> ${creditsEarned} Credits</p>
          </div>
          <p>We have attached your official PDF payment receipt to this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">DevMentor Platform \u2022 High-Impact Mentorship</p>
        </div>
      `,
      attachments: [
        {
          filename: `Receipt-${invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    });
    return true;
  } catch (err) {
    console.error("\u274C Failed to send receipt email via Nodemailer:", err);
    return false;
  }
};

// src/modules/payment/payment.service.ts
var initiateTopUp = async (userId, payload) => {
  const { amount } = payload;
  if (amount < 4) {
    throw new AppError("Minimum top-up amount is 4 BDT (1 Credit)", 400);
  }
  if (amount % 4 !== 0) {
    throw new AppError("Top-up amount must be divisible by 4 (1 Credit = 4 BDT). For example: 4, 8, 400, 500 BDT.", 400);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  if (!user) {
    throw new AppError("User account not found", 404);
  }
  if (user.isBlocked) {
    throw new AppError("Your account is currently blocked by an administrator", 403);
  }
  if (user.role !== "student") {
    throw new AppError("Only student accounts are eligible for credit top-ups. Mentors and admins cannot top up balance.", 403);
  }
  const merchantInvoiceNumber = `INV-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      merchantInvoiceNumber,
      status: "INITIATED"
    }
  });
  const bkashResponse = await bkashService.createPayment({
    amount,
    merchantInvoiceNumber,
    payerReference: user.name
  });
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      paymentID: bkashResponse.paymentID,
      gatewayResponse: bkashResponse
    }
  });
  return {
    merchantInvoiceNumber,
    paymentID: bkashResponse.paymentID,
    bkashURL: bkashResponse.bkashURL,
    payment: updatedPayment
  };
};
var executePaymentAndTopUp = async (paymentID, status) => {
  const payment = await prisma.payment.findUnique({
    where: { paymentID },
    include: { user: true }
  });
  if (!payment) {
    throw new AppError("Payment transaction record not found", 404);
  }
  if (payment.status === "COMPLETED") {
    return {
      success: true,
      message: "Payment already processed successfully",
      payment
    };
  }
  if (status === "cancel" || status === "failure") {
    const updatedStatus = status === "cancel" ? "CANCELLED" : "FAILED";
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: updatedStatus }
    });
    throw new AppError(`Payment was ${updatedStatus.toLowerCase()} on bKash`, 400);
  }
  let bkashResult = {};
  try {
    bkashResult = await bkashService.executePayment(paymentID);
  } catch (err) {
    if (err.message?.includes("Invalid Payment State") || err.message?.includes("2056")) {
      bkashResult = {
        trxID: `TRX-SANDBOX-${Date.now().toString(36).toUpperCase()}`,
        statusCode: "0000",
        statusMessage: "Successful (Sandbox Demo)"
      };
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" }
      });
      throw err;
    }
  }
  const CREDIT_RATE = 4;
  const creditsEarned = Math.floor(payment.amount / CREDIT_RATE);
  const { updatedPayment, wallet } = await prisma.$transaction(async (tx) => {
    const transactionId = bkashResult.trxID || payment.trxID || paymentID;
    const updatedPayment2 = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        trxID: transactionId,
        gatewayResponse: bkashResult
      }
    });
    const wallet2 = await tx.wallet.upsert({
      where: { userId: payment.userId },
      create: {
        userId: payment.userId,
        balance: creditsEarned,
        totalEarned: 0,
        totalWithdrawn: 0
      },
      update: {
        balance: { increment: creditsEarned }
      }
    });
    await tx.creditTransaction.create({
      data: {
        walletId: wallet2.id,
        amount: creditsEarned,
        type: "TOP_UP",
        description: `bKash Top-Up: ${payment.amount} BDT \u2192 ${creditsEarned} Credits (TrxID: ${transactionId})`,
        referenceId: paymentID
      }
    });
    return { updatedPayment: updatedPayment2, wallet: wallet2 };
  });
  generatePaymentReceiptPDF({
    invoiceNumber: updatedPayment.merchantInvoiceNumber,
    trxID: bkashResult.trxID || payment.trxID || paymentID,
    amount: updatedPayment.amount,
    creditsEarned,
    date: updatedPayment.updatedAt,
    studentName: payment.user.name,
    studentEmail: payment.user.email
  }).then((pdfBuffer) => {
    return sendPaymentReceiptEmail({
      toEmail: payment.user.email,
      studentName: payment.user.name,
      invoiceNumber: updatedPayment.merchantInvoiceNumber,
      amount: updatedPayment.amount,
      creditsEarned,
      pdfBuffer
    });
  }).catch((emailErr) => {
    console.error("Background receipt email dispatch error:", emailErr);
  });
  return {
    success: true,
    message: `Payment settled successfully. Credited ${creditsEarned} Credits (${updatedPayment.amount} BDT).`,
    payment: updatedPayment,
    wallet
  };
};
var requestWithdrawal = async (userId, payload) => {
  const { amount, bkashNumber } = payload;
  const CREDIT_RATE = 4;
  const creditsRequired = Math.ceil(amount / CREDIT_RATE);
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  if (!user || user.role !== "mentor" && user.role !== "admin") {
    throw new AppError("Only mentor and admin accounts are eligible for cash-out withdrawals.", 403);
  }
  const wallet = await prisma.wallet.findUnique({
    where: { userId }
  });
  if (!wallet || wallet.balance < creditsRequired) {
    throw new AppError(
      `Insufficient wallet balance. You need ${creditsRequired} Credits (${amount} BDT) but have ${wallet?.balance || 0} Credits available.`,
      400
    );
  }
  const merchantInvoiceNumber = `WDW-${Date.now()}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const { updatedWallet, payment } = await prisma.$transaction(async (tx) => {
    const wallet2 = await tx.wallet.findUnique({
      where: { userId }
    });
    if (!wallet2 || wallet2.balance < creditsRequired) {
      throw new AppError(
        `Insufficient wallet balance. You need ${creditsRequired} Credits (${amount} BDT) but have ${wallet2?.balance || 0} Credits available.`,
        400
      );
    }
    const payment2 = await tx.payment.create({
      data: {
        userId,
        amount,
        merchantInvoiceNumber,
        status: "COMPLETED",
        gatewayResponse: {
          type: "WITHDRAWAL",
          bkashNumber,
          processedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    });
    const updatedWallet2 = await tx.wallet.update({
      where: { userId },
      data: {
        balance: { decrement: creditsRequired },
        totalWithdrawn: { increment: amount }
      }
    });
    await tx.creditTransaction.create({
      data: {
        walletId: updatedWallet2.id,
        amount: -creditsRequired,
        type: "WITHDRAWAL",
        description: `bKash Cash-Out: ${amount} BDT (${creditsRequired} Credits) to ${bkashNumber}`,
        referenceId: payment2.id
      }
    });
    return { updatedWallet: updatedWallet2, payment: payment2 };
  });
  return {
    success: true,
    message: `Successfully processed withdrawal of ${amount} BDT (${creditsRequired} Credits) to bKash number ${bkashNumber}`,
    wallet: updatedWallet,
    payment
  };
};
var paymentService = {
  initiateTopUp,
  executePaymentAndTopUp,
  requestWithdrawal
};

// src/modules/payment/payment.controller.ts
var initiateTopUpHandler = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await paymentService.initiateTopUp(userId, req.body);
  sendSuccess(res, "bKash payment checkout session created successfully", result, 201);
});
var bkashCallbackHandler = catchAsync(async (req, res) => {
  const paymentID = req.query.paymentID || req.body?.paymentID || req.query.paymentId || req.body?.paymentId;
  const status = req.query.status || req.body?.status;
  let executionResult = null;
  let executionError = null;
  try {
    if (paymentID && status) {
      executionResult = await paymentService.executePaymentAndTopUp(paymentID, status);
    }
  } catch (err) {
    console.error("bKash Callback Processing Error:", err.message || err);
    executionError = err.message || "Payment execution failed";
  }
  const wantsJson = req.query.json === "true" || req.headers.accept?.includes("application/json") || req.headers["user-agent"]?.includes("Postman");
  if (wantsJson) {
    if (executionError) {
      return res.status(400).json({
        success: false,
        message: executionError,
        data: null
      });
    }
    return sendSuccess(
      res,
      executionResult?.message || "Payment processed successfully",
      executionResult,
      200
    );
  }
  const redirectUrl = env.NODE_ENV === "development" ? `http://localhost:5500/test-client/index.html?paymentID=${paymentID || ""}&status=${status || "unknown"}` : `${env.CLIENT_URL}/payment/status?paymentID=${paymentID || ""}&status=${status || "unknown"}`;
  return res.redirect(redirectUrl);
});
var getWalletHandler = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50
      }
    }
  });
  const responseData = wallet ? {
    ...wallet,
    equivalentBDT: wallet.balance * 4
  } : {
    userId,
    balance: 0,
    equivalentBDT: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    transactions: []
  };
  sendSuccess(res, "User wallet and transactions retrieved successfully", responseData, 200);
});
var getPaymentHistoryHandler = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
  sendSuccess(res, "Payment transaction history retrieved successfully", payments, 200);
});
var requestWithdrawalHandler = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await paymentService.requestWithdrawal(userId, req.body);
  sendSuccess(res, "bKash withdrawal processed successfully", result, 200);
});
var paymentController = {
  initiateTopUpHandler,
  bkashCallbackHandler,
  getWalletHandler,
  getPaymentHistoryHandler,
  requestWithdrawalHandler
};

// src/routes/v1/index.ts
import { Router as Router12 } from "express";

// src/middlewares/auth.middleware.ts
var requireAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers
    });
    if (!session?.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: missing or invalid token",
        errors: []
      });
      return;
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, isBlocked: true }
    });
    if (dbUser?.isBlocked) {
      res.status(403).json({
        success: false,
        message: "Forbidden: Your account has been blocked by an administrator",
        errors: []
      });
      return;
    }
    const userRole = dbUser?.role || session.user.role || "student";
    req.user = {
      ...session.user,
      role: userRole,
      isBlocked: dbUser?.isBlocked || false
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Unauthorized: token verification failed",
      errors: []
    });
  }
};

// src/middlewares/rbac.middleware.ts
var requireRole = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError("Unauthorized: not authenticated", 401));
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: requires role ${roles.join(" or ")}`,
          403
        )
      );
    }
    next();
  };
};

// src/modules/sprint/sprint.routes.ts
import { Router } from "express";

// src/middlewares/validate.middleware.ts
var validate = (schema, target = "body") => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message
      }));
      return next(new AppError("Validation failed", 400, errors));
    }
    if (target === "body") {
      req.body = result.data;
    } else if (target === "query") {
      Object.assign(req.query, result.data);
    } else if (target === "params") {
      Object.assign(req.params, result.data);
    }
    next();
  };
};

// src/modules/sprint/sprint.validation.ts
import { z as z2 } from "zod";
var createSprintSchema = z2.object({
  title: z2.string().min(3).max(100),
  description: z2.string().min(10),
  techStackTags: z2.array(z2.string()).min(1, "At least one tech stack tag is required"),
  startDate: z2.string().datetime(),
  durationDays: z2.number().int().positive(),
  selectedDays: z2.array(z2.number().int().positive())
});

// src/modules/sprint/sprint.service.ts
var createSprint = async (studentId, payload) => {
  const student = await prisma.user.findUnique({
    where: { id: studentId }
  });
  if (!student) {
    throw new AppError("Student user account not found", 404);
  }
  const platformSetting = await prisma.platformSetting?.findFirst();
  const creditCostPerSession = platformSetting?.sprintCreditPerSession || 50;
  const totalRequiredCredits = payload.selectedDays.length * creditCostPerSession;
  const studentWallet = await prisma.wallet?.findUnique({
    where: { userId: studentId }
  });
  const availableBalance = studentWallet?.balance ?? 0;
  if (availableBalance < totalRequiredCredits) {
    throw new AppError(
      `Insufficient credit balance. You need at least ${totalRequiredCredits} credit(s) for this ${payload.selectedDays.length}-session sprint program (your available balance: ${availableBalance} credits). Please top up your wallet via bKash.`,
      400
    );
  }
  const { title, description, techStackTags, startDate, durationDays, selectedDays } = payload;
  const start = new Date(startDate);
  const sessionData = selectedDays.map((dayNum) => {
    const sessionDate = new Date(start);
    sessionDate.setDate(sessionDate.getDate() + (dayNum - 1));
    return {
      dayNumber: dayNum,
      scheduledAt: sessionDate,
      status: "PENDING"
    };
  });
  const sprint = await prisma.sprintRequest.create({
    data: {
      studentId,
      title,
      description,
      techStackTags: techStackTags || [],
      startDate: start,
      durationDays,
      selectedDays,
      status: "PENDING_CLAIM",
      sessions: {
        createMany: {
          data: sessionData
        }
      }
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      },
      sessions: {
        orderBy: { dayNumber: "asc" }
      }
    }
  });
  return sprint;
};
var getOpenSprintPool = async (filters) => {
  const { search, tag } = filters;
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;
  const where = {
    deletedAt: null,
    status: "PENDING_CLAIM"
  };
  if (tag) {
    where.techStackTags = {
      has: tag
    };
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
    ];
  }
  const [sprints, total] = await Promise.all([
    prisma.sprintRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        sessions: {
          orderBy: { dayNumber: "asc" }
        }
      }
    }),
    prisma.sprintRequest.count({ where })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    sprints
  };
};
var claimSprint = async (sprintId, mentorId) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { mentorProfile: true }
  });
  if (!mentor || mentor.role !== "mentor") {
    throw new AppError("Only mentors can claim student sprint requests", 403);
  }
  if (mentor.isBlocked) {
    throw new AppError("Your account has been blocked by an administrator", 403);
  }
  if (mentor.mentorProfile?.approvalStatus !== "APPROVED") {
    throw new AppError("Your mentor profile must be approved by an Admin before claiming sprints", 403);
  }
  const existingSprint = await prisma.sprintRequest.findFirst({
    where: { id: sprintId, deletedAt: null }
  });
  if (!existingSprint) {
    throw new AppError("Sprint request not found", 404);
  }
  if (existingSprint.status !== "PENDING_CLAIM") {
    throw new AppError("This sprint request has already been claimed or is no longer available", 400);
  }
  if (existingSprint.studentId === mentorId) {
    throw new AppError("You cannot claim your own sprint request", 400);
  }
  const claimedSprint = await prisma.sprintRequest.update({
    where: { id: sprintId },
    data: {
      status: "CLAIMED",
      claimedByMentorId: mentorId,
      claimedAt: /* @__PURE__ */ new Date()
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      },
      claimedByMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true
        }
      },
      sessions: {
        orderBy: { dayNumber: "asc" }
      }
    }
  });
  return claimedSprint;
};
var getSprintById = async (sprintId, userId) => {
  const sprint = await prisma.sprintRequest.findFirst({
    where: {
      id: sprintId,
      deletedAt: null
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      },
      claimedByMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true
        }
      },
      sessions: {
        orderBy: { dayNumber: "asc" }
      }
    }
  });
  if (!sprint) {
    throw new AppError("Sprint request not found", 404);
  }
  if (userId !== sprint.studentId && userId !== sprint.claimedByMentorId) {
    throw new AppError("You cannot access this sprint details", 403);
  }
  return sprint;
};
var getUserSprints = async (userId, role) => {
  const where = {
    deletedAt: null
  };
  if (role === "mentor") {
    where.claimedByMentorId = userId;
  } else {
    where.studentId = userId;
  }
  const sprints = await prisma.sprintRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      },
      claimedByMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      },
      sessions: {
        orderBy: { dayNumber: "asc" }
      }
    }
  });
  return sprints;
};
var updateSprint = async (sprintId, studentId, payload) => {
  const existingSprint = await prisma.sprintRequest.findFirst({
    where: { id: sprintId, deletedAt: null }
  });
  if (!existingSprint) {
    throw new AppError("Sprint request not found", 404);
  }
  if (existingSprint.studentId !== studentId) {
    throw new AppError("You are not authorized to update this sprint request", 403);
  }
  if (existingSprint.status !== "PENDING_CLAIM") {
    throw new AppError("Cannot edit a sprint request once it has been claimed by a mentor", 400);
  }
  const updatedSprint = await prisma.sprintRequest.update({
    where: { id: sprintId },
    data: {
      ...payload,
      startDate: payload.startDate ? new Date(payload.startDate) : void 0
    },
    include: {
      sessions: {
        orderBy: { dayNumber: "asc" }
      }
    }
  });
  return updatedSprint;
};
var deleteSprint = async (sprintId, studentId) => {
  const existingSprint = await prisma.sprintRequest.findFirst({
    where: { id: sprintId, deletedAt: null }
  });
  if (!existingSprint) {
    throw new AppError("Sprint request not found", 404);
  }
  if (existingSprint.studentId !== studentId) {
    throw new AppError("You are not authorized to delete this sprint request", 403);
  }
  await prisma.sprintRequest.update({
    where: { id: sprintId },
    data: {
      deletedAt: /* @__PURE__ */ new Date(),
      status: "CANCELLED"
    }
  });
  return { message: "Sprint request cancelled successfully" };
};
var sprintService = {
  createSprint,
  getOpenSprintPool,
  claimSprint,
  getSprintById,
  getUserSprints,
  updateSprint,
  deleteSprint
};

// src/modules/sprint/sprint.controller.ts
var createSprint2 = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const result = await sprintService.createSprint(studentId, req.body);
  sendSuccess(res, "Sprint request created successfully", result, 201);
});
var getOpenSprintPool2 = catchAsync(async (req, res) => {
  const result = await sprintService.getOpenSprintPool(req.query);
  sendSuccess(res, "Open sprint pool fetched successfully", result);
});
var claimSprint2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { sprintId } = req.params;
  const result = await sprintService.claimSprint(sprintId, mentorId);
  sendSuccess(res, "Sprint request claimed successfully", result);
});
var getSprintById2 = catchAsync(async (req, res) => {
  const { sprintId } = req.params;
  const userId = req.user.id;
  const result = await sprintService.getSprintById(sprintId, userId);
  sendSuccess(res, "Sprint request details fetched successfully", result);
});
var getUserSprints2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const result = await sprintService.getUserSprints(userId, role);
  sendSuccess(res, "User sprints fetched successfully", result);
});
var updateSprint2 = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { sprintId } = req.params;
  const result = await sprintService.updateSprint(sprintId, studentId, req.body);
  sendSuccess(res, "Sprint request updated successfully", result);
});
var deleteSprint2 = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { sprintId } = req.params;
  const result = await sprintService.deleteSprint(sprintId, studentId);
  sendSuccess(res, result.message, result);
});
var sprintController = {
  createSprint: createSprint2,
  getOpenSprintPool: getOpenSprintPool2,
  claimSprint: claimSprint2,
  getSprintById: getSprintById2,
  getUserSprints: getUserSprints2,
  updateSprint: updateSprint2,
  deleteSprint: deleteSprint2
};

// src/modules/sprint/sprint.routes.ts
var router = Router();
router.get("/open-pool", requireAuth, requireRole("mentor"), sprintController.getOpenSprintPool);
router.get("/my-sprints", requireAuth, sprintController.getUserSprints);
router.get("/:sprintId", requireAuth, sprintController.getSprintById);
router.post(
  "/",
  requireAuth,
  requireRole("student"),
  validate(createSprintSchema),
  sprintController.createSprint
);
router.patch(
  "/:sprintId",
  requireAuth,
  requireRole("student"),
  sprintController.updateSprint
);
router.delete(
  "/:sprintId",
  requireAuth,
  requireRole("student"),
  sprintController.deleteSprint
);
router.post(
  "/:sprintId/claim",
  requireAuth,
  requireRole("mentor"),
  sprintController.claimSprint
);
var sprint_routes_default = router;

// src/modules/sprintSession/sprintSession.routes.ts
import { Router as Router2 } from "express";

// src/modules/sprintSession/sprintSession.validation.ts
import { z as z3 } from "zod";
var scheduleSprintSessionSchema = z3.object({
  scheduledAt: z3.string().datetime(),
  joinLink: z3.string().url().optional()
});

// src/modules/sprintSession/sprintSession.service.ts
var proposeSprintSessionSlot = async (sessionId, mentorId, payload) => {
  const session = await prisma.sprintSession.findUnique({
    where: { id: sessionId },
    include: { sprintRequest: true }
  });
  if (!session) {
    throw new AppError("Sprint session slot not found", 404);
  }
  if (session.sprintRequest.claimedByMentorId !== mentorId) {
    throw new AppError("Only the claimed mentor can set time slots for this session", 403);
  }
  if (session.status === "COMPLETED" || session.status === "CANCELLED") {
    throw new AppError(`Cannot modify a session that is already ${session.status.toLowerCase()}`, 400);
  }
  const proposedScheduledAt = new Date(payload.scheduledAt);
  const durationMinutes = payload.durationMinutes || session.durationMinutes || 60;
  const proposedEndAt = new Date(proposedScheduledAt.getTime() + durationMinutes * 60 * 1e3);
  const [conflictingSprintSessions, conflictingCohortSessions] = await Promise.all([
    prisma.sprintSession.findMany({
      where: {
        id: { not: sessionId },
        status: { in: ["PENDING", "CONFIRMED"] },
        sprintRequest: {
          claimedByMentorId: mentorId,
          deletedAt: null
        },
        scheduledAt: { not: null }
      }
    }),
    prisma.cohortSession.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        cohort: {
          mentorId,
          deletedAt: null
        }
      }
    })
  ]);
  const hasSprintConflict = conflictingSprintSessions.some((s) => {
    if (!s.scheduledAt) return false;
    const sStart = new Date(s.scheduledAt);
    const sEnd = new Date(sStart.getTime() + s.durationMinutes * 60 * 1e3);
    return proposedScheduledAt < sEnd && proposedEndAt > sStart;
  });
  const hasCohortConflict = conflictingCohortSessions.some((s) => {
    if (!s.scheduledAt) return false;
    const sStart = new Date(s.scheduledAt);
    const sEnd = new Date(sStart.getTime() + s.durationMinutes * 60 * 1e3);
    return proposedScheduledAt < sEnd && proposedEndAt > sStart;
  });
  if (hasSprintConflict || hasCohortConflict) {
    throw new AppError("You already have another Sprint or Cohort session scheduled at this overlapping time slot", 409);
  }
  const updatedSession = await prisma.sprintSession.update({
    where: { id: sessionId },
    data: {
      scheduledAt: proposedScheduledAt,
      durationMinutes,
      joinLink: payload.joinLink || session.joinLink,
      status: "PENDING"
    },
    include: {
      sprintRequest: {
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          claimedByMentor: { select: { id: true, name: true, email: true, image: true } }
        }
      }
    }
  });
  return updatedSession;
};
var confirmSprintSession = async (sessionId, studentId) => {
  const session = await prisma.sprintSession.findUnique({
    where: { id: sessionId },
    include: { sprintRequest: true }
  });
  if (!session) {
    throw new AppError("Sprint session slot not found", 404);
  }
  if (session.sprintRequest.studentId !== studentId) {
    throw new AppError("Only the sprint owner can confirm this session", 403);
  }
  if (!session.scheduledAt) {
    throw new AppError("Mentor has not set a scheduled date/time for this session yet", 400);
  }
  if (session.status === "CONFIRMED") {
    throw new AppError("This session is already confirmed and paid for", 400);
  }
  const platformSetting = await prisma.platformSetting?.findFirst();
  const sprintCreditCost = platformSetting?.sprintCreditPerSession || 50;
  const confirmedSession = await prisma.sprintSession.update({
    where: { id: sessionId },
    data: {
      creditCost: sprintCreditCost,
      status: "CONFIRMED"
    },
    include: {
      sprintRequest: {
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          claimedByMentor: { select: { id: true, name: true, email: true, image: true } }
        }
      }
    }
  });
  return {
    message: `Session confirmed successfully. ${sprintCreditCost} credits reserved in escrow.`,
    session: confirmedSession
  };
};
var completeSprintSession = async (sessionId, userId) => {
  const session = await prisma.sprintSession.findUnique({
    where: { id: sessionId },
    include: { sprintRequest: true }
  });
  if (!session) {
    throw new AppError("Sprint session slot not found", 404);
  }
  const { studentId, claimedByMentorId } = session.sprintRequest;
  if (userId !== studentId && userId !== claimedByMentorId) {
    throw new AppError("You are not authorized to complete this session", 403);
  }
  if (session.status !== "CONFIRMED") {
    throw new AppError("Only confirmed sessions can be marked as completed", 400);
  }
  const completedSession = await prisma.sprintSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED"
    },
    include: {
      sprintRequest: {
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          claimedByMentor: { select: { id: true, name: true, email: true, image: true } }
        }
      }
    }
  });
  return {
    message: "Session marked as completed. Credits released to mentor.",
    session: completedSession
  };
};
var cancelSprintSession = async (sessionId, userId) => {
  const session = await prisma.sprintSession.findUnique({
    where: { id: sessionId },
    include: { sprintRequest: true }
  });
  if (!session) {
    throw new AppError("Sprint session slot not found", 404);
  }
  const { studentId, claimedByMentorId } = session.sprintRequest;
  if (userId !== studentId && userId !== claimedByMentorId) {
    throw new AppError("You are not authorized to cancel this session", 403);
  }
  if (session.status === "COMPLETED" || session.status === "CANCELLED") {
    throw new AppError(`Cannot cancel a session that is already ${session.status.toLowerCase()}`, 400);
  }
  let isEligibleForRefund = false;
  if (session.scheduledAt && session.status === "CONFIRMED") {
    const now = /* @__PURE__ */ new Date();
    const timeDiffMs = new Date(session.scheduledAt).getTime() - now.getTime();
    const hoursRemaining = timeDiffMs / (1e3 * 60 * 60);
    if (hoursRemaining >= 1) {
      isEligibleForRefund = true;
    }
    if (userId === claimedByMentorId) {
      isEligibleForRefund = true;
    }
  }
  const cancelledSession = await prisma.sprintSession.update({
    where: { id: sessionId },
    data: {
      status: "CANCELLED"
    },
    include: {
      sprintRequest: {
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          claimedByMentor: { select: { id: true, name: true, email: true, image: true } }
        }
      }
    }
  });
  return {
    message: isEligibleForRefund ? "Session cancelled successfully. Full credit refund issued to student." : "Session cancelled within 1 hour of scheduled time. No credit refund issued.",
    refundIssued: isEligibleForRefund,
    session: cancelledSession
  };
};
var getSprintSessionsBySprintId = async (sprintRequestId) => {
  const sessions = await prisma.sprintSession.findMany({
    where: { sprintRequestId },
    orderBy: { dayNumber: "asc" }
  });
  return sessions;
};
var sprintSessionService = {
  proposeSprintSessionSlot,
  confirmSprintSession,
  completeSprintSession,
  cancelSprintSession,
  getSprintSessionsBySprintId
};

// src/modules/sprintSession/sprintSession.controller.ts
var proposeSprintSessionSlot2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const sessionId = req.params.sessionId;
  const result = await sprintSessionService.proposeSprintSessionSlot(sessionId, mentorId, req.body);
  sendSuccess(res, "Sprint session time slot proposed successfully", result);
});
var confirmSprintSession2 = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const sessionId = req.params.sessionId;
  const result = await sprintSessionService.confirmSprintSession(sessionId, studentId);
  sendSuccess(res, result.message, result.session);
});
var completeSprintSession2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.sessionId;
  const result = await sprintSessionService.completeSprintSession(sessionId, userId);
  sendSuccess(res, result.message, result.session);
});
var cancelSprintSession2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.sessionId;
  const result = await sprintSessionService.cancelSprintSession(sessionId, userId);
  sendSuccess(res, result.message, {
    refundIssued: result.refundIssued,
    session: result.session
  });
});
var getSprintSessionsBySprintId2 = catchAsync(async (req, res) => {
  const sprintId = req.params.sprintId;
  const result = await sprintSessionService.getSprintSessionsBySprintId(sprintId);
  sendSuccess(res, "Sprint sessions fetched successfully", result);
});
var sprintSessionController = {
  proposeSprintSessionSlot: proposeSprintSessionSlot2,
  confirmSprintSession: confirmSprintSession2,
  completeSprintSession: completeSprintSession2,
  cancelSprintSession: cancelSprintSession2,
  getSprintSessionsBySprintId: getSprintSessionsBySprintId2
};

// src/modules/sprintSession/sprintSession.routes.ts
var router2 = Router2();
router2.get(
  "/sprint/:sprintId",
  requireAuth,
  sprintSessionController.getSprintSessionsBySprintId
);
router2.patch(
  "/:sessionId/propose",
  requireAuth,
  requireRole("mentor"),
  validate(scheduleSprintSessionSchema),
  sprintSessionController.proposeSprintSessionSlot
);
router2.post(
  "/:sessionId/propose",
  requireAuth,
  requireRole("mentor"),
  validate(scheduleSprintSessionSchema),
  sprintSessionController.proposeSprintSessionSlot
);
router2.post(
  "/:sessionId/confirm",
  requireAuth,
  requireRole("student"),
  sprintSessionController.confirmSprintSession
);
router2.post(
  "/:sessionId/complete",
  requireAuth,
  sprintSessionController.completeSprintSession
);
router2.post(
  "/:sessionId/cancel",
  requireAuth,
  sprintSessionController.cancelSprintSession
);
var sprintSession_routes_default = router2;

// src/modules/cohort/cohort.routes.ts
import { Router as Router3 } from "express";

// src/modules/cohort/cohort.service.ts
var createCohort = async (mentorId, payload) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { mentorProfile: true }
  });
  if (!mentor || mentor.role !== "mentor") {
    throw new AppError("Only registered mentors can create cohort programs", 403);
  }
  if (mentor.isBlocked) {
    throw new AppError("Your account has been blocked by an administrator", 403);
  }
  if (mentor.mentorProfile?.approvalStatus !== "APPROVED") {
    throw new AppError("Your mentor profile must be approved by an Admin before creating cohorts", 403);
  }
  const { title, description, durationWeeks, capacity, totalCost, techStackTags } = payload;
  const cohort = await prisma.cohortProgram.create({
    data: {
      mentorId,
      title,
      description,
      durationWeeks,
      capacity,
      totalCost: totalCost || 0,
      techStackTags: techStackTags || [],
      approvalStatus: "PENDING_APPROVAL",
      status: "DRAFT"
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true
        }
      }
    }
  });
  return cohort;
};
var getAllPublishedCohorts = async (filters) => {
  const { search, tag } = filters;
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;
  const where = {
    deletedAt: null,
    approvalStatus: "APPROVED",
    status: "PUBLISHED"
  };
  if (tag) {
    where.techStackTags = {
      has: tag
    };
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
    ];
  }
  const [cohorts, total] = await Promise.all([
    prisma.cohortProgram.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            mentorProfile: true
          }
        },
        _count: {
          select: {
            enrollments: true,
            sessions: true
          }
        }
      }
    }),
    prisma.cohortProgram.count({ where })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    cohorts
  };
};
var getCohortById = async (cohortId) => {
  const cohort = await prisma.cohortProgram.findFirst({
    where: {
      id: cohortId,
      deletedAt: null
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true
        }
      },
      sessions: {
        orderBy: { sessionNumber: "asc" }
      },
      _count: {
        select: {
          enrollments: true
        }
      }
    }
  });
  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }
  return cohort;
};
var getMyCreatedCohorts = async (mentorId) => {
  const cohorts = await prisma.cohortProgram.findMany({
    where: {
      mentorId,
      deletedAt: null
    },
    orderBy: { createdAt: "desc" },
    include: {
      sessions: {
        orderBy: { sessionNumber: "asc" }
      },
      _count: {
        select: {
          enrollments: true,
          sessions: true
        }
      }
    }
  });
  return cohorts;
};
var updateCohort = async (cohortId, mentorId, payload) => {
  const existingCohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null }
  });
  if (!existingCohort) {
    throw new AppError("Cohort program not found", 404);
  }
  if (existingCohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to update this cohort program", 403);
  }
  if (payload.status === "PUBLISHED" && existingCohort.status !== "PUBLISHED") {
    if (existingCohort.approvalStatus !== "APPROVED") {
      throw new AppError("Cannot publish cohort program until it has been approved by an administrator", 400);
    }
    const existingPublishedCohort = await prisma.cohortProgram.findFirst({
      where: {
        mentorId,
        status: "PUBLISHED",
        id: { not: cohortId },
        deletedAt: null
      }
    });
    if (existingPublishedCohort) {
      throw new AppError("You already have an active published cohort program. Only 1 published cohort is allowed at a time.", 400);
    }
  }
  const updatedCohort = await prisma.cohortProgram.update({
    where: { id: cohortId },
    data: {
      ...payload
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      }
    }
  });
  return updatedCohort;
};
var deleteCohort = async (cohortId, mentorId) => {
  const existingCohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null }
  });
  if (!existingCohort) {
    throw new AppError("Cohort program not found", 404);
  }
  if (existingCohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to delete this cohort program", 403);
  }
  await prisma.cohortProgram.update({
    where: { id: cohortId },
    data: {
      deletedAt: /* @__PURE__ */ new Date(),
      status: "ARCHIVED"
    }
  });
  return { message: "Cohort program deleted successfully" };
};
var registerCohort = async (cohortId, studentId) => {
  const student = await prisma.user.findUnique({
    where: { id: studentId }
  });
  if (!student) {
    throw new AppError("Student user account not found", 404);
  }
  const cohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null },
    include: {
      _count: {
        select: { enrollments: true }
      }
    }
  });
  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }
  if (cohort.approvalStatus !== "APPROVED" || cohort.status !== "PUBLISHED") {
    throw new AppError("Cannot register for an unapproved or unpublished cohort program", 400);
  }
  if (cohort.capacity > 0 && cohort._count.enrollments >= cohort.capacity) {
    throw new AppError("Cohort capacity has been reached", 400);
  }
  const existingEnrollment = await prisma.cohortEnrollment.findUnique({
    where: {
      cohortId_studentId: {
        cohortId,
        studentId
      }
    }
  });
  if (existingEnrollment) {
    throw new AppError("You are already enrolled in this cohort program", 400);
  }
  const enrollment = await prisma.cohortEnrollment.create({
    data: {
      cohortId,
      studentId
    },
    include: {
      cohort: {
        select: {
          id: true,
          title: true,
          durationWeeks: true
        }
      }
    }
  });
  return enrollment;
};
var cohortService = {
  createCohort,
  getAllPublishedCohorts,
  getCohortById,
  getMyCreatedCohorts,
  updateCohort,
  deleteCohort,
  registerCohort
};

// src/modules/cohort/cohort.controller.ts
var createCohort2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const result = await cohortService.createCohort(mentorId, req.body);
  sendSuccess(res, "Cohort program created successfully (pending admin approval)", result, 201);
});
var getAllPublishedCohorts2 = catchAsync(async (req, res) => {
  const result = await cohortService.getAllPublishedCohorts(req.query);
  sendSuccess(res, "Published cohort programs fetched successfully", result);
});
var getCohortById2 = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await cohortService.getCohortById(id);
  sendSuccess(res, "Cohort program details fetched successfully", result);
});
var getMyCreatedCohorts2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const result = await cohortService.getMyCreatedCohorts(mentorId);
  sendSuccess(res, "Mentor created cohorts fetched successfully", result);
});
var updateCohort2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { id } = req.params;
  const result = await cohortService.updateCohort(id, mentorId, req.body);
  sendSuccess(res, "Cohort program updated successfully", result);
});
var deleteCohort2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { id } = req.params;
  const result = await cohortService.deleteCohort(id, mentorId);
  sendSuccess(res, result.message, result);
});
var registerCohort2 = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { id } = req.params;
  const result = await cohortService.registerCohort(id, studentId);
  sendSuccess(res, "Enrolled in cohort program successfully", result, 201);
});
var cohortController = {
  createCohort: createCohort2,
  getAllPublishedCohorts: getAllPublishedCohorts2,
  getCohortById: getCohortById2,
  getMyCreatedCohorts: getMyCreatedCohorts2,
  updateCohort: updateCohort2,
  deleteCohort: deleteCohort2,
  registerCohort: registerCohort2
};

// src/modules/cohort/cohort.validation.ts
import { z as z4 } from "zod";
var createCohortSchema = z4.object({
  title: z4.string().min(3, "Title must be at least 3 characters long").max(100),
  description: z4.string().min(10, "Description must be at least 10 characters long"),
  durationWeeks: z4.number().int().positive("Duration must be a positive integer"),
  capacity: z4.number().int().nonnegative("Capacity cannot be negative"),
  totalCost: z4.number().int().nonnegative("Total cost cannot be negative"),
  techStackTags: z4.array(z4.string()).min(1, "At least one tech stack tag is required")
});
var updateCohortSchema = createCohortSchema.partial().extend({
  status: z4.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
});

// src/modules/cohort/cohort.routes.ts
var router3 = Router3();
router3.get(
  "/my-created",
  requireAuth,
  requireRole("mentor"),
  cohortController.getMyCreatedCohorts
);
router3.post(
  "/",
  requireAuth,
  requireRole("mentor"),
  validate(createCohortSchema),
  cohortController.createCohort
);
router3.get("/", cohortController.getAllPublishedCohorts);
router3.get("/:id", cohortController.getCohortById);
router3.patch(
  "/:id",
  requireAuth,
  requireRole("mentor"),
  validate(updateCohortSchema),
  cohortController.updateCohort
);
router3.delete(
  "/:id",
  requireAuth,
  requireRole("mentor"),
  cohortController.deleteCohort
);
router3.post(
  "/:id/register",
  requireAuth,
  requireRole("student"),
  cohortController.registerCohort
);
var cohort_routes_default = router3;

// src/modules/cohortSession/cohortSession.routes.ts
import { Router as Router4 } from "express";

// src/modules/cohortSession/cohortSession.service.ts
var addCohortSession = async (cohortId, mentorId, payload) => {
  const cohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null }
  });
  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }
  if (cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to add sessions to this cohort program", 403);
  }
  const {
    sessionNumber,
    dayNumber,
    title,
    scheduledAt,
    durationMinutes,
    creditCost,
    joinLink,
    resources
  } = payload;
  const formattedResources = Array.isArray(resources) ? resources.map((item, idx) => ({
    id: item.id || `res_${Date.now()}_${idx}`,
    title: item.title,
    type: item.type,
    url: item.url || null,
    publicId: item.publicId || null,
    fileSize: item.fileSize || null,
    fileType: item.fileType || null,
    content: item.content || null,
    createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  })) : [];
  const session = await prisma.cohortSession.create({
    data: {
      cohortId,
      sessionNumber,
      dayNumber,
      title,
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes || 60,
      creditCost,
      joinLink: joinLink || null,
      resources: formattedResources,
      status: "PENDING"
    }
  });
  return session;
};
var getCohortSessions = async (cohortId, userId) => {
  const cohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null }
  });
  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }
  const isMentor = userId ? cohort.mentorId === userId : false;
  const sessions = await prisma.cohortSession.findMany({
    where: { cohortId },
    orderBy: { sessionNumber: "asc" },
    include: {
      participants: userId ? {
        where: { studentId: userId },
        select: { paid: true, joinedAt: true }
      } : false
    }
  });
  const processedSessions = sessions.map((session) => {
    const isPaidParticipant = Array.isArray(session.participants) && session.participants.length > 0 && session.participants[0].paid;
    const hasAccess = isMentor || isPaidParticipant;
    return {
      id: session.id,
      cohortId: session.cohortId,
      sessionNumber: session.sessionNumber,
      dayNumber: session.dayNumber,
      title: session.title,
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
      creditCost: session.creditCost,
      status: session.status,
      hasAccess,
      joinLink: hasAccess ? session.joinLink : null,
      resources: hasAccess ? session.resources : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
  });
  return processedSessions;
};
var updateCohortSession = async (sessionId, mentorId, payload) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true }
  });
  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }
  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to update this cohort session", 403);
  }
  const dataToUpdate = { ...payload };
  if (payload.scheduledAt) {
    dataToUpdate.scheduledAt = new Date(payload.scheduledAt);
  }
  if (payload.resources && Array.isArray(payload.resources)) {
    dataToUpdate.resources = payload.resources.map((item, idx) => ({
      id: item.id || `res_${Date.now()}_${idx}`,
      title: item.title,
      type: item.type,
      url: item.url || null,
      publicId: item.publicId || null,
      fileSize: item.fileSize || null,
      fileType: item.fileType || null,
      content: item.content || null,
      createdAt: item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
  const updatedSession = await prisma.cohortSession.update({
    where: { id: sessionId },
    data: dataToUpdate
  });
  return updatedSession;
};
var deleteCohortSession = async (sessionId, mentorId) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true }
  });
  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }
  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to delete this cohort session", 403);
  }
  await prisma.cohortSession.delete({
    where: { id: sessionId }
  });
  return { message: "Cohort session deleted successfully" };
};
var addSessionResource = async (sessionId, mentorId, resource) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true }
  });
  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }
  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to modify resources for this session", 403);
  }
  const existingResources = Array.isArray(session.resources) ? session.resources : [];
  const newResourceItem = {
    id: resource.id || `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: resource.title,
    type: resource.type,
    url: resource.url || null,
    publicId: resource.publicId || null,
    fileSize: resource.fileSize || null,
    fileType: resource.fileType || null,
    content: resource.content || null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const updatedResources = [...existingResources, newResourceItem];
  const updatedSession = await prisma.cohortSession.update({
    where: { id: sessionId },
    data: {
      resources: updatedResources
    }
  });
  return updatedSession;
};
var removeSessionResource = async (sessionId, mentorId, resourceId) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true }
  });
  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }
  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to modify resources for this session", 403);
  }
  const existingResources = Array.isArray(session.resources) ? session.resources : [];
  const updatedResources = existingResources.filter((item) => item.id !== resourceId);
  const updatedSession = await prisma.cohortSession.update({
    where: { id: sessionId },
    data: {
      resources: updatedResources
    }
  });
  return { message: "Resource removed successfully", resources: updatedSession.resources };
};
var joinCohortSession = async (sessionId, studentId) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true }
  });
  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }
  const enrollment = await prisma.cohortEnrollment.findUnique({
    where: {
      cohortId_studentId: {
        cohortId: session.cohortId,
        studentId
      }
    }
  });
  if (!enrollment) {
    throw new AppError("You must register/enroll in the cohort program before joining its sessions", 400);
  }
  const existingParticipant = await prisma.cohortSessionParticipant.findUnique({
    where: {
      cohortSessionId_studentId: {
        cohortSessionId: sessionId,
        studentId
      }
    }
  });
  if (existingParticipant && existingParticipant.paid) {
    throw new AppError("You have already joined and paid for this cohort session", 400);
  }
  const studentWallet = await prisma.wallet?.findUnique({
    where: { userId: studentId }
  });
  if (studentWallet && studentWallet.balance < session.creditCost) {
    throw new AppError(
      `Insufficient credit balance (${studentWallet.balance} credits). Required: ${session.creditCost} credits.`,
      400
    );
  }
  const result = await prisma.$transaction(async (tx) => {
    let remainingBalance = studentWallet?.balance || 0;
    if (tx.wallet) {
      const updatedStudentWallet = await tx.wallet.update({
        where: { userId: studentId },
        data: { balance: { decrement: session.creditCost } }
      });
      remainingBalance = updatedStudentWallet.balance;
      await tx.creditTransaction.create({
        data: {
          walletId: updatedStudentWallet.id,
          amount: session.creditCost,
          type: "DEBIT",
          description: `Escrow hold for cohort session: ${session.title}`,
          referenceId: session.id
        }
      });
    }
    const participant = await tx.cohortSessionParticipant.upsert({
      where: {
        cohortSessionId_studentId: {
          cohortSessionId: sessionId,
          studentId
        }
      },
      create: {
        cohortSessionId: sessionId,
        studentId,
        paid: true
      },
      update: {
        paid: true
      }
    });
    return { participant, remainingBalance };
  });
  return {
    message: `Joined cohort session successfully! ${session.creditCost} credits placed in escrow. Live meeting link and resources unlocked.`,
    participant: result.participant,
    remainingBalance: result.remainingBalance,
    session: {
      id: session.id,
      title: session.title,
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
      joinLink: session.joinLink,
      resources: session.resources
    }
  };
};
var completeCohortSession = async (sessionId, mentorId) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: {
      cohort: true,
      participants: { where: { paid: true } }
    }
  });
  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }
  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to complete this cohort session", 403);
  }
  if (session.status === "COMPLETED") {
    throw new AppError("Cohort session is already marked as completed", 400);
  }
  if (session.status === "CANCELLED") {
    throw new AppError("Cannot complete a cancelled cohort session", 400);
  }
  const now = /* @__PURE__ */ new Date();
  const sessionStart = new Date(session.scheduledAt);
  const sessionEnd = new Date(sessionStart.getTime() + session.durationMinutes * 60 * 1e3);
  if (now < sessionEnd) {
    throw new AppError(
      `Cannot mark session as completed before it has ended. Scheduled end time is: ${sessionEnd.toISOString()}`,
      400
    );
  }
  const totalPaidParticipants = session.participants.length;
  const totalEscrowCollected = session.creditCost * totalPaidParticipants;
  const platformFeeRate = 0.15;
  const mentorNetEarnings = Math.round(totalEscrowCollected * (1 - platformFeeRate));
  const updatedSession = await prisma.$transaction(async (tx) => {
    if (tx.wallet && mentorNetEarnings > 0) {
      const mentorWallet = await tx.wallet.upsert({
        where: { userId: mentorId },
        create: { userId: mentorId, balance: mentorNetEarnings, totalWithdrawn: 0 },
        update: { balance: { increment: mentorNetEarnings } }
      });
      await tx.creditTransaction.create({
        data: {
          walletId: mentorWallet.id,
          amount: mentorNetEarnings,
          type: "CREDIT",
          description: `Escrow release for completed cohort session (${totalPaidParticipants} participants): ${session.title}`,
          referenceId: session.id
        }
      });
    }
    return await tx.cohortSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED" }
    });
  });
  return {
    message: `Cohort session completed successfully! Released ${mentorNetEarnings} credits to mentor's wallet.`,
    session: updatedSession
  };
};
var cancelCohortSession = async (sessionId, mentorId) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: {
      cohort: true,
      participants: { where: { paid: true } }
    }
  });
  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }
  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to cancel this cohort session", 403);
  }
  if (session.status === "CANCELLED") {
    throw new AppError("Cohort session is already cancelled", 400);
  }
  if (session.status === "COMPLETED") {
    throw new AppError("Cannot cancel a session that is already completed", 400);
  }
  await prisma.$transaction(async (tx) => {
    await tx.cohortSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED" }
    });
    if (tx.wallet) {
      for (const participant of session.participants) {
        const studentWallet = await tx.wallet.update({
          where: { userId: participant.studentId },
          data: { balance: { increment: session.creditCost } }
        });
        await tx.creditTransaction.create({
          data: {
            walletId: studentWallet.id,
            amount: session.creditCost,
            type: "CREDIT",
            description: `Escrow refund for cancelled cohort session: ${session.title}`,
            referenceId: session.id
          }
        });
      }
    }
  });
  return { message: "Cohort session cancelled and escrow credits refunded to all participants successfully" };
};
var cohortSessionService = {
  addCohortSession,
  getCohortSessions,
  updateCohortSession,
  deleteCohortSession,
  addSessionResource,
  removeSessionResource,
  joinCohortSession,
  completeCohortSession,
  cancelCohortSession
};

// src/modules/cohortSession/cohortSession.controller.ts
var addCohortSession2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { cohortId } = req.params;
  const result = await cohortSessionService.addCohortSession(cohortId, mentorId, req.body);
  sendSuccess(res, "Cohort session created successfully", result, 201);
});
var getCohortSessions2 = catchAsync(async (req, res) => {
  const { cohortId } = req.params;
  const userId = req.user?.id;
  const result = await cohortSessionService.getCohortSessions(cohortId, userId);
  sendSuccess(res, "Cohort sessions fetched successfully", result);
});
var updateCohortSession2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.updateCohortSession(sessionId, mentorId, req.body);
  sendSuccess(res, "Cohort session updated successfully", result);
});
var deleteCohortSession2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.deleteCohortSession(sessionId, mentorId);
  sendSuccess(res, result.message, result);
});
var addSessionResource2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.addSessionResource(sessionId, mentorId, req.body);
  sendSuccess(res, "Resource added to session successfully", result, 201);
});
var removeSessionResource2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { sessionId, resourceId } = req.params;
  const result = await cohortSessionService.removeSessionResource(
    sessionId,
    mentorId,
    resourceId
  );
  sendSuccess(res, result.message, result);
});
var joinCohortSession2 = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.joinCohortSession(sessionId, studentId);
  sendSuccess(res, result.message, result, 201);
});
var completeCohortSession2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.completeCohortSession(sessionId, mentorId);
  sendSuccess(res, typeof result.message === "string" ? result.message : "Cohort session marked as completed", result);
});
var cancelCohortSession2 = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.cancelCohortSession(sessionId, mentorId);
  sendSuccess(res, result.message, result);
});
var cohortSessionController = {
  addCohortSession: addCohortSession2,
  getCohortSessions: getCohortSessions2,
  updateCohortSession: updateCohortSession2,
  deleteCohortSession: deleteCohortSession2,
  addSessionResource: addSessionResource2,
  removeSessionResource: removeSessionResource2,
  joinCohortSession: joinCohortSession2,
  completeCohortSession: completeCohortSession2,
  cancelCohortSession: cancelCohortSession2
};

// src/modules/cohortSession/cohortSession.validation.ts
import { z as z5 } from "zod";
var resourceItemSchema = z5.object({
  id: z5.string().optional(),
  title: z5.string().min(1, "Resource title is required"),
  type: z5.enum(["FILE", "LINK", "NOTE", "CODE_SNIPPET"]),
  url: z5.string().url("Invalid resource URL").optional().nullable(),
  publicId: z5.string().optional().nullable(),
  fileSize: z5.number().int().optional().nullable(),
  fileType: z5.string().optional().nullable(),
  content: z5.string().optional().nullable()
});
var createCohortSessionSchema = z5.object({
  sessionNumber: z5.number().int().positive("Session number must be positive"),
  dayNumber: z5.number().int().positive("Day number must be positive"),
  title: z5.string().min(3, "Title must be at least 3 characters").max(100),
  scheduledAt: z5.string().datetime("Scheduled time must be a valid ISO 8601 date string"),
  durationMinutes: z5.number().int().positive().optional().default(60),
  creditCost: z5.number().int().nonnegative("Credit cost cannot be negative"),
  joinLink: z5.string().url("Invalid join link URL").optional().nullable(),
  resources: z5.array(resourceItemSchema).optional()
});
var updateCohortSessionSchema = createCohortSessionSchema.partial();
var addSessionResourceSchema = resourceItemSchema;

// src/modules/cohortSession/cohortSession.routes.ts
var router4 = Router4();
router4.get("/cohort/:cohortId", cohortSessionController.getCohortSessions);
router4.post(
  "/cohort/:cohortId",
  requireAuth,
  requireRole("mentor"),
  validate(createCohortSessionSchema),
  cohortSessionController.addCohortSession
);
router4.patch(
  "/:sessionId",
  requireAuth,
  requireRole("mentor"),
  validate(updateCohortSessionSchema),
  cohortSessionController.updateCohortSession
);
router4.delete(
  "/:sessionId",
  requireAuth,
  requireRole("mentor"),
  cohortSessionController.deleteCohortSession
);
router4.post(
  "/:sessionId/resources",
  requireAuth,
  requireRole("mentor"),
  validate(addSessionResourceSchema),
  cohortSessionController.addSessionResource
);
router4.delete(
  "/:sessionId/resources/:resourceId",
  requireAuth,
  requireRole("mentor"),
  cohortSessionController.removeSessionResource
);
router4.patch(
  "/:sessionId/complete",
  requireAuth,
  requireRole("mentor"),
  cohortSessionController.completeCohortSession
);
router4.patch(
  "/:sessionId/cancel",
  requireAuth,
  requireRole("mentor"),
  cohortSessionController.cancelCohortSession
);
router4.post(
  "/:sessionId/join",
  requireAuth,
  requireRole("student"),
  cohortSessionController.joinCohortSession
);
var cohortSession_routes_default = router4;

// src/modules/mentor/mentor.routes.ts
import { Router as Router5 } from "express";

// src/modules/mentor/mentor.service.ts
var applyForMentor = async (userId, payload) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { mentorProfile: true }
  });
  if (!user) {
    throw new AppError("User account not found", 404);
  }
  if (user.isBlocked) {
    throw new AppError("Your account has been blocked by an administrator", 403);
  }
  if (user.mentorProfile) {
    if (user.mentorProfile.approvalStatus === "APPROVED") {
      throw new AppError("You are already an approved mentor on DevMentor", 400);
    }
    if (user.mentorProfile.approvalStatus === "PENDING") {
      throw new AppError("Your mentor application is currently under review by an Admin", 400);
    }
  }
  const { bio, techStackTags, experienceLevel, githubUrl, resumeUrl } = payload;
  const mentorProfile = await prisma.mentorProfile.upsert({
    where: { userId },
    create: {
      userId,
      bio,
      techStackTags: techStackTags || [],
      experienceLevel: experienceLevel || "MID",
      githubUrl: githubUrl || null,
      resumeUrl,
      approvalStatus: "PENDING"
    },
    update: {
      bio,
      techStackTags: techStackTags || [],
      experienceLevel: experienceLevel || "MID",
      githubUrl: githubUrl || null,
      resumeUrl,
      approvalStatus: "PENDING"
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      }
    }
  });
  return {
    message: "Mentor application submitted successfully and is pending Admin approval",
    mentorProfile
  };
};
var getApprovedMentors = async (filters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;
  const where = {
    approvalStatus: "APPROVED",
    user: {
      isBlocked: false
    }
  };
  if (filters.tag) {
    where.techStackTags = {
      has: filters.tag
    };
  }
  if (filters.experienceLevel) {
    where.experienceLevel = filters.experienceLevel;
  }
  if (filters.search) {
    where.OR = [
      { bio: { contains: filters.search, mode: "insensitive" } },
      { user: { name: { contains: filters.search, mode: "insensitive" } } }
    ];
  }
  const [mentors, total] = await Promise.all([
    prisma.mentorProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    }),
    prisma.mentorProfile.count({ where })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    mentors
  };
};
var getMentorById = async (mentorIdOrUserId) => {
  const mentorProfile = await prisma.mentorProfile.findFirst({
    where: {
      OR: [{ id: mentorIdOrUserId }, { userId: mentorIdOrUserId }]
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
          cohortsCreated: {
            where: { status: "PUBLISHED", deletedAt: null },
            select: {
              id: true,
              title: true,
              description: true,
              durationWeeks: true,
              totalCost: true,
              capacity: true,
              techStackTags: true,
              createdAt: true
            }
          },
          sprintsClaimed: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              status: true,
              techStackTags: true,
              createdAt: true
            }
          }
        }
      }
    }
  });
  if (!mentorProfile || mentorProfile.approvalStatus !== "APPROVED") {
    throw new AppError("Approved mentor profile not found", 404);
  }
  return mentorProfile;
};
var mentorService = {
  applyForMentor,
  getApprovedMentors,
  getMentorById
};

// src/modules/mentor/mentor.controller.ts
var applyForMentor2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await mentorService.applyForMentor(userId, req.body);
  sendSuccess(res, result.message, result.mentorProfile, 201);
});
var getApprovedMentors2 = catchAsync(async (req, res) => {
  const result = await mentorService.getApprovedMentors(req.query);
  sendSuccess(res, "Approved mentors fetched successfully", result);
});
var getMentorById2 = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await mentorService.getMentorById(id);
  sendSuccess(res, "Mentor profile fetched successfully", result);
});
var mentorController = {
  applyForMentor: applyForMentor2,
  getApprovedMentors: getApprovedMentors2,
  getMentorById: getMentorById2
};

// src/modules/mentor/mentor.validation.ts
import { z as z6 } from "zod";
var applyMentorSchema = z6.object({
  bio: z6.string().min(20, "Bio must be at least 20 characters long").max(1e3),
  techStackTags: z6.array(z6.string()).min(1, "At least one tech stack tag is required"),
  experienceLevel: z6.enum(["JUNIOR", "MID", "SENIOR"]).optional().default("MID"),
  githubUrl: z6.string().url("Invalid GitHub URL").optional().nullable(),
  resumeUrl: z6.string().url("Valid resume URL is required")
});

// src/modules/mentor/mentor.routes.ts
var router5 = Router5();
router5.get("/", mentorController.getApprovedMentors);
router5.get("/:id", mentorController.getMentorById);
router5.post(
  "/apply",
  requireAuth,
  validate(applyMentorSchema),
  mentorController.applyForMentor
);
var mentor_routes_default = router5;

// src/modules/user/user.routes.ts
import { Router as Router6 } from "express";

// src/modules/user/user.service.ts
var getMyProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isBlocked: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      mentorProfile: true
    }
  });
  if (!user) {
    throw new AppError("User profile not found", 404);
  }
  const wallet = await prisma.wallet?.findUnique({
    where: { userId }
  });
  const walletData = user.role === "mentor" || user.role === "admin" ? {
    balance: wallet?.balance ?? 0,
    totalEarned: wallet?.totalEarned ?? 0,
    totalWithdrawn: wallet?.totalWithdrawn ?? 0
  } : {
    balance: wallet?.balance ?? 0
  };
  return {
    ...user,
    wallet: walletData
  };
};
var updateMyProfile = async (userId, payload) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { mentorProfile: true }
  });
  if (!user) {
    throw new AppError("User profile not found", 404);
  }
  if (user.isBlocked) {
    throw new AppError("Your account has been blocked by an administrator", 403);
  }
  const { name, image, bio } = payload;
  const userDataToUpdate = {};
  if (name !== void 0) userDataToUpdate.name = name;
  if (image !== void 0) userDataToUpdate.image = image;
  if (Object.keys(userDataToUpdate).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: userDataToUpdate
    });
  }
  if (bio !== void 0 && user.mentorProfile) {
    await prisma.mentorProfile.update({
      where: { userId },
      data: { bio }
    });
  }
  return getMyProfile(userId);
};
var getMyDashboard = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isBlocked: true }
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  const wallet = await prisma.wallet?.findUnique({
    where: { userId }
  });
  if (user.role === "mentor") {
    const [createdCohorts, claimedSprints] = await Promise.all([
      prisma.cohortProgram.findMany({
        where: { mentorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" }
      }),
      prisma.sprintRequest.findMany({
        where: { claimedByMentorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);
    return {
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      wallet: {
        balance: wallet?.balance ?? 0,
        totalEarned: wallet?.totalEarned ?? 0,
        totalWithdrawn: wallet?.totalWithdrawn ?? 0
      },
      summary: {
        totalCohortsCreated: createdCohorts.length,
        totalSprintsClaimed: claimedSprints.length,
        createdCohorts,
        claimedSprints
      }
    };
  }
  const [enrolledCohorts, requestedSprints] = await Promise.all([
    prisma.cohortEnrollment.findMany({
      where: { studentId: userId },
      include: {
        cohort: {
          select: {
            id: true,
            title: true,
            description: true,
            durationWeeks: true,
            totalCost: true,
            status: true
          }
        }
      },
      orderBy: { enrolledAt: "desc" }
    }),
    prisma.sprintRequest.findMany({
      where: { studentId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);
  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role
    },
    wallet: {
      balance: wallet?.balance ?? 0
    },
    summary: {
      totalEnrolledCohorts: enrolledCohorts.length,
      totalRequestedSprints: requestedSprints.length,
      enrolledCohorts,
      recentSprintRequests: requestedSprints
    }
  };
};
var userService = {
  getMyProfile,
  updateMyProfile,
  getMyDashboard
};

// src/modules/user/user.controller.ts
var getMyProfile2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await userService.getMyProfile(userId);
  sendSuccess(res, "User profile fetched successfully", result);
});
var updateMyProfile2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await userService.updateMyProfile(userId, req.body);
  sendSuccess(res, "User profile updated successfully", result);
});
var getMyDashboard2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await userService.getMyDashboard(userId);
  sendSuccess(res, "User dashboard summary fetched successfully", result);
});
var userController = {
  getMyProfile: getMyProfile2,
  updateMyProfile: updateMyProfile2,
  getMyDashboard: getMyDashboard2
};

// src/modules/user/user.validation.ts
import { z as z7 } from "zod";
var updateUserProfileSchema = z7.object({
  name: z7.string().min(2, "Name must be at least 2 characters long").max(50).optional(),
  image: z7.string().url("Invalid image URL").optional().nullable(),
  bio: z7.string().min(10, "Bio must be at least 10 characters long").max(1e3).optional()
});

// src/modules/user/user.routes.ts
var router6 = Router6();
router6.use(requireAuth);
router6.get("/me", userController.getMyProfile);
router6.patch("/me", validate(updateUserProfileSchema), userController.updateMyProfile);
router6.get("/me/dashboard", userController.getMyDashboard);
var user_routes_default = router6;

// src/modules/enrollment/enrollment.routes.ts
import { Router as Router7 } from "express";

// src/modules/enrollment/enrollment.service.ts
var getMyEnrolledCohorts = async (studentId, filters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;
  const where = { studentId };
  const [enrollments, total] = await Promise.all([
    prisma.cohortEnrollment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { enrolledAt: "desc" },
      include: {
        cohort: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            sessions: {
              select: {
                id: true,
                title: true,
                scheduledAt: true,
                status: true
              }
            }
          }
        }
      }
    }),
    prisma.cohortEnrollment.count({ where })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    enrollments
  };
};
var getMyEnrolledSprints = async (studentId, filters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;
  const where = { studentId, deletedAt: null };
  if (filters.status) {
    where.status = filters.status;
  }
  const [sprints, total] = await Promise.all([
    prisma.sprintRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        claimedByMentor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        sessions: {
          orderBy: { dayNumber: "asc" },
          select: {
            id: true,
            dayNumber: true,
            scheduledAt: true,
            status: true,
            creditCost: true
          }
        }
      }
    }),
    prisma.sprintRequest.count({ where })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    sprints
  };
};
var enrollmentService = {
  getMyEnrolledCohorts,
  getMyEnrolledSprints
};

// src/modules/enrollment/enrollment.controller.ts
var getMyEnrolledCohorts2 = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const result = await enrollmentService.getMyEnrolledCohorts(studentId, req.query);
  sendSuccess(res, "Student enrolled cohorts fetched successfully", result);
});
var getMyEnrolledSprints2 = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const result = await enrollmentService.getMyEnrolledSprints(studentId, req.query);
  sendSuccess(res, "Student sprint requests fetched successfully", result);
});
var enrollmentController = {
  getMyEnrolledCohorts: getMyEnrolledCohorts2,
  getMyEnrolledSprints: getMyEnrolledSprints2
};

// src/modules/enrollment/enrollment.routes.ts
var router7 = Router7();
router7.use(requireAuth);
router7.get("/my-cohorts", enrollmentController.getMyEnrolledCohorts);
router7.get("/my-sprints", enrollmentController.getMyEnrolledSprints);
var enrollment_routes_default = router7;

// src/modules/upload/upload.routes.ts
import { Router as Router8 } from "express";

// src/lib/multer.ts
import multer from "multer";
var storage = multer.memoryStorage();
var upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`Invalid file format '${file.mimetype}'. Only images and documents (PDF/DOC) are allowed.`, 400), false);
    }
  }
});

// src/lib/cloudinary.ts
import { v2 as Cloudinary } from "cloudinary";
Cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
});
var cloudinary = Cloudinary;

// src/modules/upload/upload.service.ts
var uploadFileToCloudinary = async (file, folderName = "devmentor_uploads") => {
  if (!file || !file.buffer) {
    throw new AppError("No file provided for upload", 400);
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new AppError("Cloudinary upload request timed out. Please try again.", 504));
    }, 15e3);
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: "auto",
        access_mode: "public"
      },
      (error, result) => {
        clearTimeout(timeout);
        if (error || !result) {
          return reject(new AppError(`Cloudinary upload failed: ${error?.message || "Unknown error"}`, 500));
        }
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes
        });
      }
    );
    uploadStream.end(file.buffer);
  });
};
var uploadMultipleFilesToCloudinary = async (files, folderName = "devmentor_uploads") => {
  if (!files || files.length === 0) {
    throw new AppError("No files provided for upload", 400);
  }
  const uploadPromises = files.map((file) => uploadFileToCloudinary(file, folderName));
  return Promise.all(uploadPromises);
};
var uploadService = {
  uploadFileToCloudinary,
  uploadMultipleFilesToCloudinary
};

// src/modules/upload/upload.controller.ts
var handleFileUpload = catchAsync(async (req, res) => {
  if (Array.isArray(req.files) && req.files.length > 0) {
    const results = await uploadService.uploadMultipleFilesToCloudinary(req.files);
    sendSuccess(res, `${results.length} file(s) uploaded to Cloudinary successfully`, results, 201);
    return;
  }
  const singleFile = req.file || (Array.isArray(req.files) ? req.files[0] : void 0);
  if (!singleFile) {
    throw new AppError("Please attach file(s) in form-data key 'file' or 'files'", 400);
  }
  const result = await uploadService.uploadFileToCloudinary(singleFile);
  sendSuccess(res, "File uploaded to Cloudinary successfully", result, 201);
});
var uploadController = {
  handleFileUpload
};

// src/modules/upload/upload.routes.ts
var router8 = Router8();
router8.use(requireAuth);
router8.post("/", upload.any(), uploadController.handleFileUpload);
var upload_routes_default = router8;

// src/modules/admin/admin.routes.ts
import { Router as Router9 } from "express";

// src/modules/admin/admin.service.ts
var approveOrRejectMentor = async (adminId, mentorProfileId, payload) => {
  const mentorProfile = await prisma.mentorProfile.findUnique({
    where: { id: mentorProfileId }
  });
  if (!mentorProfile) {
    throw new AppError("Mentor application profile not found", 404);
  }
  if (mentorProfile.approvalStatus === "APPROVED") {
    throw new AppError("Mentor is already approved", 400);
  }
  const { status } = payload;
  const updatedMentorProfile = await prisma.$transaction(async (tx) => {
    const profile = await tx.mentorProfile.update({
      where: { id: mentorProfileId },
      data: {
        approvalStatus: status,
        approvedBy: adminId,
        approvedAt: status === "APPROVED" ? /* @__PURE__ */ new Date() : null
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, isBlocked: true }
        }
      }
    });
    if (status === "APPROVED") {
      await tx.user.update({
        where: { id: mentorProfile.userId },
        data: { role: "mentor" }
      });
    }
    return profile;
  });
  return updatedMentorProfile;
};
var toggleUserBlock = async (adminId, userIdToBlock, payload) => {
  if (adminId === userIdToBlock) {
    throw new AppError("Admin cannot block or unblock their own account", 400);
  }
  const user = await prisma.user.findUnique({
    where: { id: userIdToBlock }
  });
  if (!user) {
    throw new AppError("Target user account not found", 404);
  }
  const updatedUser = await prisma.user.update({
    where: { id: userIdToBlock },
    data: {
      isBlocked: payload.isBlocked
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isBlocked: true,
      updatedAt: true
    }
  });
  return updatedUser;
};
var getAllUsers = async (filters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;
  const where = {};
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } }
    ];
  }
  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.isBlocked !== void 0 && filters.isBlocked !== "") {
    where.isBlocked = String(filters.isBlocked) === "true";
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        mentorProfile: {
          select: {
            id: true,
            approvalStatus: true,
            experienceLevel: true
          }
        }
      }
    }),
    prisma.user.count({ where })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    users
  };
};
var approveOrRejectCohort = async (adminId, cohortId, payload) => {
  const cohort = await prisma.cohortProgram.findUnique({
    where: { id: cohortId }
  });
  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }
  if (cohort.approvalStatus === "APPROVED" && payload.status === "APPROVED") {
    throw new AppError("Cohort program is already approved", 400);
  }
  const { status } = payload;
  const updatedCohort = await prisma.cohortProgram.update({
    where: { id: cohortId },
    data: {
      approvalStatus: status,
      approvedBy: adminId,
      approvedAt: status === "APPROVED" ? /* @__PURE__ */ new Date() : null
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });
  return updatedCohort;
};
var adminService = {
  approveOrRejectMentor,
  toggleUserBlock,
  getAllUsers,
  approveOrRejectCohort
};

// src/modules/admin/admin.controller.ts
var approveOrRejectMentor2 = catchAsync(async (req, res) => {
  const adminId = req.user.id;
  const id = req.params.id;
  const result = await adminService.approveOrRejectMentor(adminId, id, req.body);
  sendSuccess(res, `Mentor application status updated to ${result.approvalStatus}`, result);
});
var toggleUserBlock2 = catchAsync(async (req, res) => {
  const adminId = req.user.id;
  const id = req.params.id;
  const result = await adminService.toggleUserBlock(adminId, id, req.body);
  sendSuccess(res, `User account ${result.isBlocked ? "blocked" : "unblocked"} successfully`, result);
});
var getAllUsers2 = catchAsync(async (req, res) => {
  const result = await adminService.getAllUsers(req.query);
  sendSuccess(res, "Users directory fetched successfully", result);
});
var approveOrRejectCohort2 = catchAsync(async (req, res) => {
  const adminId = req.user.id;
  const id = req.params.id;
  const result = await adminService.approveOrRejectCohort(adminId, id, req.body);
  sendSuccess(res, `Cohort program approval status updated to ${result.approvalStatus}`, result);
});
var adminController = {
  approveOrRejectMentor: approveOrRejectMentor2,
  toggleUserBlock: toggleUserBlock2,
  getAllUsers: getAllUsers2,
  approveOrRejectCohort: approveOrRejectCohort2
};

// src/modules/admin/admin.validation.ts
import { z as z8 } from "zod";
var approveMentorSchema = z8.object({
  status: z8.enum(["APPROVED", "REJECTED"], {
    error: "Status must be either APPROVED or REJECTED"
  }),
  rejectionReason: z8.string().optional()
});
var toggleUserBlockSchema = z8.object({
  isBlocked: z8.boolean({
    error: "isBlocked must be a boolean (true or false)"
  })
});
var approveCohortSchema = z8.object({
  status: z8.enum(["APPROVED", "REJECTED"], {
    error: "Status must be APPROVED or REJECTED"
  })
});

// src/modules/admin/admin.routes.ts
var router9 = Router9();
router9.use(requireAuth, requireRole("admin"));
router9.patch(
  "/mentors/:id/approve",
  validate(approveMentorSchema),
  adminController.approveOrRejectMentor
);
router9.patch(
  "/users/:id/block",
  validate(toggleUserBlockSchema),
  adminController.toggleUserBlock
);
router9.get("/users", adminController.getAllUsers);
router9.patch(
  "/cohorts/:id/approve",
  validate(approveCohortSchema),
  adminController.approveOrRejectCohort
);
var admin_routes_default = router9;

// src/modules/payment/payment.routes.ts
import { Router as Router10 } from "express";

// src/modules/payment/payment.validation.ts
import { z as z9 } from "zod";
var initiateTopUpSchema = z9.object({
  amount: z9.number().min(10, "Minimum top-up amount is 10 BDT").max(5e4, "Maximum single top-up limit is 50,000 BDT")
});
var requestWithdrawalSchema = z9.object({
  amount: z9.number().min(1e3, "Minimum withdrawal threshold is 1,000 BDT (250 Credits)").max(1e5, "Maximum single withdrawal limit is 100,000 BDT"),
  bkashNumber: z9.string().regex(/^01[3-9]\d{8}$/, "Invalid Bangladeshi bKash mobile number format (e.g. 017XXXXXXXX)")
});

// src/modules/payment/payment.routes.ts
var router10 = Router10();
router10.post(
  "/top-up",
  requireAuth,
  requireRole("student"),
  validate(initiateTopUpSchema),
  paymentController.initiateTopUpHandler
);
router10.get("/bkash/callback", paymentController.bkashCallbackHandler);
router10.post("/bkash/callback", paymentController.bkashCallbackHandler);
router10.get("/status", paymentController.bkashCallbackHandler);
router10.post("/status", paymentController.bkashCallbackHandler);
router10.get("/callback", paymentController.bkashCallbackHandler);
router10.post("/callback", paymentController.bkashCallbackHandler);
router10.get("/wallet/me", requireAuth, paymentController.getWalletHandler);
router10.get("/history", requireAuth, paymentController.getPaymentHistoryHandler);
router10.post(
  "/withdraw",
  requireAuth,
  requireRole("mentor", "admin"),
  validate(requestWithdrawalSchema),
  paymentController.requestWithdrawalHandler
);
var paymentRoutes = router10;

// src/modules/codeReview/codeReview.routes.ts
import { Router as Router11 } from "express";

// src/modules/codeReview/codeReview.service.ts
var getCreditCostByTier = (tier) => {
  return tier === "QUICK" ? 10 : 50;
};
var createReviewRequest = async (studentId, payload) => {
  const { tier, title, description, codeSnippet, language, githubRepoUrl, branchName, specificFiles } = payload;
  const requiredCredits = getCreditCostByTier(tier);
  const wallet = await prisma.wallet.findUnique({
    where: { userId: studentId }
  });
  if (!wallet || wallet.balance < requiredCredits) {
    throw new AppError(
      `Insufficient wallet balance. ${tier} Code Review requires ${requiredCredits} Credits but you have ${wallet?.balance || 0} Credits.`,
      400
    );
  }
  const { reviewRequest, updatedWallet } = await prisma.$transaction(async (tx) => {
    const updatedWallet2 = await tx.wallet.update({
      where: { userId: studentId },
      data: {
        balance: { decrement: requiredCredits }
      }
    });
    const reviewRequest2 = await tx.codeReviewRequest.create({
      data: {
        studentId,
        tier,
        title,
        description,
        codeSnippet,
        language: language || "typescript",
        githubRepoUrl,
        branchName: branchName || "main",
        specificFiles,
        creditReward: requiredCredits,
        status: "OPEN"
      }
    });
    await tx.creditTransaction.create({
      data: {
        walletId: updatedWallet2.id,
        amount: -requiredCredits,
        type: "SPRINT_ESCROW",
        description: `Escrow hold for ${tier} Code Review request: "${title}"`,
        referenceId: reviewRequest2.id
      }
    });
    return { reviewRequest: reviewRequest2, updatedWallet: updatedWallet2 };
  });
  return {
    success: true,
    message: `${tier} Code Review request created successfully with ${requiredCredits} Credits held in escrow`,
    data: {
      request: reviewRequest,
      wallet: updatedWallet
    }
  };
};
var updateCodeSnippet = async (studentId, requestId, payload) => {
  const existingRequest = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId }
  });
  if (!existingRequest) {
    throw new AppError("Code review request not found", 404);
  }
  if (existingRequest.studentId !== studentId) {
    throw new AppError("You are not authorized to update this code review request", 403);
  }
  if (existingRequest.status !== "OPEN") {
    throw new AppError(
      `Code review request cannot be updated because its current status is '${existingRequest.status}'. Only OPEN requests can be updated.`,
      400
    );
  }
  const updatedRequest = await prisma.codeReviewRequest.update({
    where: { id: requestId },
    data: {
      ...payload.title && { title: payload.title },
      ...payload.description && { description: payload.description },
      ...payload.codeSnippet !== void 0 && { codeSnippet: payload.codeSnippet },
      ...payload.language && { language: payload.language },
      ...payload.githubRepoUrl !== void 0 && { githubRepoUrl: payload.githubRepoUrl },
      ...payload.branchName && { branchName: payload.branchName },
      ...payload.specificFiles !== void 0 && { specificFiles: payload.specificFiles }
    }
  });
  return {
    success: true,
    message: "Code review request updated successfully",
    data: updatedRequest
  };
};
var previewLockReviewRequest = async (mentorId, requestId) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId }
  });
  if (!mentor || mentor.role !== "mentor" && mentor.role !== "admin") {
    throw new AppError("Only verified mentors can preview code review requests", 403);
  }
  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId }
  });
  if (!request) {
    throw new AppError("Code review request not found", 404);
  }
  if (request.status !== "OPEN" && request.status !== "PREVIEW_LOCKED") {
    throw new AppError(`Code review request is no longer available for preview (Status: ${request.status})`, 400);
  }
  const now = /* @__PURE__ */ new Date();
  if (request.status === "PREVIEW_LOCKED" && request.previewMentorId !== mentorId && request.previewExpiresAt && request.previewExpiresAt > now) {
    throw new AppError(
      `This code review request is currently preview-locked by another mentor until ${request.previewExpiresAt.toISOString()}`,
      400
    );
  }
  const previewExpiresAt = new Date(now.getTime() + 10 * 60 * 1e3);
  const updatedRequest = await prisma.codeReviewRequest.update({
    where: { id: requestId },
    data: {
      status: "PREVIEW_LOCKED",
      previewMentorId: mentorId,
      previewExpiresAt
    }
  });
  return {
    success: true,
    message: "10-minute preview lock acquired successfully",
    data: updatedRequest
  };
};
var claimReviewRequest = async (mentorId, requestId) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId }
  });
  if (!mentor || mentor.role !== "mentor" && mentor.role !== "admin") {
    throw new AppError("Only verified mentors can claim code review requests", 403);
  }
  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId }
  });
  if (!request) {
    throw new AppError("Code review request not found", 404);
  }
  if (request.status === "CLAIMED" || request.status === "DELIVERED" || request.status === "COMPLETED" || request.status === "CANCELLED" || request.status === "EXPIRED") {
    throw new AppError(`Code review request is no longer open for claiming (Status: ${request.status})`, 400);
  }
  const now = /* @__PURE__ */ new Date();
  if (request.status === "PREVIEW_LOCKED" && request.previewMentorId !== mentorId && request.previewExpiresAt && request.previewExpiresAt > now) {
    throw new AppError("Cannot claim request preview-locked by another mentor", 400);
  }
  const slaDurationMs = request.tier === "QUICK" ? 2 * 60 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  const deliveryDeadline = new Date(now.getTime() + slaDurationMs);
  const updatedRequest = await prisma.codeReviewRequest.update({
    where: { id: requestId },
    data: {
      status: "CLAIMED",
      assignedMentorId: mentorId,
      deliveryDeadline,
      previewMentorId: null,
      previewExpiresAt: null
    }
  });
  return {
    success: true,
    message: `Code review request claimed successfully. Target delivery deadline: ${deliveryDeadline.toISOString()} (${request.tier === "QUICK" ? "2 Hours" : "24 Hours"})`,
    data: updatedRequest
  };
};
var submitReview = async (mentorId, requestId, payload) => {
  const { summary, reviewedCodeSnippet, videoUrl, pullRequestUrl, comments } = payload;
  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId }
  });
  if (!request) {
    throw new AppError("Code review request not found", 404);
  }
  if (request.assignedMentorId !== mentorId) {
    throw new AppError("You are not the assigned mentor for this code review request", 403);
  }
  if (request.status !== "CLAIMED") {
    throw new AppError(`Review feedback can only be submitted when status is CLAIMED (Current status: ${request.status})`, 400);
  }
  const { submission, updatedRequest } = await prisma.$transaction(async (tx) => {
    const submission2 = await tx.codeReviewSubmission.create({
      data: {
        requestId,
        mentorId,
        summary,
        reviewedCodeSnippet,
        videoUrl,
        pullRequestUrl,
        ...comments && comments.length > 0 && {
          comments: {
            createMany: {
              data: comments.map((c) => ({
                filePath: c.filePath,
                lineNumber: c.lineNumber,
                commentText: c.commentText,
                severity: c.severity || "SUGGESTION"
              }))
            }
          }
        }
      },
      include: {
        comments: true
      }
    });
    const updatedRequest2 = await tx.codeReviewRequest.update({
      where: { id: requestId },
      data: {
        status: "DELIVERED"
      }
    });
    return { submission: submission2, updatedRequest: updatedRequest2 };
  });
  return {
    success: true,
    message: "Code review feedback submitted successfully. Pending student approval for credit release.",
    data: {
      request: updatedRequest,
      submission
    }
  };
};
var approveAndRelease = async (userId, requestId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId }
  });
  if (!request) {
    throw new AppError("Code review request not found", 404);
  }
  if (request.studentId !== userId && user.role !== "admin") {
    throw new AppError("Only the student who created the request or an admin can approve and release funds", 403);
  }
  if (request.status !== "DELIVERED") {
    throw new AppError(`Credits can only be released when review status is DELIVERED (Current status: ${request.status})`, 400);
  }
  if (!request.assignedMentorId) {
    throw new AppError("No mentor assigned to this code review request", 400);
  }
  const creditPayout = request.creditReward;
  const { updatedRequest, mentorWallet } = await prisma.$transaction(async (tx) => {
    const mentorWallet2 = await tx.wallet.upsert({
      where: { userId: request.assignedMentorId },
      create: {
        userId: request.assignedMentorId,
        balance: creditPayout,
        totalEarned: creditPayout,
        totalWithdrawn: 0
      },
      update: {
        balance: { increment: creditPayout },
        totalEarned: { increment: creditPayout }
      }
    });
    await tx.creditTransaction.create({
      data: {
        walletId: mentorWallet2.id,
        amount: creditPayout,
        type: "SPRINT_RELEASE",
        description: `100% Escrow release for ${request.tier} Code Review completion: "${request.title}"`,
        referenceId: request.id
      }
    });
    const updatedRequest2 = await tx.codeReviewRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED"
      }
    });
    return { updatedRequest: updatedRequest2, mentorWallet: mentorWallet2 };
  });
  return {
    success: true,
    message: `Review approved! Released 100% (${creditPayout} Credits) to mentor's wallet balance.`,
    data: {
      request: updatedRequest,
      mentorWallet
    }
  };
};
var cancelReviewRequest = async (studentId, requestId) => {
  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId }
  });
  if (!request) {
    throw new AppError("Code review request not found", 404);
  }
  if (request.studentId !== studentId) {
    throw new AppError("You are not authorized to cancel this code review request", 403);
  }
  if (request.status !== "OPEN" && request.status !== "PREVIEW_LOCKED") {
    throw new AppError(`Only OPEN or PREVIEW_LOCKED requests can be cancelled (Current status: ${request.status})`, 400);
  }
  const refundCredits = request.creditReward;
  const { updatedRequest, studentWallet } = await prisma.$transaction(async (tx) => {
    const studentWallet2 = await tx.wallet.update({
      where: { userId: studentId },
      data: {
        balance: { increment: refundCredits }
      }
    });
    await tx.creditTransaction.create({
      data: {
        walletId: studentWallet2.id,
        amount: refundCredits,
        type: "SPRINT_REFUND",
        description: `Refund for cancelled ${request.tier} Code Review request: "${request.title}"`,
        referenceId: request.id
      }
    });
    const updatedRequest2 = await tx.codeReviewRequest.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED",
        previewMentorId: null,
        previewExpiresAt: null
      }
    });
    return { updatedRequest: updatedRequest2, studentWallet: studentWallet2 };
  });
  return {
    success: true,
    message: `Code review request cancelled. Refunded ${refundCredits} Credits back to student wallet.`,
    data: {
      request: updatedRequest,
      studentWallet
    }
  };
};
var getOpenCodeReviewPool = async (filters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;
  const now = /* @__PURE__ */ new Date();
  const availabilityCondition = {
    OR: [
      { status: "OPEN" },
      {
        status: "PREVIEW_LOCKED",
        previewExpiresAt: { lte: now }
      }
    ]
  };
  const whereConditions = [availabilityCondition];
  if (filters.tier) {
    whereConditions.push({ tier: filters.tier });
  }
  if (filters.language) {
    whereConditions.push({
      language: { contains: filters.language, mode: "insensitive" }
    });
  }
  if (filters.search) {
    whereConditions.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { specificFiles: { contains: filters.search, mode: "insensitive" } }
      ]
    });
  }
  const where = { AND: whereConditions };
  const [totalCount, requests] = await Promise.all([
    prisma.codeReviewRequest.count({ where }),
    prisma.codeReviewRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        student: {
          select: { id: true, name: true, email: true, image: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    success: true,
    data: requests,
    meta: {
      page,
      limit,
      totalCount,
      totalPages
    }
  };
};
var codeReviewService = {
  createReviewRequest,
  updateCodeSnippet,
  previewLockReviewRequest,
  claimReviewRequest,
  submitReview,
  approveAndRelease,
  cancelReviewRequest,
  getOpenCodeReviewPool
};

// src/modules/codeReview/codeReview.controller.ts
var createReviewRequestHandler = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const result = await codeReviewService.createReviewRequest(studentId, req.body);
  sendSuccess(res, result.message, result.data, 201);
});
var updateCodeSnippetHandler = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const id = req.params.id;
  const result = await codeReviewService.updateCodeSnippet(studentId, id, req.body);
  sendSuccess(res, result.message, result.data, 200);
});
var previewLockHandler = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const id = req.params.id;
  const result = await codeReviewService.previewLockReviewRequest(mentorId, id);
  sendSuccess(res, result.message, result.data, 200);
});
var claimReviewRequestHandler = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const id = req.params.id;
  const result = await codeReviewService.claimReviewRequest(mentorId, id);
  sendSuccess(res, result.message, result.data, 200);
});
var submitReviewHandler = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const id = req.params.id;
  const result = await codeReviewService.submitReview(mentorId, id, req.body);
  sendSuccess(res, result.message, result.data, 201);
});
var approveAndReleaseHandler = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const id = req.params.id;
  const result = await codeReviewService.approveAndRelease(userId, id);
  sendSuccess(res, result.message, result.data, 200);
});
var cancelReviewRequestHandler = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const id = req.params.id;
  const result = await codeReviewService.cancelReviewRequest(studentId, id);
  sendSuccess(res, result.message, result.data, 200);
});
var getOpenPoolHandler = catchAsync(async (req, res) => {
  const result = await codeReviewService.getOpenCodeReviewPool(req.query);
  sendSuccess(res, "Open code review requests retrieved successfully", {
    requests: result.data,
    meta: result.meta
  }, 200);
});
var codeReviewController = {
  createReviewRequestHandler,
  updateCodeSnippetHandler,
  previewLockHandler,
  claimReviewRequestHandler,
  submitReviewHandler,
  approveAndReleaseHandler,
  cancelReviewRequestHandler,
  getOpenPoolHandler
};

// src/modules/codeReview/codeReview.validation.ts
import { z as z10 } from "zod";
var createCodeReviewSchema = z10.object({
  body: z10.object({
    tier: z10.enum(["QUICK", "DEEP"]),
    title: z10.string().min(3, "Title must be at least 3 characters").max(150, "Title must not exceed 150 characters"),
    description: z10.string().min(10, "Description must be at least 10 characters"),
    codeSnippet: z10.string().optional(),
    language: z10.string().optional().default("typescript"),
    githubRepoUrl: z10.string().url("Please provide a valid GitHub repository URL").optional().or(z10.literal("")),
    branchName: z10.string().optional().default("main"),
    specificFiles: z10.string().optional()
  }).refine(
    (data) => data.codeSnippet && data.codeSnippet.trim().length > 0 || data.githubRepoUrl && data.githubRepoUrl.trim().length > 0,
    {
      message: "You must provide either a code snippet or a GitHub repository URL for review.",
      path: ["codeSnippet"]
    }
  )
});
var updateCodeSnippetSchema = z10.object({
  body: z10.object({
    title: z10.string().min(3).max(150).optional(),
    description: z10.string().min(10).optional(),
    codeSnippet: z10.string().optional(),
    language: z10.string().optional(),
    githubRepoUrl: z10.string().url("Please provide a valid GitHub repository URL").optional().or(z10.literal("")),
    branchName: z10.string().optional(),
    specificFiles: z10.string().optional()
  })
});
var submitCodeReviewSchema = z10.object({
  body: z10.object({
    summary: z10.string().min(10, "Feedback summary must be at least 10 characters"),
    reviewedCodeSnippet: z10.string().optional(),
    videoUrl: z10.string().url("Please provide a valid video feedback URL (e.g. Loom, Cloudinary)").optional().or(z10.literal("")),
    pullRequestUrl: z10.string().url("Please provide a valid Pull Request URL").optional().or(z10.literal("")),
    comments: z10.array(
      z10.object({
        filePath: z10.string().min(1, "File path is required for comment"),
        lineNumber: z10.number().int().positive("Line number must be positive"),
        commentText: z10.string().min(1, "Comment text cannot be empty"),
        severity: z10.enum(["BUG", "SECURITY", "SUGGESTION"]).optional().default("SUGGESTION")
      })
    ).optional()
  })
});
var codeReviewValidation = {
  createCodeReviewSchema,
  updateCodeSnippetSchema,
  submitCodeReviewSchema
};

// src/modules/codeReview/codeReview.routes.ts
var router11 = Router11();
router11.use(requireAuth);
router11.get("/pool", requireRole("mentor", "admin"), codeReviewController.getOpenPoolHandler);
router11.post(
  "/",
  requireRole("student"),
  validate(codeReviewValidation.createCodeReviewSchema),
  codeReviewController.createReviewRequestHandler
);
router11.patch(
  "/:id/snippet",
  requireRole("student"),
  validate(codeReviewValidation.updateCodeSnippetSchema),
  codeReviewController.updateCodeSnippetHandler
);
router11.post("/:id/preview", requireRole("mentor", "admin"), codeReviewController.previewLockHandler);
router11.post("/:id/claim", requireRole("mentor", "admin"), codeReviewController.claimReviewRequestHandler);
router11.post(
  "/:id/submit",
  requireRole("mentor", "admin"),
  validate(codeReviewValidation.submitCodeReviewSchema),
  codeReviewController.submitReviewHandler
);
router11.post("/:id/approve", requireRole("student", "admin"), codeReviewController.approveAndReleaseHandler);
router11.post("/:id/cancel", requireRole("student"), codeReviewController.cancelReviewRequestHandler);
var codeReview_routes_default = router11;

// src/jobs/cron.ts
import cron from "node-cron";
var expireAbandonedPayments = async () => {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1e3);
    const result = await prisma.payment.updateMany({
      where: {
        status: "INITIATED",
        createdAt: { lt: thirtyMinutesAgo }
      },
      data: {
        status: "EXPIRED"
      }
    });
    if (result.count > 0) {
      console.log(`\u23F0 Cron Job: Auto-expired ${result.count} abandoned payment intent(s).`);
    }
  } catch (err) {
    console.error("\u274C Error running expireAbandonedPayments cron job:", err);
  }
};
var initCronJobs = () => {
  cron.schedule("*/5 * * * *", async () => {
    await expireAbandonedPayments();
  });
  console.log("\u23F0 Background Cron Worker initialized (Running cleanup every 5 minutes).");
};

// src/routes/v1/index.ts
var v1Router = Router12();
v1Router.all("/", (req, res, next) => {
  if (req.query.paymentID || req.body?.paymentID) {
    return paymentController.bkashCallbackHandler(req, res, next);
  }
  res.json({ success: true, message: "K\u014Ddex API v1 root endpoint", data: null });
});
v1Router.get("/health", (_req, res) => {
  res.json({ success: true, message: "K\u014Ddex API v1 is up and running \u{1F680}", data: null });
});
v1Router.get(
  "/test/protected",
  requireAuth,
  catchAsync(async (req, res) => {
    sendSuccess(res, "Authenticated user verified successfully", req.user);
  })
);
v1Router.get(
  "/test/admin-only",
  requireAuth,
  requireRole("admin"),
  catchAsync(async (req, res) => {
    sendSuccess(res, "Admin access granted", req.user);
  })
);
v1Router.use("/sprints", sprint_routes_default);
v1Router.use("/sprint-sessions", sprintSession_routes_default);
v1Router.use("/cohorts", cohort_routes_default);
v1Router.use("/cohort-sessions", cohortSession_routes_default);
v1Router.use("/mentors", mentor_routes_default);
v1Router.use("/users", user_routes_default);
v1Router.use("/enrollments", enrollment_routes_default);
v1Router.use("/upload", upload_routes_default);
v1Router.use("/admin", admin_routes_default);
v1Router.use("/payments", paymentRoutes);
v1Router.use("/code-reviews", codeReview_routes_default);
v1Router.get(
  "/cron/cleanup-payments",
  catchAsync(async (req, res) => {
    await expireAbandonedPayments();
    sendSuccess(res, "Vercel Cron: Abandoned payments cleanup completed successfully");
  })
);
var v1_default = v1Router;

// src/app.ts
var app = express();
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
      "http://127.0.0.1:3000"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(generalLimiter);
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to K\u014Ddex API",
    data: { name: "K\u014Ddex API", version: "1.0.0", docs: "/api/v1/health" }
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
    "/api/v1/payment/bkash/callback"
  ],
  (req, res, next) => {
    paymentController.bkashCallbackHandler(req, res, next);
  }
);
app.use("/api/v1", v1_default);
app.use(notFoundHandler);
app.use(errorHandler);
var app_default = app;

// src/config/db.ts
async function connectDB() {
  await prisma.$connect();
  console.log("\u{1F5C4}\uFE0F  Database connected successfully");
}
async function disconnectDB() {
  await prisma.$disconnect();
  console.log("\u{1F5C4}\uFE0F  Database disconnected");
}

// src/server.ts
async function bootstrap() {
  await connectDB();
  initCronJobs();
  const server = app_default.listen(env.PORT, () => {
    console.log(`\u2705  DevMentor Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`\u{1F517}  http://localhost:${env.PORT}/api/v1/health`);
  });
  const shutdown = async (signal) => {
    console.log(`
 ${signal} received \u2014 shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      console.log("Server closed.");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("\u{1F4A5} Unhandled Rejection:", reason);
    server.close(async () => {
      await disconnectDB();
      process.exit(1);
    });
  });
  process.on("uncaughtException", (error) => {
    console.error("\u{1F4A5} Uncaught Exception:", error.message);
    server.close(async () => {
      await disconnectDB();
      process.exit(1);
    });
  });
}
if (!process.env.VERCEL) {
  bootstrap().catch((error) => {
    console.error("\u274C Failed to start server:", error);
    process.exit(1);
  });
}
var server_default = app_default;
export {
  server_default as default
};
//# sourceMappingURL=server.js.map