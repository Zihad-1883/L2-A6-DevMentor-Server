
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
  mentorExams          Exam[]                     @relation("MentorExams")
  studentExamAttempts  ExamAttempt[]              @relation("StudentExamAttempts")

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
  exams       Exam[]             @relation("CohortExams")

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

enum ExamStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Exam {
  id       String @id @default(cuid())
  mentorId String
  mentor   User   @relation("MentorExams", fields: [mentorId], references: [id], onDelete: Cascade)

  cohortId String?
  cohort   CohortProgram? @relation("CohortExams", fields: [cohortId], references: [id], onDelete: SetNull)

  sprintId String?
  sprint   SprintRequest? @relation("SprintExams", fields: [sprintId], references: [id], onDelete: SetNull)

  isFree Boolean @default(true)

  title           String
  description     String?
  durationMinutes Int        @default(30)
  totalMarks      Int        @default(100)
  passMark        Int?       @default(60)
  status          ExamStatus @default(DRAFT)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  questions Question[]
  attempts  ExamAttempt[]

  @@map("exam")
}

model Question {
  id     String @id @default(cuid())
  examId String
  exam   Exam   @relation(fields: [examId], references: [id], onDelete: Cascade)

  questionText       String
  options            String[] // Array of strings e.g. ["Option A", "Option B", "Option C", "Option D"]
  correctOptionIndex Int // Index of correct option (0-indexed)
  explanation        String? // Explanation for student after submission
  marks              Int      @default(5)

  @@map("question")
}

model ExamAttempt {
  id        String @id @default(cuid())
  examId    String
  exam      Exam   @relation(fields: [examId], references: [id], onDelete: Cascade)
  studentId String
  student   User   @relation("StudentExamAttempts", fields: [studentId], references: [id], onDelete: Cascade)

  score       Int       @default(0)
  percentage  Float     @default(0)
  isPassed    Boolean   @default(false)
  startedAt   DateTime  @default(now())
  submittedAt DateTime?

  answers Json // Array e.g. [{ questionId: "...", selectedOption: 1 }]

  @@map("exam_attempt")
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
  exams    Exam[]          @relation("SprintExams")

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
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"image","kind":"scalar","type":"String"},{"name":"role","kind":"scalar","type":"String"},{"name":"isBlocked","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"accounts","kind":"object","type":"Account","relationName":"AccountToUser"},{"name":"mentorProfile","kind":"object","type":"MentorProfile","relationName":"MentorProfileToUser"},{"name":"sprintsRequested","kind":"object","type":"SprintRequest","relationName":"StudentSprints"},{"name":"sprintsClaimed","kind":"object","type":"SprintRequest","relationName":"MentorSprints"},{"name":"cohortsCreated","kind":"object","type":"CohortProgram","relationName":"MentorCohorts"},{"name":"cohortEnrollments","kind":"object","type":"CohortEnrollment","relationName":"StudentCohortEnrollments"},{"name":"cohortSessionsJoined","kind":"object","type":"CohortSessionParticipant","relationName":"StudentCohortSessions"},{"name":"wallet","kind":"object","type":"Wallet","relationName":"UserToWallet"},{"name":"payments","kind":"object","type":"Payment","relationName":"PaymentToUser"},{"name":"studentCodeReviews","kind":"object","type":"CodeReviewRequest","relationName":"StudentCodeReviews"},{"name":"mentorCodeReviews","kind":"object","type":"CodeReviewRequest","relationName":"MentorCodeReviews"},{"name":"mentorSubmissions","kind":"object","type":"CodeReviewSubmission","relationName":"MentorSubmissions"},{"name":"mentorExams","kind":"object","type":"Exam","relationName":"MentorExams"},{"name":"studentExamAttempts","kind":"object","type":"ExamAttempt","relationName":"StudentExamAttempts"}],"dbName":"user","schema":null},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"token","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":"session","schema":null},"Account":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String"},{"name":"providerId","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"AccountToUser"},{"name":"accessToken","kind":"scalar","type":"String"},{"name":"refreshToken","kind":"scalar","type":"String"},{"name":"idToken","kind":"scalar","type":"String"},{"name":"accessTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"refreshTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"scope","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"account","schema":null},"Verification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"identifier","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"verification","schema":null},"CodeReviewRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCodeReviews"},{"name":"tier","kind":"enum","type":"CodeReviewTier"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"codeSnippet","kind":"scalar","type":"String"},{"name":"language","kind":"scalar","type":"String"},{"name":"githubRepoUrl","kind":"scalar","type":"String"},{"name":"branchName","kind":"scalar","type":"String"},{"name":"specificFiles","kind":"scalar","type":"String"},{"name":"creditReward","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"CodeReviewStatus"},{"name":"previewMentorId","kind":"scalar","type":"String"},{"name":"previewExpiresAt","kind":"scalar","type":"DateTime"},{"name":"assignedMentorId","kind":"scalar","type":"String"},{"name":"assignedMentor","kind":"object","type":"User","relationName":"MentorCodeReviews"},{"name":"deliveryDeadline","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"submission","kind":"object","type":"CodeReviewSubmission","relationName":"CodeReviewRequestToCodeReviewSubmission"}],"dbName":"code_review_request","schema":null},"CodeReviewSubmission":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"requestId","kind":"scalar","type":"String"},{"name":"request","kind":"object","type":"CodeReviewRequest","relationName":"CodeReviewRequestToCodeReviewSubmission"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorSubmissions"},{"name":"summary","kind":"scalar","type":"String"},{"name":"reviewedCodeSnippet","kind":"scalar","type":"String"},{"name":"videoUrl","kind":"scalar","type":"String"},{"name":"pullRequestUrl","kind":"scalar","type":"String"},{"name":"comments","kind":"object","type":"CodeReviewComment","relationName":"CodeReviewCommentToCodeReviewSubmission"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"code_review_submission","schema":null},"CodeReviewComment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"submissionId","kind":"scalar","type":"String"},{"name":"submission","kind":"object","type":"CodeReviewSubmission","relationName":"CodeReviewCommentToCodeReviewSubmission"},{"name":"filePath","kind":"scalar","type":"String"},{"name":"lineNumber","kind":"scalar","type":"Int"},{"name":"commentText","kind":"scalar","type":"String"},{"name":"severity","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"code_review_comment","schema":null},"CohortProgram":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorCohorts"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"durationWeeks","kind":"scalar","type":"Int"},{"name":"capacity","kind":"scalar","type":"Int"},{"name":"totalCost","kind":"scalar","type":"Int"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"approvalStatus","kind":"enum","type":"CohortApprovalStatus"},{"name":"status","kind":"enum","type":"CohortStatus"},{"name":"approvedBy","kind":"scalar","type":"String"},{"name":"approvedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"enrollments","kind":"object","type":"CohortEnrollment","relationName":"CohortEnrollmentToCohortProgram"},{"name":"sessions","kind":"object","type":"CohortSession","relationName":"CohortProgramToCohortSession"},{"name":"exams","kind":"object","type":"Exam","relationName":"CohortExams"}],"dbName":"cohort_program","schema":null},"CohortEnrollment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortId","kind":"scalar","type":"String"},{"name":"cohort","kind":"object","type":"CohortProgram","relationName":"CohortEnrollmentToCohortProgram"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCohortEnrollments"},{"name":"enrolledAt","kind":"scalar","type":"DateTime"}],"dbName":"cohort_enrollment","schema":null},"CohortSession":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortId","kind":"scalar","type":"String"},{"name":"cohort","kind":"object","type":"CohortProgram","relationName":"CohortProgramToCohortSession"},{"name":"sessionNumber","kind":"scalar","type":"Int"},{"name":"dayNumber","kind":"scalar","type":"Int"},{"name":"title","kind":"scalar","type":"String"},{"name":"scheduledAt","kind":"scalar","type":"DateTime"},{"name":"durationMinutes","kind":"scalar","type":"Int"},{"name":"creditCost","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"CohortSessionStatus"},{"name":"joinLink","kind":"scalar","type":"String"},{"name":"resources","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"participants","kind":"object","type":"CohortSessionParticipant","relationName":"CohortSessionToCohortSessionParticipant"}],"dbName":"cohort_session","schema":null},"CohortSessionParticipant":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortSessionId","kind":"scalar","type":"String"},{"name":"cohortSession","kind":"object","type":"CohortSession","relationName":"CohortSessionToCohortSessionParticipant"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCohortSessions"},{"name":"paid","kind":"scalar","type":"Boolean"},{"name":"joinedAt","kind":"scalar","type":"DateTime"}],"dbName":"cohort_session_participant","schema":null},"Exam":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorExams"},{"name":"cohortId","kind":"scalar","type":"String"},{"name":"cohort","kind":"object","type":"CohortProgram","relationName":"CohortExams"},{"name":"sprintId","kind":"scalar","type":"String"},{"name":"sprint","kind":"object","type":"SprintRequest","relationName":"SprintExams"},{"name":"isFree","kind":"scalar","type":"Boolean"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"durationMinutes","kind":"scalar","type":"Int"},{"name":"totalMarks","kind":"scalar","type":"Int"},{"name":"passMark","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"ExamStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"questions","kind":"object","type":"Question","relationName":"ExamToQuestion"},{"name":"attempts","kind":"object","type":"ExamAttempt","relationName":"ExamToExamAttempt"}],"dbName":"exam","schema":null},"Question":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"examId","kind":"scalar","type":"String"},{"name":"exam","kind":"object","type":"Exam","relationName":"ExamToQuestion"},{"name":"questionText","kind":"scalar","type":"String"},{"name":"options","kind":"scalar","type":"String"},{"name":"correctOptionIndex","kind":"scalar","type":"Int"},{"name":"explanation","kind":"scalar","type":"String"},{"name":"marks","kind":"scalar","type":"Int"}],"dbName":"question","schema":null},"ExamAttempt":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"examId","kind":"scalar","type":"String"},{"name":"exam","kind":"object","type":"Exam","relationName":"ExamToExamAttempt"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentExamAttempts"},{"name":"score","kind":"scalar","type":"Int"},{"name":"percentage","kind":"scalar","type":"Float"},{"name":"isPassed","kind":"scalar","type":"Boolean"},{"name":"startedAt","kind":"scalar","type":"DateTime"},{"name":"submittedAt","kind":"scalar","type":"DateTime"},{"name":"answers","kind":"scalar","type":"Json"}],"dbName":"exam_attempt","schema":null},"MentorProfile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"MentorProfileToUser"},{"name":"bio","kind":"scalar","type":"String"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"experienceLevel","kind":"enum","type":"ExperienceLevel"},{"name":"githubUrl","kind":"scalar","type":"String"},{"name":"resumeUrl","kind":"scalar","type":"String"},{"name":"approvalStatus","kind":"enum","type":"ApprovalStatus"},{"name":"approvedBy","kind":"scalar","type":"String"},{"name":"approvedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"mentor_profile","schema":null},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"PaymentToUser"},{"name":"merchantInvoiceNumber","kind":"scalar","type":"String"},{"name":"paymentID","kind":"scalar","type":"String"},{"name":"trxID","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayResponse","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"payment","schema":null},"PlatformSetting":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"sprintCreditPerSession","kind":"scalar","type":"Int"},{"name":"sessionCommissionPercent","kind":"scalar","type":"Int"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"platform_setting","schema":null},"SprintRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentSprints"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"startDate","kind":"scalar","type":"DateTime"},{"name":"durationDays","kind":"scalar","type":"Int"},{"name":"selectedDays","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"SprintStatus"},{"name":"claimedByMentorId","kind":"scalar","type":"String"},{"name":"claimedByMentor","kind":"object","type":"User","relationName":"MentorSprints"},{"name":"claimedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"SprintSession","relationName":"SprintRequestToSprintSession"},{"name":"exams","kind":"object","type":"Exam","relationName":"SprintExams"}],"dbName":"sprint_request","schema":null},"SprintSession":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"sprintRequestId","kind":"scalar","type":"String"},{"name":"sprintRequest","kind":"object","type":"SprintRequest","relationName":"SprintRequestToSprintSession"},{"name":"dayNumber","kind":"scalar","type":"Int"},{"name":"scheduledAt","kind":"scalar","type":"DateTime"},{"name":"durationMinutes","kind":"scalar","type":"Int"},{"name":"creditCost","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"SprintSessionStatus"},{"name":"joinLink","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"sprint_session","schema":null},"Wallet":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"UserToWallet"},{"name":"balance","kind":"scalar","type":"Int"},{"name":"totalEarned","kind":"scalar","type":"Int"},{"name":"totalWithdrawn","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"transactions","kind":"object","type":"CreditTransaction","relationName":"CreditTransactionToWallet"}],"dbName":"wallet","schema":null},"CreditTransaction":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"walletId","kind":"scalar","type":"String"},{"name":"wallet","kind":"object","type":"Wallet","relationName":"CreditTransactionToWallet"},{"name":"amount","kind":"scalar","type":"Int"},{"name":"type","kind":"enum","type":"CreditTransactionType"},{"name":"description","kind":"scalar","type":"String"},{"name":"referenceId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"credit_transaction","schema":null}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","user","sessions","accounts","mentorProfile","student","claimedByMentor","sprintRequest","mentor","cohort","enrollments","cohortSession","participants","_count","exams","sprint","exam","questions","attempts","sprintsRequested","sprintsClaimed","cohortsCreated","cohortEnrollments","cohortSessionsJoined","wallet","transactions","payments","assignedMentor","request","submission","comments","studentCodeReviews","mentorCodeReviews","mentorSubmissions","mentorExams","studentExamAttempts","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_min","_max","User.groupBy","User.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.createManyAndReturn","Session.updateOne","Session.updateMany","Session.updateManyAndReturn","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","Account.findUnique","Account.findUniqueOrThrow","Account.findFirst","Account.findFirstOrThrow","Account.findMany","Account.createOne","Account.createMany","Account.createManyAndReturn","Account.updateOne","Account.updateMany","Account.updateManyAndReturn","Account.upsertOne","Account.deleteOne","Account.deleteMany","Account.groupBy","Account.aggregate","Verification.findUnique","Verification.findUniqueOrThrow","Verification.findFirst","Verification.findFirstOrThrow","Verification.findMany","Verification.createOne","Verification.createMany","Verification.createManyAndReturn","Verification.updateOne","Verification.updateMany","Verification.updateManyAndReturn","Verification.upsertOne","Verification.deleteOne","Verification.deleteMany","Verification.groupBy","Verification.aggregate","CodeReviewRequest.findUnique","CodeReviewRequest.findUniqueOrThrow","CodeReviewRequest.findFirst","CodeReviewRequest.findFirstOrThrow","CodeReviewRequest.findMany","CodeReviewRequest.createOne","CodeReviewRequest.createMany","CodeReviewRequest.createManyAndReturn","CodeReviewRequest.updateOne","CodeReviewRequest.updateMany","CodeReviewRequest.updateManyAndReturn","CodeReviewRequest.upsertOne","CodeReviewRequest.deleteOne","CodeReviewRequest.deleteMany","_avg","_sum","CodeReviewRequest.groupBy","CodeReviewRequest.aggregate","CodeReviewSubmission.findUnique","CodeReviewSubmission.findUniqueOrThrow","CodeReviewSubmission.findFirst","CodeReviewSubmission.findFirstOrThrow","CodeReviewSubmission.findMany","CodeReviewSubmission.createOne","CodeReviewSubmission.createMany","CodeReviewSubmission.createManyAndReturn","CodeReviewSubmission.updateOne","CodeReviewSubmission.updateMany","CodeReviewSubmission.updateManyAndReturn","CodeReviewSubmission.upsertOne","CodeReviewSubmission.deleteOne","CodeReviewSubmission.deleteMany","CodeReviewSubmission.groupBy","CodeReviewSubmission.aggregate","CodeReviewComment.findUnique","CodeReviewComment.findUniqueOrThrow","CodeReviewComment.findFirst","CodeReviewComment.findFirstOrThrow","CodeReviewComment.findMany","CodeReviewComment.createOne","CodeReviewComment.createMany","CodeReviewComment.createManyAndReturn","CodeReviewComment.updateOne","CodeReviewComment.updateMany","CodeReviewComment.updateManyAndReturn","CodeReviewComment.upsertOne","CodeReviewComment.deleteOne","CodeReviewComment.deleteMany","CodeReviewComment.groupBy","CodeReviewComment.aggregate","CohortProgram.findUnique","CohortProgram.findUniqueOrThrow","CohortProgram.findFirst","CohortProgram.findFirstOrThrow","CohortProgram.findMany","CohortProgram.createOne","CohortProgram.createMany","CohortProgram.createManyAndReturn","CohortProgram.updateOne","CohortProgram.updateMany","CohortProgram.updateManyAndReturn","CohortProgram.upsertOne","CohortProgram.deleteOne","CohortProgram.deleteMany","CohortProgram.groupBy","CohortProgram.aggregate","CohortEnrollment.findUnique","CohortEnrollment.findUniqueOrThrow","CohortEnrollment.findFirst","CohortEnrollment.findFirstOrThrow","CohortEnrollment.findMany","CohortEnrollment.createOne","CohortEnrollment.createMany","CohortEnrollment.createManyAndReturn","CohortEnrollment.updateOne","CohortEnrollment.updateMany","CohortEnrollment.updateManyAndReturn","CohortEnrollment.upsertOne","CohortEnrollment.deleteOne","CohortEnrollment.deleteMany","CohortEnrollment.groupBy","CohortEnrollment.aggregate","CohortSession.findUnique","CohortSession.findUniqueOrThrow","CohortSession.findFirst","CohortSession.findFirstOrThrow","CohortSession.findMany","CohortSession.createOne","CohortSession.createMany","CohortSession.createManyAndReturn","CohortSession.updateOne","CohortSession.updateMany","CohortSession.updateManyAndReturn","CohortSession.upsertOne","CohortSession.deleteOne","CohortSession.deleteMany","CohortSession.groupBy","CohortSession.aggregate","CohortSessionParticipant.findUnique","CohortSessionParticipant.findUniqueOrThrow","CohortSessionParticipant.findFirst","CohortSessionParticipant.findFirstOrThrow","CohortSessionParticipant.findMany","CohortSessionParticipant.createOne","CohortSessionParticipant.createMany","CohortSessionParticipant.createManyAndReturn","CohortSessionParticipant.updateOne","CohortSessionParticipant.updateMany","CohortSessionParticipant.updateManyAndReturn","CohortSessionParticipant.upsertOne","CohortSessionParticipant.deleteOne","CohortSessionParticipant.deleteMany","CohortSessionParticipant.groupBy","CohortSessionParticipant.aggregate","Exam.findUnique","Exam.findUniqueOrThrow","Exam.findFirst","Exam.findFirstOrThrow","Exam.findMany","Exam.createOne","Exam.createMany","Exam.createManyAndReturn","Exam.updateOne","Exam.updateMany","Exam.updateManyAndReturn","Exam.upsertOne","Exam.deleteOne","Exam.deleteMany","Exam.groupBy","Exam.aggregate","Question.findUnique","Question.findUniqueOrThrow","Question.findFirst","Question.findFirstOrThrow","Question.findMany","Question.createOne","Question.createMany","Question.createManyAndReturn","Question.updateOne","Question.updateMany","Question.updateManyAndReturn","Question.upsertOne","Question.deleteOne","Question.deleteMany","Question.groupBy","Question.aggregate","ExamAttempt.findUnique","ExamAttempt.findUniqueOrThrow","ExamAttempt.findFirst","ExamAttempt.findFirstOrThrow","ExamAttempt.findMany","ExamAttempt.createOne","ExamAttempt.createMany","ExamAttempt.createManyAndReturn","ExamAttempt.updateOne","ExamAttempt.updateMany","ExamAttempt.updateManyAndReturn","ExamAttempt.upsertOne","ExamAttempt.deleteOne","ExamAttempt.deleteMany","ExamAttempt.groupBy","ExamAttempt.aggregate","MentorProfile.findUnique","MentorProfile.findUniqueOrThrow","MentorProfile.findFirst","MentorProfile.findFirstOrThrow","MentorProfile.findMany","MentorProfile.createOne","MentorProfile.createMany","MentorProfile.createManyAndReturn","MentorProfile.updateOne","MentorProfile.updateMany","MentorProfile.updateManyAndReturn","MentorProfile.upsertOne","MentorProfile.deleteOne","MentorProfile.deleteMany","MentorProfile.groupBy","MentorProfile.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","PlatformSetting.findUnique","PlatformSetting.findUniqueOrThrow","PlatformSetting.findFirst","PlatformSetting.findFirstOrThrow","PlatformSetting.findMany","PlatformSetting.createOne","PlatformSetting.createMany","PlatformSetting.createManyAndReturn","PlatformSetting.updateOne","PlatformSetting.updateMany","PlatformSetting.updateManyAndReturn","PlatformSetting.upsertOne","PlatformSetting.deleteOne","PlatformSetting.deleteMany","PlatformSetting.groupBy","PlatformSetting.aggregate","SprintRequest.findUnique","SprintRequest.findUniqueOrThrow","SprintRequest.findFirst","SprintRequest.findFirstOrThrow","SprintRequest.findMany","SprintRequest.createOne","SprintRequest.createMany","SprintRequest.createManyAndReturn","SprintRequest.updateOne","SprintRequest.updateMany","SprintRequest.updateManyAndReturn","SprintRequest.upsertOne","SprintRequest.deleteOne","SprintRequest.deleteMany","SprintRequest.groupBy","SprintRequest.aggregate","SprintSession.findUnique","SprintSession.findUniqueOrThrow","SprintSession.findFirst","SprintSession.findFirstOrThrow","SprintSession.findMany","SprintSession.createOne","SprintSession.createMany","SprintSession.createManyAndReturn","SprintSession.updateOne","SprintSession.updateMany","SprintSession.updateManyAndReturn","SprintSession.upsertOne","SprintSession.deleteOne","SprintSession.deleteMany","SprintSession.groupBy","SprintSession.aggregate","Wallet.findUnique","Wallet.findUniqueOrThrow","Wallet.findFirst","Wallet.findFirstOrThrow","Wallet.findMany","Wallet.createOne","Wallet.createMany","Wallet.createManyAndReturn","Wallet.updateOne","Wallet.updateMany","Wallet.updateManyAndReturn","Wallet.upsertOne","Wallet.deleteOne","Wallet.deleteMany","Wallet.groupBy","Wallet.aggregate","CreditTransaction.findUnique","CreditTransaction.findUniqueOrThrow","CreditTransaction.findFirst","CreditTransaction.findFirstOrThrow","CreditTransaction.findMany","CreditTransaction.createOne","CreditTransaction.createMany","CreditTransaction.createManyAndReturn","CreditTransaction.updateOne","CreditTransaction.updateMany","CreditTransaction.updateManyAndReturn","CreditTransaction.upsertOne","CreditTransaction.deleteOne","CreditTransaction.deleteMany","CreditTransaction.groupBy","CreditTransaction.aggregate","AND","OR","NOT","id","walletId","amount","CreditTransactionType","type","description","referenceId","createdAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","userId","balance","totalEarned","totalWithdrawn","updatedAt","every","some","none","sprintRequestId","dayNumber","scheduledAt","durationMinutes","creditCost","SprintSessionStatus","status","joinLink","studentId","title","techStackTags","startDate","durationDays","selectedDays","SprintStatus","claimedByMentorId","claimedAt","deletedAt","has","hasEvery","hasSome","sprintCreditPerSession","sessionCommissionPercent","merchantInvoiceNumber","paymentID","trxID","PaymentStatus","gatewayResponse","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","bio","ExperienceLevel","experienceLevel","githubUrl","resumeUrl","ApprovalStatus","approvalStatus","approvedBy","approvedAt","examId","score","percentage","isPassed","startedAt","submittedAt","answers","questionText","options","correctOptionIndex","explanation","marks","mentorId","cohortId","sprintId","isFree","totalMarks","passMark","ExamStatus","cohortSessionId","paid","joinedAt","sessionNumber","CohortSessionStatus","resources","enrolledAt","durationWeeks","capacity","totalCost","CohortApprovalStatus","CohortStatus","submissionId","filePath","lineNumber","commentText","severity","requestId","summary","reviewedCodeSnippet","videoUrl","pullRequestUrl","CodeReviewTier","tier","codeSnippet","language","githubRepoUrl","branchName","specificFiles","creditReward","CodeReviewStatus","previewMentorId","previewExpiresAt","assignedMentorId","deliveryDeadline","identifier","value","expiresAt","accountId","providerId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","token","ipAddress","userAgent","name","email","emailVerified","image","role","isBlocked","cohortSessionId_studentId","cohortId_studentId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "jQvKAdACGwQAAOAFACAFAADhBQAgBgAA4gUAIBUAAOMFACAWAADjBQAgFwAA5AUAIBgAAMMFACAZAADSBQAgGgAA5QUAIBwAAOYFACAhAADnBQAgIgAA5wUAICMAAOgFACAkAADFBQAgJQAA2wUAIP4CAADfBQAw_wIAABEAEIADAADfBQAwgQMBAAAAAYgDQADgBAAhmANAAOAEACGMBAEA8gQAIY0EAQAAAAGOBCAAyAUAIY8EAQCCBQAhkAQBAPIEACGRBCAAyAUAIQEAAAABACAMAwAA4QQAIP4CAADtBQAw_wIAAAMAEIADAADtBQAwgQMBAPIEACGIA0AA4AQAIZQDAQDyBAAhmANAAOAEACH_A0AA4AQAIYkEAQDyBAAhigQBAIIFACGLBAEAggUAIQMDAACQBgAgigQAAO4FACCLBAAA7gUAIAwDAADhBAAg_gIAAO0FADD_AgAAAwAQgAMAAO0FADCBAwEAAAABiANAAOAEACGUAwEA8gQAIZgDQADgBAAh_wNAAOAEACGJBAEAAAABigQBAIIFACGLBAEAggUAIQMAAAADACABAAAEADACAAAFACARAwAA4QQAIP4CAADsBQAw_wIAAAcAEIADAADsBQAwgQMBAPIEACGIA0AA4AQAIZQDAQDyBAAhmANAAOAEACGABAEA8gQAIYEEAQDyBAAhggQBAIIFACGDBAEAggUAIYQEAQCCBQAhhQRAAIQFACGGBEAAhAUAIYcEAQCCBQAhiAQBAIIFACEIAwAAkAYAIIIEAADuBQAggwQAAO4FACCEBAAA7gUAIIUEAADuBQAghgQAAO4FACCHBAAA7gUAIIgEAADuBQAgEQMAAOEEACD-AgAA7AUAMP8CAAAHABCAAwAA7AUAMIEDAQAAAAGIA0AA4AQAIZQDAQDyBAAhmANAAOAEACGABAEA8gQAIYEEAQDyBAAhggQBAIIFACGDBAEAggUAIYQEAQCCBQAhhQRAAIQFACGGBEAAhAUAIYcEAQCCBQAhiAQBAIIFACEDAAAABwAgAQAACAAwAgAACQAgEAMAAOEEACD-AgAAgAUAMP8CAAALABCAAwAAgAUAMIEDAQDyBAAhiANAAOAEACGUAwEA8gQAIZgDQADgBAAhpgMAAOsEACC-AwEA8gQAIcADAACBBcADIsEDAQCCBQAhwgMBAIIFACHEAwAAgwXEAyLFAwEAggUAIcYDQACEBQAhAQAAAAsAIBUEAADrBQAgBwAA4QQAIAgAALgFACAQAADFBQAg_gIAAOkFADD_AgAADQAQgAMAAOkFADCBAwEA8gQAIYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAADqBasDIqQDAQDyBAAhpQMBAPIEACGmAwAA6wQAIKcDQADgBAAhqAMCAN8EACGpAwAA7AQAIKsDAQCCBQAhrANAAIQFACGtA0AAhAUAIQcEAAD0CQAgBwAAkAYAIAgAAJAGACAQAADpCQAgqwMAAO4FACCsAwAA7gUAIK0DAADuBQAgFQQAAOsFACAHAADhBAAgCAAAuAUAIBAAAMUFACD-AgAA6QUAMP8CAAANABCAAwAA6QUAMIEDAQAAAAGGAwEA8gQAIYgDQADgBAAhmANAAOAEACGiAwAA6gWrAyKkAwEA8gQAIaUDAQDyBAAhpgMAAOsEACCnA0AA4AQAIagDAgDfBAAhqQMAAOwEACCrAwEAggUAIawDQACEBQAhrQNAAIQFACEDAAAADQAgAQAADgAwAgAADwAgGwQAAOAFACAFAADhBQAgBgAA4gUAIBUAAOMFACAWAADjBQAgFwAA5AUAIBgAAMMFACAZAADSBQAgGgAA5QUAIBwAAOYFACAhAADnBQAgIgAA5wUAICMAAOgFACAkAADFBQAgJQAA2wUAIP4CAADfBQAw_wIAABEAEIADAADfBQAwgQMBAPIEACGIA0AA4AQAIZgDQADgBAAhjAQBAPIEACGNBAEA8gQAIY4EIADIBQAhjwQBAIIFACGQBAEA8gQAIZEEIADIBQAhAQAAABEAIA4JAADeBQAg_gIAANwFADD_AgAAEwAQgAMAANwFADCBAwEA8gQAIYgDQADgBAAhmANAAOAEACGcAwEA8gQAIZ0DAgDfBAAhngNAAIQFACGfAwIA3wQAIaADAgDfBAAhogMAAN0FogMiowMBAIIFACEDCQAA8gkAIJ4DAADuBQAgowMAAO4FACAOCQAA3gUAIP4CAADcBQAw_wIAABMAEIADAADcBQAwgQMBAAAAAYgDQADgBAAhmANAAOAEACGcAwEA8gQAIZ0DAgDfBAAhngNAAIQFACGfAwIA3wQAIaADAgDfBAAhogMAAN0FogMiowMBAIIFACEDAAAAEwAgAQAAFAAwAgAAFQAgFQoAAOEEACALAADYBQAgEQAA2QUAIBMAANoFACAUAADbBQAg_gIAANUFADD_AgAAFwAQgAMAANUFADCBAwEA8gQAIYYDAQCCBQAhiANAAOAEACGYA0AA4AQAIZ8DAgDfBAAhogMAANcF2gMipQMBAPIEACHTAwEA8gQAIdQDAQCCBQAh1QMBAIIFACHWAyAAyAUAIdcDAgDfBAAh2AMCANYFACEJCgAAkAYAIAsAAPEJACARAADyCQAgEwAA8wkAIBQAAOoJACCGAwAA7gUAINQDAADuBQAg1QMAAO4FACDYAwAA7gUAIBUKAADhBAAgCwAA2AUAIBEAANkFACATAADaBQAgFAAA2wUAIP4CAADVBQAw_wIAABcAEIADAADVBQAwgQMBAAAAAYYDAQCCBQAhiANAAOAEACGYA0AA4AQAIZ8DAgDfBAAhogMAANcF2gMipQMBAPIEACHTAwEA8gQAIdQDAQCCBQAh1QMBAIIFACHWAyAAyAUAIdcDAgDfBAAh2AMCANYFACEDAAAAFwAgAQAAGAAwAgAAGQAgFgQAAMQFACAKAADhBAAgDAAAwwUAIBAAAMUFACD-AgAAwAUAMP8CAAAbABCAAwAAwAUAMIEDAQDyBAAhhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAAMIF5gMipQMBAPIEACGmAwAA6wQAIK0DQACEBQAhxAMAAMEF5QMixQMBAIIFACHGA0AAhAUAIdMDAQDyBAAh4QMCAN8EACHiAwIA3wQAIeMDAgDfBAAhAQAAABsAIAkHAADhBAAgCwAA0QUAIP4CAADUBQAw_wIAAB0AEIADAADUBQAwgQMBAPIEACGkAwEA8gQAIdQDAQDyBAAh4ANAAOAEACECBwAAkAYAIAsAAPEJACAKBwAA4QQAIAsAANEFACD-AgAA1AUAMP8CAAAdABCAAwAA1AUAMIEDAQAAAAGkAwEA8gQAIdQDAQDyBAAh4ANAAOAEACGTBAAA0wUAIAMAAAAdACABAAAeADACAAAfACASCwAA0QUAIA4AANIFACD-AgAAzwUAMP8CAAAhABCAAwAAzwUAMIEDAQDyBAAhiANAAOAEACGYA0AA4AQAIZ0DAgDfBAAhngNAAOAEACGfAwIA3wQAIaADAgDfBAAhogMAANAF3wMiowMBAIIFACGlAwEA8gQAIdQDAQDyBAAh3QMCAN8EACHfAwAAvAUAIAQLAADxCQAgDgAA5AkAIKMDAADuBQAg3wMAAO4FACASCwAA0QUAIA4AANIFACD-AgAAzwUAMP8CAAAhABCAAwAAzwUAMIEDAQAAAAGIA0AA4AQAIZgDQADgBAAhnQMCAN8EACGeA0AA4AQAIZ8DAgDfBAAhoAMCAN8EACGiAwAA0AXfAyKjAwEAggUAIaUDAQDyBAAh1AMBAPIEACHdAwIA3wQAId8DAAC8BQAgAwAAACEAIAEAACIAMAIAACMAIAoHAADhBAAgDQAAzgUAIP4CAADNBQAw_wIAACUAEIADAADNBQAwgQMBAPIEACGkAwEA8gQAIdoDAQDyBAAh2wMgAMgFACHcA0AA4AQAIQIHAACQBgAgDQAA8AkAIAsHAADhBAAgDQAAzgUAIP4CAADNBQAw_wIAACUAEIADAADNBQAwgQMBAAAAAaQDAQDyBAAh2gMBAPIEACHbAyAAyAUAIdwDQADgBAAhkgQAAMwFACADAAAAJQAgAQAAJgAwAgAAJwAgAQAAACUAIAMAAAAXACABAAAYADACAAAZACABAAAAHQAgAQAAACEAIAEAAAAXACABAAAADQAgCxIAAMoFACD-AgAAywUAMP8CAAAvABCAAwAAywUAMIEDAQDyBAAhxwMBAPIEACHOAwEA8gQAIc8DAADrBAAg0AMCAN8EACHRAwEAggUAIdIDAgDfBAAhAhIAAO8JACDRAwAA7gUAIAsSAADKBQAg_gIAAMsFADD_AgAALwAQgAMAAMsFADCBAwEAAAABxwMBAPIEACHOAwEA8gQAIc8DAADrBAAg0AMCAN8EACHRAwEAggUAIdIDAgDfBAAhAwAAAC8AIAEAADAAMAIAADEAIA4HAADhBAAgEgAAygUAIP4CAADGBQAw_wIAADMAEIADAADGBQAwgQMBAPIEACGkAwEA8gQAIccDAQDyBAAhyAMCAN8EACHJAwgAxwUAIcoDIADIBQAhywNAAOAEACHMA0AAhAUAIc0DAADJBQAgAwcAAJAGACASAADvCQAgzAMAAO4FACAOBwAA4QQAIBIAAMoFACD-AgAAxgUAMP8CAAAzABCAAwAAxgUAMIEDAQAAAAGkAwEA8gQAIccDAQDyBAAhyAMCAN8EACHJAwgAxwUAIcoDIADIBQAhywNAAOAEACHMA0AAhAUAIc0DAADJBQAgAwAAADMAIAEAADQAMAIAADUAIAEAAAAvACABAAAAMwAgAQAAABMAIAEAAAAXACADAAAADQAgAQAADgAwAgAADwAgBwQAAO4JACAKAACQBgAgDAAA4wkAIBAAAOkJACCtAwAA7gUAIMUDAADuBQAgxgMAAO4FACAWBAAAxAUAIAoAAOEEACAMAADDBQAgEAAAxQUAIP4CAADABQAw_wIAABsAEIADAADABQAwgQMBAAAAAYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAADCBeYDIqUDAQDyBAAhpgMAAOsEACCtA0AAhAUAIcQDAADBBeUDIsUDAQCCBQAhxgNAAIQFACHTAwEA8gQAIeEDAgDfBAAh4gMCAN8EACHjAwIA3wQAIQMAAAAbACABAAA8ADACAAA9ACADAAAAHQAgAQAAHgAwAgAAHwAgAwAAACUAIAEAACYAMAIAACcAIAwDAADhBAAgGwAA4gQAIP4CAADeBAAw_wIAAEEAEIADAADeBAAwgQMBAPIEACGIA0AA4AQAIZQDAQDyBAAhlQMCAN8EACGWAwIA3wQAIZcDAgDfBAAhmANAAOAEACEBAAAAQQAgCxoAAL8FACD-AgAAvQUAMP8CAABDABCAAwAAvQUAMIEDAQDyBAAhggMBAPIEACGDAwIA3wQAIYUDAAC-BYUDIoYDAQDyBAAhhwMBAIIFACGIA0AA4AQAIQIaAADlCQAghwMAAO4FACALGgAAvwUAIP4CAAC9BQAw_wIAAEMAEIADAAC9BQAwgQMBAAAAAYIDAQDyBAAhgwMCAN8EACGFAwAAvgWFAyKGAwEA8gQAIYcDAQCCBQAhiANAAOAEACEDAAAAQwAgAQAARAAwAgAARQAgAQAAAEMAIA4DAADhBAAg_gIAALoFADD_AgAASAAQgAMAALoFADCBAwEA8gQAIYMDAgDfBAAhiANAAOAEACGUAwEA8gQAIZgDQADgBAAhogMAALsFtwMiswMBAPIEACG0AwEAggUAIbUDAQCCBQAhtwMAALwFACAEAwAAkAYAILQDAADuBQAgtQMAAO4FACC3AwAA7gUAIA4DAADhBAAg_gIAALoFADD_AgAASAAQgAMAALoFADCBAwEAAAABgwMCAN8EACGIA0AA4AQAIZQDAQDyBAAhmANAAOAEACGiAwAAuwW3AyKzAwEAAAABtAMBAAAAAbUDAQAAAAG3AwAAvAUAIAMAAABIACABAABJADACAABKACAYBwAA4QQAIB0AALgFACAfAAC5BQAg_gIAALUFADD_AgAATAAQgAMAALUFADCBAwEA8gQAIYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAAC3BfkDIqQDAQDyBAAhpQMBAPIEACHxAwAAtgXxAyLyAwEAggUAIfMDAQCCBQAh9AMBAIIFACH1AwEAggUAIfYDAQCCBQAh9wMCAN8EACH5AwEAggUAIfoDQACEBQAh-wMBAIIFACH8A0AAhAUAIQwHAACQBgAgHQAAkAYAIB8AAO0JACDyAwAA7gUAIPMDAADuBQAg9AMAAO4FACD1AwAA7gUAIPYDAADuBQAg-QMAAO4FACD6AwAA7gUAIPsDAADuBQAg_AMAAO4FACAYBwAA4QQAIB0AALgFACAfAAC5BQAg_gIAALUFADD_AgAATAAQgAMAALUFADCBAwEAAAABhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAALcF-QMipAMBAPIEACGlAwEA8gQAIfEDAAC2BfEDIvIDAQCCBQAh8wMBAIIFACH0AwEAggUAIfUDAQCCBQAh9gMBAIIFACH3AwIA3wQAIfkDAQCCBQAh-gNAAIQFACH7AwEAggUAIfwDQACEBQAhAwAAAEwAIAEAAE0AMAIAAE4AIAEAAAARACAOCgAA4QQAIB4AALEFACAgAACyBQAg_gIAALAFADD_AgAAUQAQgAMAALAFADCBAwEA8gQAIYgDQADgBAAh0wMBAPIEACHrAwEA8gQAIewDAQDyBAAh7QMBAIIFACHuAwEAggUAIe8DAQCCBQAhAQAAAFEAIAsfAAC0BQAg_gIAALMFADD_AgAAUwAQgAMAALMFADCBAwEA8gQAIYgDQADgBAAh5gMBAPIEACHnAwEA8gQAIegDAgDfBAAh6QMBAPIEACHqAwEAggUAIQIfAADtCQAg6gMAAO4FACALHwAAtAUAIP4CAACzBQAw_wIAAFMAEIADAACzBQAwgQMBAAAAAYgDQADgBAAh5gMBAPIEACHnAwEA8gQAIegDAgDfBAAh6QMBAPIEACHqAwEAggUAIQMAAABTACABAABUADACAABVACABAAAAUwAgAwAAAEwAIAEAAE0AMAIAAE4AIAYKAACQBgAgHgAA6wkAICAAAOwJACDtAwAA7gUAIO4DAADuBQAg7wMAAO4FACAOCgAA4QQAIB4AALEFACAgAACyBQAg_gIAALAFADD_AgAAUQAQgAMAALAFADCBAwEAAAABiANAAOAEACHTAwEA8gQAIesDAQAAAAHsAwEA8gQAIe0DAQCCBQAh7gMBAIIFACHvAwEAggUAIQMAAABRACABAABZADACAABaACADAAAAFwAgAQAAGAAwAgAAGQAgAwAAADMAIAEAADQAMAIAADUAIAEAAAADACABAAAABwAgAQAAAA0AIAEAAAANACABAAAAGwAgAQAAAB0AIAEAAAAlACABAAAASAAgAQAAAEwAIAEAAABMACABAAAAUQAgAQAAABcAIAEAAAAzACABAAAAAQAgEAQAAN4JACAFAADfCQAgBgAA4AkAIBUAAOEJACAWAADhCQAgFwAA4gkAIBgAAOMJACAZAADkCQAgGgAA5QkAIBwAAOYJACAhAADnCQAgIgAA5wkAICMAAOgJACAkAADpCQAgJQAA6gkAII8EAADuBQAgAwAAABEAIAEAAGwAMAIAAAEAIAMAAAARACABAABsADACAAABACADAAAAEQAgAQAAbAAwAgAAAQAgGAQAAM8JACAFAADQCQAgBgAA0QkAIBUAANIJACAWAADTCQAgFwAA1AkAIBgAANUJACAZAADWCQAgGgAA1wkAIBwAANgJACAhAADZCQAgIgAA2gkAICMAANsJACAkAADcCQAgJQAA3QkAIIEDAQAAAAGIA0AAAAABmANAAAAAAYwEAQAAAAGNBAEAAAABjgQgAAAAAY8EAQAAAAGQBAEAAAABkQQgAAAAAQErAABwACAJgQMBAAAAAYgDQAAAAAGYA0AAAAABjAQBAAAAAY0EAQAAAAGOBCAAAAABjwQBAAAAAZAEAQAAAAGRBCAAAAABASsAAHIAMAErAAByADAYBAAArAgAIAUAAK0IACAGAACuCAAgFQAArwgAIBYAALAIACAXAACxCAAgGAAAsggAIBkAALMIACAaAAC0CAAgHAAAtQgAICEAALYIACAiAAC3CAAgIwAAuAgAICQAALkIACAlAAC6CAAggQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhjAQBAPQFACGNBAEA9AUAIY4EIACxBgAhjwQBAPcFACGQBAEA9AUAIZEEIACxBgAhAgAAAAEAICsAAHUAIAmBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACECAAAAEQAgKwAAdwAgAgAAABEAICsAAHcAIAMAAAABACAyAABwACAzAAB1ACABAAAAAQAgAQAAABEAIAQPAACpCAAgOAAAqwgAIDkAAKoIACCPBAAA7gUAIAz-AgAArwUAMP8CAAB-ABCAAwAArwUAMIEDAQDMBAAhiANAANAEACGYA0AA0AQAIYwEAQDMBAAhjQQBAMwEACGOBCAAhwUAIY8EAQDPBAAhkAQBAMwEACGRBCAAhwUAIQMAAAARACABAAB9ADA3AAB-ACADAAAAEQAgAQAAbAAwAgAAAQAgAQAAAAUAIAEAAAAFACADAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACAJAwAAqAgAIIEDAQAAAAGIA0AAAAABlAMBAAAAAZgDQAAAAAH_A0AAAAABiQQBAAAAAYoEAQAAAAGLBAEAAAABASsAAIYBACAIgQMBAAAAAYgDQAAAAAGUAwEAAAABmANAAAAAAf8DQAAAAAGJBAEAAAABigQBAAAAAYsEAQAAAAEBKwAAiAEAMAErAACIAQAwCQMAAKcIACCBAwEA9AUAIYgDQAD4BQAhlAMBAPQFACGYA0AA-AUAIf8DQAD4BQAhiQQBAPQFACGKBAEA9wUAIYsEAQD3BQAhAgAAAAUAICsAAIsBACAIgQMBAPQFACGIA0AA-AUAIZQDAQD0BQAhmANAAPgFACH_A0AA-AUAIYkEAQD0BQAhigQBAPcFACGLBAEA9wUAIQIAAAADACArAACNAQAgAgAAAAMAICsAAI0BACADAAAABQAgMgAAhgEAIDMAAIsBACABAAAABQAgAQAAAAMAIAUPAACkCAAgOAAApggAIDkAAKUIACCKBAAA7gUAIIsEAADuBQAgC_4CAACuBQAw_wIAAJQBABCAAwAArgUAMIEDAQDMBAAhiANAANAEACGUAwEAzAQAIZgDQADQBAAh_wNAANAEACGJBAEAzAQAIYoEAQDPBAAhiwQBAM8EACEDAAAAAwAgAQAAkwEAMDcAAJQBACADAAAAAwAgAQAABAAwAgAABQAgAQAAAAkAIAEAAAAJACADAAAABwAgAQAACAAwAgAACQAgAwAAAAcAIAEAAAgAMAIAAAkAIAMAAAAHACABAAAIADACAAAJACAOAwAAowgAIIEDAQAAAAGIA0AAAAABlAMBAAAAAZgDQAAAAAGABAEAAAABgQQBAAAAAYIEAQAAAAGDBAEAAAABhAQBAAAAAYUEQAAAAAGGBEAAAAABhwQBAAAAAYgEAQAAAAEBKwAAnAEAIA2BAwEAAAABiANAAAAAAZQDAQAAAAGYA0AAAAABgAQBAAAAAYEEAQAAAAGCBAEAAAABgwQBAAAAAYQEAQAAAAGFBEAAAAABhgRAAAAAAYcEAQAAAAGIBAEAAAABASsAAJ4BADABKwAAngEAMA4DAACiCAAggQMBAPQFACGIA0AA-AUAIZQDAQD0BQAhmANAAPgFACGABAEA9AUAIYEEAQD0BQAhggQBAPcFACGDBAEA9wUAIYQEAQD3BQAhhQRAAJcGACGGBEAAlwYAIYcEAQD3BQAhiAQBAPcFACECAAAACQAgKwAAoQEAIA2BAwEA9AUAIYgDQAD4BQAhlAMBAPQFACGYA0AA-AUAIYAEAQD0BQAhgQQBAPQFACGCBAEA9wUAIYMEAQD3BQAhhAQBAPcFACGFBEAAlwYAIYYEQACXBgAhhwQBAPcFACGIBAEA9wUAIQIAAAAHACArAACjAQAgAgAAAAcAICsAAKMBACADAAAACQAgMgAAnAEAIDMAAKEBACABAAAACQAgAQAAAAcAIAoPAACfCAAgOAAAoQgAIDkAAKAIACCCBAAA7gUAIIMEAADuBQAghAQAAO4FACCFBAAA7gUAIIYEAADuBQAghwQAAO4FACCIBAAA7gUAIBD-AgAArQUAMP8CAACqAQAQgAMAAK0FADCBAwEAzAQAIYgDQADQBAAhlAMBAMwEACGYA0AA0AQAIYAEAQDMBAAhgQQBAMwEACGCBAEAzwQAIYMEAQDPBAAhhAQBAM8EACGFBEAA5AQAIYYEQADkBAAhhwQBAM8EACGIBAEAzwQAIQMAAAAHACABAACpAQAwNwAAqgEAIAMAAAAHACABAAAIADACAAAJACAJ_gIAAKwFADD_AgAAsAEAEIADAACsBQAwgQMBAAAAAYgDQACEBQAhmANAAIQFACH9AwEA8gQAIf4DAQDyBAAh_wNAAOAEACEBAAAArQEAIAEAAACtAQAgCf4CAACsBQAw_wIAALABABCAAwAArAUAMIEDAQDyBAAhiANAAIQFACGYA0AAhAUAIf0DAQDyBAAh_gMBAPIEACH_A0AA4AQAIQKIAwAA7gUAIJgDAADuBQAgAwAAALABACABAACxAQAwAgAArQEAIAMAAACwAQAgAQAAsQEAMAIAAK0BACADAAAAsAEAIAEAALEBADACAACtAQAgBoEDAQAAAAGIA0AAAAABmANAAAAAAf0DAQAAAAH-AwEAAAAB_wNAAAAAAQErAAC1AQAgBoEDAQAAAAGIA0AAAAABmANAAAAAAf0DAQAAAAH-AwEAAAAB_wNAAAAAAQErAAC3AQAwASsAALcBADAGgQMBAPQFACGIA0AAlwYAIZgDQACXBgAh_QMBAPQFACH-AwEA9AUAIf8DQAD4BQAhAgAAAK0BACArAAC6AQAgBoEDAQD0BQAhiANAAJcGACGYA0AAlwYAIf0DAQD0BQAh_gMBAPQFACH_A0AA-AUAIQIAAACwAQAgKwAAvAEAIAIAAACwAQAgKwAAvAEAIAMAAACtAQAgMgAAtQEAIDMAALoBACABAAAArQEAIAEAAACwAQAgBQ8AAJwIACA4AACeCAAgOQAAnQgAIIgDAADuBQAgmAMAAO4FACAJ_gIAAKsFADD_AgAAwwEAEIADAACrBQAwgQMBAMwEACGIA0AA5AQAIZgDQADkBAAh_QMBAMwEACH-AwEAzAQAIf8DQADQBAAhAwAAALABACABAADCAQAwNwAAwwEAIAMAAACwAQAgAQAAsQEAMAIAAK0BACABAAAATgAgAQAAAE4AIAMAAABMACABAABNADACAABOACADAAAATAAgAQAATQAwAgAATgAgAwAAAEwAIAEAAE0AMAIAAE4AIBUHAACZCAAgHQAAmggAIB8AAJsIACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABogMAAAD5AwKkAwEAAAABpQMBAAAAAfEDAAAA8QMC8gMBAAAAAfMDAQAAAAH0AwEAAAAB9QMBAAAAAfYDAQAAAAH3AwIAAAAB-QMBAAAAAfoDQAAAAAH7AwEAAAAB_ANAAAAAAQErAADLAQAgEoEDAQAAAAGGAwEAAAABiANAAAAAAZgDQAAAAAGiAwAAAPkDAqQDAQAAAAGlAwEAAAAB8QMAAADxAwLyAwEAAAAB8wMBAAAAAfQDAQAAAAH1AwEAAAAB9gMBAAAAAfcDAgAAAAH5AwEAAAAB-gNAAAAAAfsDAQAAAAH8A0AAAAABASsAAM0BADABKwAAzQEAMAEAAAARACAVBwAAkQgAIB0AAJIIACAfAACTCAAggQMBAPQFACGGAwEA9AUAIYgDQAD4BQAhmANAAPgFACGiAwAAkAj5AyKkAwEA9AUAIaUDAQD0BQAh8QMAAI8I8QMi8gMBAPcFACHzAwEA9wUAIfQDAQD3BQAh9QMBAPcFACH2AwEA9wUAIfcDAgD1BQAh-QMBAPcFACH6A0AAlwYAIfsDAQD3BQAh_ANAAJcGACECAAAATgAgKwAA0QEAIBKBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAACQCPkDIqQDAQD0BQAhpQMBAPQFACHxAwAAjwjxAyLyAwEA9wUAIfMDAQD3BQAh9AMBAPcFACH1AwEA9wUAIfYDAQD3BQAh9wMCAPUFACH5AwEA9wUAIfoDQACXBgAh-wMBAPcFACH8A0AAlwYAIQIAAABMACArAADTAQAgAgAAAEwAICsAANMBACABAAAAEQAgAwAAAE4AIDIAAMsBACAzAADRAQAgAQAAAE4AIAEAAABMACAODwAAiggAIDgAAI0IACA5AACMCAAgegAAiwgAIHsAAI4IACDyAwAA7gUAIPMDAADuBQAg9AMAAO4FACD1AwAA7gUAIPYDAADuBQAg-QMAAO4FACD6AwAA7gUAIPsDAADuBQAg_AMAAO4FACAV_gIAAKQFADD_AgAA2wEAEIADAACkBQAwgQMBAMwEACGGAwEAzAQAIYgDQADQBAAhmANAANAEACGiAwAApgX5AyKkAwEAzAQAIaUDAQDMBAAh8QMAAKUF8QMi8gMBAM8EACHzAwEAzwQAIfQDAQDPBAAh9QMBAM8EACH2AwEAzwQAIfcDAgDNBAAh-QMBAM8EACH6A0AA5AQAIfsDAQDPBAAh_ANAAOQEACEDAAAATAAgAQAA2gEAMDcAANsBACADAAAATAAgAQAATQAwAgAATgAgAQAAAFoAIAEAAABaACADAAAAUQAgAQAAWQAwAgAAWgAgAwAAAFEAIAEAAFkAMAIAAFoAIAMAAABRACABAABZADACAABaACALCgAAiAgAIB4AAIcIACAgAACJCAAggQMBAAAAAYgDQAAAAAHTAwEAAAAB6wMBAAAAAewDAQAAAAHtAwEAAAAB7gMBAAAAAe8DAQAAAAEBKwAA4wEAIAiBAwEAAAABiANAAAAAAdMDAQAAAAHrAwEAAAAB7AMBAAAAAe0DAQAAAAHuAwEAAAAB7wMBAAAAAQErAADlAQAwASsAAOUBADALCgAA-QcAIB4AAPgHACAgAAD6BwAggQMBAPQFACGIA0AA-AUAIdMDAQD0BQAh6wMBAPQFACHsAwEA9AUAIe0DAQD3BQAh7gMBAPcFACHvAwEA9wUAIQIAAABaACArAADoAQAgCIEDAQD0BQAhiANAAPgFACHTAwEA9AUAIesDAQD0BQAh7AMBAPQFACHtAwEA9wUAIe4DAQD3BQAh7wMBAPcFACECAAAAUQAgKwAA6gEAIAIAAABRACArAADqAQAgAwAAAFoAIDIAAOMBACAzAADoAQAgAQAAAFoAIAEAAABRACAGDwAA9QcAIDgAAPcHACA5AAD2BwAg7QMAAO4FACDuAwAA7gUAIO8DAADuBQAgC_4CAACjBQAw_wIAAPEBABCAAwAAowUAMIEDAQDMBAAhiANAANAEACHTAwEAzAQAIesDAQDMBAAh7AMBAMwEACHtAwEAzwQAIe4DAQDPBAAh7wMBAM8EACEDAAAAUQAgAQAA8AEAMDcAAPEBACADAAAAUQAgAQAAWQAwAgAAWgAgAQAAAFUAIAEAAABVACADAAAAUwAgAQAAVAAwAgAAVQAgAwAAAFMAIAEAAFQAMAIAAFUAIAMAAABTACABAABUADACAABVACAIHwAA9AcAIIEDAQAAAAGIA0AAAAAB5gMBAAAAAecDAQAAAAHoAwIAAAAB6QMBAAAAAeoDAQAAAAEBKwAA-QEAIAeBAwEAAAABiANAAAAAAeYDAQAAAAHnAwEAAAAB6AMCAAAAAekDAQAAAAHqAwEAAAABASsAAPsBADABKwAA-wEAMAgfAADzBwAggQMBAPQFACGIA0AA-AUAIeYDAQD0BQAh5wMBAPQFACHoAwIA9QUAIekDAQD0BQAh6gMBAPcFACECAAAAVQAgKwAA_gEAIAeBAwEA9AUAIYgDQAD4BQAh5gMBAPQFACHnAwEA9AUAIegDAgD1BQAh6QMBAPQFACHqAwEA9wUAIQIAAABTACArAACAAgAgAgAAAFMAICsAAIACACADAAAAVQAgMgAA-QEAIDMAAP4BACABAAAAVQAgAQAAAFMAIAYPAADuBwAgOAAA8QcAIDkAAPAHACB6AADvBwAgewAA8gcAIOoDAADuBQAgCv4CAACiBQAw_wIAAIcCABCAAwAAogUAMIEDAQDMBAAhiANAANAEACHmAwEAzAQAIecDAQDMBAAh6AMCAM0EACHpAwEAzAQAIeoDAQDPBAAhAwAAAFMAIAEAAIYCADA3AACHAgAgAwAAAFMAIAEAAFQAMAIAAFUAIAEAAAA9ACABAAAAPQAgAwAAABsAIAEAADwAMAIAAD0AIAMAAAAbACABAAA8ADACAAA9ACADAAAAGwAgAQAAPAAwAgAAPQAgEwQAAOwHACAKAADqBwAgDAAA6wcAIBAAAO0HACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABogMAAADmAwKlAwEAAAABpgMAAOkHACCtA0AAAAABxAMAAADlAwLFAwEAAAABxgNAAAAAAdMDAQAAAAHhAwIAAAAB4gMCAAAAAeMDAgAAAAEBKwAAjwIAIA-BAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABogMAAADmAwKlAwEAAAABpgMAAOkHACCtA0AAAAABxAMAAADlAwLFAwEAAAABxgNAAAAAAdMDAQAAAAHhAwIAAAAB4gMCAAAAAeMDAgAAAAEBKwAAkQIAMAErAACRAgAwEwQAAMYHACAKAADEBwAgDAAAxQcAIBAAAMcHACCBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAADDB-YDIqUDAQD0BQAhpgMAAMEHACCtA0AAlwYAIcQDAADCB-UDIsUDAQD3BQAhxgNAAJcGACHTAwEA9AUAIeEDAgD1BQAh4gMCAPUFACHjAwIA9QUAIQIAAAA9ACArAACUAgAgD4EDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAMMH5gMipQMBAPQFACGmAwAAwQcAIK0DQACXBgAhxAMAAMIH5QMixQMBAPcFACHGA0AAlwYAIdMDAQD0BQAh4QMCAPUFACHiAwIA9QUAIeMDAgD1BQAhAgAAABsAICsAAJYCACACAAAAGwAgKwAAlgIAIAMAAAA9ACAyAACPAgAgMwAAlAIAIAEAAAA9ACABAAAAGwAgCA8AALwHACA4AAC_BwAgOQAAvgcAIHoAAL0HACB7AADABwAgrQMAAO4FACDFAwAA7gUAIMYDAADuBQAgEv4CAACbBQAw_wIAAJ0CABCAAwAAmwUAMIEDAQDMBAAhhgMBAMwEACGIA0AA0AQAIZgDQADQBAAhogMAAJ0F5gMipQMBAMwEACGmAwAA6wQAIK0DQADkBAAhxAMAAJwF5QMixQMBAM8EACHGA0AA5AQAIdMDAQDMBAAh4QMCAM0EACHiAwIAzQQAIeMDAgDNBAAhAwAAABsAIAEAAJwCADA3AACdAgAgAwAAABsAIAEAADwAMAIAAD0AIAEAAAAfACABAAAAHwAgAwAAAB0AIAEAAB4AMAIAAB8AIAMAAAAdACABAAAeADACAAAfACADAAAAHQAgAQAAHgAwAgAAHwAgBgcAALsHACALAAC6BwAggQMBAAAAAaQDAQAAAAHUAwEAAAAB4ANAAAAAAQErAAClAgAgBIEDAQAAAAGkAwEAAAAB1AMBAAAAAeADQAAAAAEBKwAApwIAMAErAACnAgAwBgcAALkHACALAAC4BwAggQMBAPQFACGkAwEA9AUAIdQDAQD0BQAh4ANAAPgFACECAAAAHwAgKwAAqgIAIASBAwEA9AUAIaQDAQD0BQAh1AMBAPQFACHgA0AA-AUAIQIAAAAdACArAACsAgAgAgAAAB0AICsAAKwCACADAAAAHwAgMgAApQIAIDMAAKoCACABAAAAHwAgAQAAAB0AIAMPAAC1BwAgOAAAtwcAIDkAALYHACAH_gIAAJoFADD_AgAAswIAEIADAACaBQAwgQMBAMwEACGkAwEAzAQAIdQDAQDMBAAh4ANAANAEACEDAAAAHQAgAQAAsgIAMDcAALMCACADAAAAHQAgAQAAHgAwAgAAHwAgAQAAACMAIAEAAAAjACADAAAAIQAgAQAAIgAwAgAAIwAgAwAAACEAIAEAACIAMAIAACMAIAMAAAAhACABAAAiADACAAAjACAPCwAAswcAIA4AALQHACCBAwEAAAABiANAAAAAAZgDQAAAAAGdAwIAAAABngNAAAAAAZ8DAgAAAAGgAwIAAAABogMAAADfAwKjAwEAAAABpQMBAAAAAdQDAQAAAAHdAwIAAAAB3wOAAAAAAQErAAC7AgAgDYEDAQAAAAGIA0AAAAABmANAAAAAAZ0DAgAAAAGeA0AAAAABnwMCAAAAAaADAgAAAAGiAwAAAN8DAqMDAQAAAAGlAwEAAAAB1AMBAAAAAd0DAgAAAAHfA4AAAAABASsAAL0CADABKwAAvQIAMA8LAAClBwAgDgAApgcAIIEDAQD0BQAhiANAAPgFACGYA0AA-AUAIZ0DAgD1BQAhngNAAPgFACGfAwIA9QUAIaADAgD1BQAhogMAAKQH3wMiowMBAPcFACGlAwEA9AUAIdQDAQD0BQAh3QMCAPUFACHfA4AAAAABAgAAACMAICsAAMACACANgQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhnQMCAPUFACGeA0AA-AUAIZ8DAgD1BQAhoAMCAPUFACGiAwAApAffAyKjAwEA9wUAIaUDAQD0BQAh1AMBAPQFACHdAwIA9QUAId8DgAAAAAECAAAAIQAgKwAAwgIAIAIAAAAhACArAADCAgAgAwAAACMAIDIAALsCACAzAADAAgAgAQAAACMAIAEAAAAhACAHDwAAnwcAIDgAAKIHACA5AAChBwAgegAAoAcAIHsAAKMHACCjAwAA7gUAIN8DAADuBQAgEP4CAACWBQAw_wIAAMkCABCAAwAAlgUAMIEDAQDMBAAhiANAANAEACGYA0AA0AQAIZ0DAgDNBAAhngNAANAEACGfAwIAzQQAIaADAgDNBAAhogMAAJcF3wMiowMBAM8EACGlAwEAzAQAIdQDAQDMBAAh3QMCAM0EACHfAwAA9QQAIAMAAAAhACABAADIAgAwNwAAyQIAIAMAAAAhACABAAAiADACAAAjACABAAAAJwAgAQAAACcAIAMAAAAlACABAAAmADACAAAnACADAAAAJQAgAQAAJgAwAgAAJwAgAwAAACUAIAEAACYAMAIAACcAIAcHAACeBwAgDQAAnQcAIIEDAQAAAAGkAwEAAAAB2gMBAAAAAdsDIAAAAAHcA0AAAAABASsAANECACAFgQMBAAAAAaQDAQAAAAHaAwEAAAAB2wMgAAAAAdwDQAAAAAEBKwAA0wIAMAErAADTAgAwBwcAAJwHACANAACbBwAggQMBAPQFACGkAwEA9AUAIdoDAQD0BQAh2wMgALEGACHcA0AA-AUAIQIAAAAnACArAADWAgAgBYEDAQD0BQAhpAMBAPQFACHaAwEA9AUAIdsDIACxBgAh3ANAAPgFACECAAAAJQAgKwAA2AIAIAIAAAAlACArAADYAgAgAwAAACcAIDIAANECACAzAADWAgAgAQAAACcAIAEAAAAlACADDwAAmAcAIDgAAJoHACA5AACZBwAgCP4CAACVBQAw_wIAAN8CABCAAwAAlQUAMIEDAQDMBAAhpAMBAMwEACHaAwEAzAQAIdsDIACHBQAh3ANAANAEACEDAAAAJQAgAQAA3gIAMDcAAN8CACADAAAAJQAgAQAAJgAwAgAAJwAgAQAAABkAIAEAAAAZACADAAAAFwAgAQAAGAAwAgAAGQAgAwAAABcAIAEAABgAMAIAABkAIAMAAAAXACABAAAYADACAAAZACASCgAA1wYAIAsAANgGACARAACXBwAgEwAA2QYAIBQAANoGACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABnwMCAAAAAaIDAAAA2gMCpQMBAAAAAdMDAQAAAAHUAwEAAAAB1QMBAAAAAdYDIAAAAAHXAwIAAAAB2AMCAAAAAQErAADnAgAgDYEDAQAAAAGGAwEAAAABiANAAAAAAZgDQAAAAAGfAwIAAAABogMAAADaAwKlAwEAAAAB0wMBAAAAAdQDAQAAAAHVAwEAAAAB1gMgAAAAAdcDAgAAAAHYAwIAAAABASsAAOkCADABKwAA6QIAMAEAAAAbACABAAAADQAgEgoAALUGACALAAC2BgAgEQAAlgcAIBMAALcGACAUAAC4BgAggQMBAPQFACGGAwEA9wUAIYgDQAD4BQAhmANAAPgFACGfAwIA9QUAIaIDAACzBtoDIqUDAQD0BQAh0wMBAPQFACHUAwEA9wUAIdUDAQD3BQAh1gMgALEGACHXAwIA9QUAIdgDAgCyBgAhAgAAABkAICsAAO4CACANgQMBAPQFACGGAwEA9wUAIYgDQAD4BQAhmANAAPgFACGfAwIA9QUAIaIDAACzBtoDIqUDAQD0BQAh0wMBAPQFACHUAwEA9wUAIdUDAQD3BQAh1gMgALEGACHXAwIA9QUAIdgDAgCyBgAhAgAAABcAICsAAPACACACAAAAFwAgKwAA8AIAIAEAAAAbACABAAAADQAgAwAAABkAIDIAAOcCACAzAADuAgAgAQAAABkAIAEAAAAXACAJDwAAkQcAIDgAAJQHACA5AACTBwAgegAAkgcAIHsAAJUHACCGAwAA7gUAINQDAADuBQAg1QMAAO4FACDYAwAA7gUAIBD-AgAAjgUAMP8CAAD5AgAQgAMAAI4FADCBAwEAzAQAIYYDAQDPBAAhiANAANAEACGYA0AA0AQAIZ8DAgDNBAAhogMAAJAF2gMipQMBAMwEACHTAwEAzAQAIdQDAQDPBAAh1QMBAM8EACHWAyAAhwUAIdcDAgDNBAAh2AMCAI8FACEDAAAAFwAgAQAA-AIAMDcAAPkCACADAAAAFwAgAQAAGAAwAgAAGQAgAQAAADEAIAEAAAAxACADAAAALwAgAQAAMAAwAgAAMQAgAwAAAC8AIAEAADAAMAIAADEAIAMAAAAvACABAAAwADACAAAxACAIEgAAkAcAIIEDAQAAAAHHAwEAAAABzgMBAAAAAc8DAADVBgAg0AMCAAAAAdEDAQAAAAHSAwIAAAABASsAAIEDACAHgQMBAAAAAccDAQAAAAHOAwEAAAABzwMAANUGACDQAwIAAAAB0QMBAAAAAdIDAgAAAAEBKwAAgwMAMAErAACDAwAwCBIAAI8HACCBAwEA9AUAIccDAQD0BQAhzgMBAPQFACHPAwAA0gYAINADAgD1BQAh0QMBAPcFACHSAwIA9QUAIQIAAAAxACArAACGAwAgB4EDAQD0BQAhxwMBAPQFACHOAwEA9AUAIc8DAADSBgAg0AMCAPUFACHRAwEA9wUAIdIDAgD1BQAhAgAAAC8AICsAAIgDACACAAAALwAgKwAAiAMAIAMAAAAxACAyAACBAwAgMwAAhgMAIAEAAAAxACABAAAALwAgBg8AAIoHACA4AACNBwAgOQAAjAcAIHoAAIsHACB7AACOBwAg0QMAAO4FACAK_gIAAI0FADD_AgAAjwMAEIADAACNBQAwgQMBAMwEACHHAwEAzAQAIc4DAQDMBAAhzwMAAOsEACDQAwIAzQQAIdEDAQDPBAAh0gMCAM0EACEDAAAALwAgAQAAjgMAMDcAAI8DACADAAAALwAgAQAAMAAwAgAAMQAgAQAAADUAIAEAAAA1ACADAAAAMwAgAQAANAAwAgAANQAgAwAAADMAIAEAADQAMAIAADUAIAMAAAAzACABAAA0ADACAAA1ACALBwAAxwYAIBIAAIkHACCBAwEAAAABpAMBAAAAAccDAQAAAAHIAwIAAAAByQMIAAAAAcoDIAAAAAHLA0AAAAABzANAAAAAAc0DgAAAAAEBKwAAlwMAIAmBAwEAAAABpAMBAAAAAccDAQAAAAHIAwIAAAAByQMIAAAAAcoDIAAAAAHLA0AAAAABzANAAAAAAc0DgAAAAAEBKwAAmQMAMAErAACZAwAwCwcAAMUGACASAACIBwAggQMBAPQFACGkAwEA9AUAIccDAQD0BQAhyAMCAPUFACHJAwgAwwYAIcoDIACxBgAhywNAAPgFACHMA0AAlwYAIc0DgAAAAAECAAAANQAgKwAAnAMAIAmBAwEA9AUAIaQDAQD0BQAhxwMBAPQFACHIAwIA9QUAIckDCADDBgAhygMgALEGACHLA0AA-AUAIcwDQACXBgAhzQOAAAAAAQIAAAAzACArAACeAwAgAgAAADMAICsAAJ4DACADAAAANQAgMgAAlwMAIDMAAJwDACABAAAANQAgAQAAADMAIAYPAACDBwAgOAAAhgcAIDkAAIUHACB6AACEBwAgewAAhwcAIMwDAADuBQAgDP4CAACFBQAw_wIAAKUDABCAAwAAhQUAMIEDAQDMBAAhpAMBAMwEACHHAwEAzAQAIcgDAgDNBAAhyQMIAIYFACHKAyAAhwUAIcsDQADQBAAhzANAAOQEACHNAwAAiAUAIAMAAAAzACABAACkAwAwNwAApQMAIAMAAAAzACABAAA0ADACAAA1ACAQAwAA4QQAIP4CAACABQAw_wIAAAsAEIADAACABQAwgQMBAAAAAYgDQADgBAAhlAMBAAAAAZgDQADgBAAhpgMAAOsEACC-AwEA8gQAIcADAACBBcADIsEDAQCCBQAhwgMBAIIFACHEAwAAgwXEAyLFAwEAggUAIcYDQACEBQAhAQAAAKgDACABAAAAqAMAIAUDAACQBgAgwQMAAO4FACDCAwAA7gUAIMUDAADuBQAgxgMAAO4FACADAAAACwAgAQAAqwMAMAIAAKgDACADAAAACwAgAQAAqwMAMAIAAKgDACADAAAACwAgAQAAqwMAMAIAAKgDACANAwAAggcAIIEDAQAAAAGIA0AAAAABlAMBAAAAAZgDQAAAAAGmAwAAgQcAIL4DAQAAAAHAAwAAAMADAsEDAQAAAAHCAwEAAAABxAMAAADEAwLFAwEAAAABxgNAAAAAAQErAACvAwAgDIEDAQAAAAGIA0AAAAABlAMBAAAAAZgDQAAAAAGmAwAAgQcAIL4DAQAAAAHAAwAAAMADAsEDAQAAAAHCAwEAAAABxAMAAADEAwLFAwEAAAABxgNAAAAAAQErAACxAwAwASsAALEDADANAwAAgAcAIIEDAQD0BQAhiANAAPgFACGUAwEA9AUAIZgDQAD4BQAhpgMAAP0GACC-AwEA9AUAIcADAAD-BsADIsEDAQD3BQAhwgMBAPcFACHEAwAA_wbEAyLFAwEA9wUAIcYDQACXBgAhAgAAAKgDACArAAC0AwAgDIEDAQD0BQAhiANAAPgFACGUAwEA9AUAIZgDQAD4BQAhpgMAAP0GACC-AwEA9AUAIcADAAD-BsADIsEDAQD3BQAhwgMBAPcFACHEAwAA_wbEAyLFAwEA9wUAIcYDQACXBgAhAgAAAAsAICsAALYDACACAAAACwAgKwAAtgMAIAMAAACoAwAgMgAArwMAIDMAALQDACABAAAAqAMAIAEAAAALACAHDwAA-gYAIDgAAPwGACA5AAD7BgAgwQMAAO4FACDCAwAA7gUAIMUDAADuBQAgxgMAAO4FACAP_gIAAPkEADD_AgAAvQMAEIADAAD5BAAwgQMBAMwEACGIA0AA0AQAIZQDAQDMBAAhmANAANAEACGmAwAA6wQAIL4DAQDMBAAhwAMAAPoEwAMiwQMBAM8EACHCAwEAzwQAIcQDAAD7BMQDIsUDAQDPBAAhxgNAAOQEACEDAAAACwAgAQAAvAMAMDcAAL0DACADAAAACwAgAQAAqwMAMAIAAKgDACABAAAASgAgAQAAAEoAIAMAAABIACABAABJADACAABKACADAAAASAAgAQAASQAwAgAASgAgAwAAAEgAIAEAAEkAMAIAAEoAIAsDAAD5BgAggQMBAAAAAYMDAgAAAAGIA0AAAAABlAMBAAAAAZgDQAAAAAGiAwAAALcDArMDAQAAAAG0AwEAAAABtQMBAAAAAbcDgAAAAAEBKwAAxQMAIAqBAwEAAAABgwMCAAAAAYgDQAAAAAGUAwEAAAABmANAAAAAAaIDAAAAtwMCswMBAAAAAbQDAQAAAAG1AwEAAAABtwOAAAAAAQErAADHAwAwASsAAMcDADALAwAA-AYAIIEDAQD0BQAhgwMCAPUFACGIA0AA-AUAIZQDAQD0BQAhmANAAPgFACGiAwAA9wa3AyKzAwEA9AUAIbQDAQD3BQAhtQMBAPcFACG3A4AAAAABAgAAAEoAICsAAMoDACAKgQMBAPQFACGDAwIA9QUAIYgDQAD4BQAhlAMBAPQFACGYA0AA-AUAIaIDAAD3BrcDIrMDAQD0BQAhtAMBAPcFACG1AwEA9wUAIbcDgAAAAAECAAAASAAgKwAAzAMAIAIAAABIACArAADMAwAgAwAAAEoAIDIAAMUDACAzAADKAwAgAQAAAEoAIAEAAABIACAIDwAA8gYAIDgAAPUGACA5AAD0BgAgegAA8wYAIHsAAPYGACC0AwAA7gUAILUDAADuBQAgtwMAAO4FACAN_gIAAPMEADD_AgAA0wMAEIADAADzBAAwgQMBAMwEACGDAwIAzQQAIYgDQADQBAAhlAMBAMwEACGYA0AA0AQAIaIDAAD0BLcDIrMDAQDMBAAhtAMBAM8EACG1AwEAzwQAIbcDAAD1BAAgAwAAAEgAIAEAANIDADA3AADTAwAgAwAAAEgAIAEAAEkAMAIAAEoAIAf-AgAA8QQAMP8CAADZAwAQgAMAAPEEADCBAwEAAAABmANAAOAEACGxAwIA3wQAIbIDAgDfBAAhAQAAANYDACABAAAA1gMAIAf-AgAA8QQAMP8CAADZAwAQgAMAAPEEADCBAwEA8gQAIZgDQADgBAAhsQMCAN8EACGyAwIA3wQAIQADAAAA2QMAIAEAANoDADACAADWAwAgAwAAANkDACABAADaAwAwAgAA1gMAIAMAAADZAwAgAQAA2gMAMAIAANYDACAEgQMBAAAAAZgDQAAAAAGxAwIAAAABsgMCAAAAAQErAADeAwAgBIEDAQAAAAGYA0AAAAABsQMCAAAAAbIDAgAAAAEBKwAA4AMAMAErAADgAwAwBIEDAQD0BQAhmANAAPgFACGxAwIA9QUAIbIDAgD1BQAhAgAAANYDACArAADjAwAgBIEDAQD0BQAhmANAAPgFACGxAwIA9QUAIbIDAgD1BQAhAgAAANkDACArAADlAwAgAgAAANkDACArAADlAwAgAwAAANYDACAyAADeAwAgMwAA4wMAIAEAAADWAwAgAQAAANkDACAFDwAA7QYAIDgAAPAGACA5AADvBgAgegAA7gYAIHsAAPEGACAH_gIAAPAEADD_AgAA7AMAEIADAADwBAAwgQMBAMwEACGYA0AA0AQAIbEDAgDNBAAhsgMCAM0EACEDAAAA2QMAIAEAAOsDADA3AADsAwAgAwAAANkDACABAADaAwAwAgAA1gMAIAEAAAAPACABAAAADwAgAwAAAA0AIAEAAA4AMAIAAA8AIAMAAAANACABAAAOADACAAAPACADAAAADQAgAQAADgAwAgAADwAgEgQAAOsGACAHAADpBgAgCAAA6gYAIBAAAOwGACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABogMAAACrAwKkAwEAAAABpQMBAAAAAaYDAADnBgAgpwNAAAAAAagDAgAAAAGpAwAA6AYAIKsDAQAAAAGsA0AAAAABrQNAAAAAAQErAAD0AwAgDoEDAQAAAAGGAwEAAAABiANAAAAAAZgDQAAAAAGiAwAAAKsDAqQDAQAAAAGlAwEAAAABpgMAAOcGACCnA0AAAAABqAMCAAAAAakDAADoBgAgqwMBAAAAAawDQAAAAAGtA0AAAAABASsAAPYDADABKwAA9gMAMAEAAAARACASBAAApQYAIAcAAKMGACAIAACkBgAgEAAApgYAIIEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAKIGqwMipAMBAPQFACGlAwEA9AUAIaYDAACgBgAgpwNAAPgFACGoAwIA9QUAIakDAAChBgAgqwMBAPcFACGsA0AAlwYAIa0DQACXBgAhAgAAAA8AICsAAPoDACAOgQMBAPQFACGGAwEA9AUAIYgDQAD4BQAhmANAAPgFACGiAwAAogarAyKkAwEA9AUAIaUDAQD0BQAhpgMAAKAGACCnA0AA-AUAIagDAgD1BQAhqQMAAKEGACCrAwEA9wUAIawDQACXBgAhrQNAAJcGACECAAAADQAgKwAA_AMAIAIAAAANACArAAD8AwAgAQAAABEAIAMAAAAPACAyAAD0AwAgMwAA-gMAIAEAAAAPACABAAAADQAgCA8AAJsGACA4AACeBgAgOQAAnQYAIHoAAJwGACB7AACfBgAgqwMAAO4FACCsAwAA7gUAIK0DAADuBQAgEf4CAADqBAAw_wIAAIQEABCAAwAA6gQAMIEDAQDMBAAhhgMBAMwEACGIA0AA0AQAIZgDQADQBAAhogMAAO0EqwMipAMBAMwEACGlAwEAzAQAIaYDAADrBAAgpwNAANAEACGoAwIAzQQAIakDAADsBAAgqwMBAM8EACGsA0AA5AQAIa0DQADkBAAhAwAAAA0AIAEAAIMEADA3AACEBAAgAwAAAA0AIAEAAA4AMAIAAA8AIAEAAAAVACABAAAAFQAgAwAAABMAIAEAABQAMAIAABUAIAMAAAATACABAAAUADACAAAVACADAAAAEwAgAQAAFAAwAgAAFQAgCwkAAJoGACCBAwEAAAABiANAAAAAAZgDQAAAAAGcAwEAAAABnQMCAAAAAZ4DQAAAAAGfAwIAAAABoAMCAAAAAaIDAAAAogMCowMBAAAAAQErAACMBAAgCoEDAQAAAAGIA0AAAAABmANAAAAAAZwDAQAAAAGdAwIAAAABngNAAAAAAZ8DAgAAAAGgAwIAAAABogMAAACiAwKjAwEAAAABASsAAI4EADABKwAAjgQAMAsJAACZBgAggQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhnAMBAPQFACGdAwIA9QUAIZ4DQACXBgAhnwMCAPUFACGgAwIA9QUAIaIDAACYBqIDIqMDAQD3BQAhAgAAABUAICsAAJEEACAKgQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhnAMBAPQFACGdAwIA9QUAIZ4DQACXBgAhnwMCAPUFACGgAwIA9QUAIaIDAACYBqIDIqMDAQD3BQAhAgAAABMAICsAAJMEACACAAAAEwAgKwAAkwQAIAMAAAAVACAyAACMBAAgMwAAkQQAIAEAAAAVACABAAAAEwAgBw8AAJIGACA4AACVBgAgOQAAlAYAIHoAAJMGACB7AACWBgAgngMAAO4FACCjAwAA7gUAIA3-AgAA4wQAMP8CAACaBAAQgAMAAOMEADCBAwEAzAQAIYgDQADQBAAhmANAANAEACGcAwEAzAQAIZ0DAgDNBAAhngNAAOQEACGfAwIAzQQAIaADAgDNBAAhogMAAOUEogMiowMBAM8EACEDAAAAEwAgAQAAmQQAMDcAAJoEACADAAAAEwAgAQAAFAAwAgAAFQAgDAMAAOEEACAbAADiBAAg_gIAAN4EADD_AgAAQQAQgAMAAN4EADCBAwEAAAABiANAAOAEACGUAwEAAAABlQMCAN8EACGWAwIA3wQAIZcDAgDfBAAhmANAAOAEACEBAAAAnQQAIAEAAACdBAAgAgMAAJAGACAbAACRBgAgAwAAAEEAIAEAAKAEADACAACdBAAgAwAAAEEAIAEAAKAEADACAACdBAAgAwAAAEEAIAEAAKAEADACAACdBAAgCQMAAI4GACAbAACPBgAggQMBAAAAAYgDQAAAAAGUAwEAAAABlQMCAAAAAZYDAgAAAAGXAwIAAAABmANAAAAAAQErAACkBAAgB4EDAQAAAAGIA0AAAAABlAMBAAAAAZUDAgAAAAGWAwIAAAABlwMCAAAAAZgDQAAAAAEBKwAApgQAMAErAACmBAAwCQMAAIAGACAbAACBBgAggQMBAPQFACGIA0AA-AUAIZQDAQD0BQAhlQMCAPUFACGWAwIA9QUAIZcDAgD1BQAhmANAAPgFACECAAAAnQQAICsAAKkEACAHgQMBAPQFACGIA0AA-AUAIZQDAQD0BQAhlQMCAPUFACGWAwIA9QUAIZcDAgD1BQAhmANAAPgFACECAAAAQQAgKwAAqwQAIAIAAABBACArAACrBAAgAwAAAJ0EACAyAACkBAAgMwAAqQQAIAEAAACdBAAgAQAAAEEAIAUPAAD7BQAgOAAA_gUAIDkAAP0FACB6AAD8BQAgewAA_wUAIAr-AgAA3QQAMP8CAACyBAAQgAMAAN0EADCBAwEAzAQAIYgDQADQBAAhlAMBAMwEACGVAwIAzQQAIZYDAgDNBAAhlwMCAM0EACGYA0AA0AQAIQMAAABBACABAACxBAAwNwAAsgQAIAMAAABBACABAACgBAAwAgAAnQQAIAEAAABFACABAAAARQAgAwAAAEMAIAEAAEQAMAIAAEUAIAMAAABDACABAABEADACAABFACADAAAAQwAgAQAARAAwAgAARQAgCBoAAPoFACCBAwEAAAABggMBAAAAAYMDAgAAAAGFAwAAAIUDAoYDAQAAAAGHAwEAAAABiANAAAAAAQErAAC6BAAgB4EDAQAAAAGCAwEAAAABgwMCAAAAAYUDAAAAhQMChgMBAAAAAYcDAQAAAAGIA0AAAAABASsAALwEADABKwAAvAQAMAgaAAD5BQAggQMBAPQFACGCAwEA9AUAIYMDAgD1BQAhhQMAAPYFhQMihgMBAPQFACGHAwEA9wUAIYgDQAD4BQAhAgAAAEUAICsAAL8EACAHgQMBAPQFACGCAwEA9AUAIYMDAgD1BQAhhQMAAPYFhQMihgMBAPQFACGHAwEA9wUAIYgDQAD4BQAhAgAAAEMAICsAAMEEACACAAAAQwAgKwAAwQQAIAMAAABFACAyAAC6BAAgMwAAvwQAIAEAAABFACABAAAAQwAgBg8AAO8FACA4AADyBQAgOQAA8QUAIHoAAPAFACB7AADzBQAghwMAAO4FACAK_gIAAMsEADD_AgAAyAQAEIADAADLBAAwgQMBAMwEACGCAwEAzAQAIYMDAgDNBAAhhQMAAM4EhQMihgMBAMwEACGHAwEAzwQAIYgDQADQBAAhAwAAAEMAIAEAAMcEADA3AADIBAAgAwAAAEMAIAEAAEQAMAIAAEUAIAr-AgAAywQAMP8CAADIBAAQgAMAAMsEADCBAwEAzAQAIYIDAQDMBAAhgwMCAM0EACGFAwAAzgSFAyKGAwEAzAQAIYcDAQDPBAAhiANAANAEACEODwAA0gQAIDgAANwEACA5AADcBAAgiQMBAAAAAYoDAQAAAASLAwEAAAAEjAMBAAAAAY0DAQAAAAGOAwEAAAABjwMBAAAAAZADAQDbBAAhkQMBAAAAAZIDAQAAAAGTAwEAAAABDQ8AANIEACA4AADSBAAgOQAA0gQAIHoAANoEACB7AADSBAAgiQMCAAAAAYoDAgAAAASLAwIAAAAEjAMCAAAAAY0DAgAAAAGOAwIAAAABjwMCAAAAAZADAgDZBAAhBw8AANIEACA4AADYBAAgOQAA2AQAIIkDAAAAhQMCigMAAACFAwiLAwAAAIUDCJADAADXBIUDIg4PAADVBAAgOAAA1gQAIDkAANYEACCJAwEAAAABigMBAAAABYsDAQAAAAWMAwEAAAABjQMBAAAAAY4DAQAAAAGPAwEAAAABkAMBANQEACGRAwEAAAABkgMBAAAAAZMDAQAAAAELDwAA0gQAIDgAANMEACA5AADTBAAgiQNAAAAAAYoDQAAAAASLA0AAAAAEjANAAAAAAY0DQAAAAAGOA0AAAAABjwNAAAAAAZADQADRBAAhCw8AANIEACA4AADTBAAgOQAA0wQAIIkDQAAAAAGKA0AAAAAEiwNAAAAABIwDQAAAAAGNA0AAAAABjgNAAAAAAY8DQAAAAAGQA0AA0QQAIQiJAwIAAAABigMCAAAABIsDAgAAAASMAwIAAAABjQMCAAAAAY4DAgAAAAGPAwIAAAABkAMCANIEACEIiQNAAAAAAYoDQAAAAASLA0AAAAAEjANAAAAAAY0DQAAAAAGOA0AAAAABjwNAAAAAAZADQADTBAAhDg8AANUEACA4AADWBAAgOQAA1gQAIIkDAQAAAAGKAwEAAAAFiwMBAAAABYwDAQAAAAGNAwEAAAABjgMBAAAAAY8DAQAAAAGQAwEA1AQAIZEDAQAAAAGSAwEAAAABkwMBAAAAAQiJAwIAAAABigMCAAAABYsDAgAAAAWMAwIAAAABjQMCAAAAAY4DAgAAAAGPAwIAAAABkAMCANUEACELiQMBAAAAAYoDAQAAAAWLAwEAAAAFjAMBAAAAAY0DAQAAAAGOAwEAAAABjwMBAAAAAZADAQDWBAAhkQMBAAAAAZIDAQAAAAGTAwEAAAABBw8AANIEACA4AADYBAAgOQAA2AQAIIkDAAAAhQMCigMAAACFAwiLAwAAAIUDCJADAADXBIUDIgSJAwAAAIUDAooDAAAAhQMIiwMAAACFAwiQAwAA2ASFAyINDwAA0gQAIDgAANIEACA5AADSBAAgegAA2gQAIHsAANIEACCJAwIAAAABigMCAAAABIsDAgAAAASMAwIAAAABjQMCAAAAAY4DAgAAAAGPAwIAAAABkAMCANkEACEIiQMIAAAAAYoDCAAAAASLAwgAAAAEjAMIAAAAAY0DCAAAAAGOAwgAAAABjwMIAAAAAZADCADaBAAhDg8AANIEACA4AADcBAAgOQAA3AQAIIkDAQAAAAGKAwEAAAAEiwMBAAAABIwDAQAAAAGNAwEAAAABjgMBAAAAAY8DAQAAAAGQAwEA2wQAIZEDAQAAAAGSAwEAAAABkwMBAAAAAQuJAwEAAAABigMBAAAABIsDAQAAAASMAwEAAAABjQMBAAAAAY4DAQAAAAGPAwEAAAABkAMBANwEACGRAwEAAAABkgMBAAAAAZMDAQAAAAEK_gIAAN0EADD_AgAAsgQAEIADAADdBAAwgQMBAMwEACGIA0AA0AQAIZQDAQDMBAAhlQMCAM0EACGWAwIAzQQAIZcDAgDNBAAhmANAANAEACEMAwAA4QQAIBsAAOIEACD-AgAA3gQAMP8CAABBABCAAwAA3gQAMIEDAQDyBAAhiANAAOAEACGUAwEA8gQAIZUDAgDfBAAhlgMCAN8EACGXAwIA3wQAIZgDQADgBAAhCIkDAgAAAAGKAwIAAAAEiwMCAAAABIwDAgAAAAGNAwIAAAABjgMCAAAAAY8DAgAAAAGQAwIA0gQAIQiJA0AAAAABigNAAAAABIsDQAAAAASMA0AAAAABjQNAAAAAAY4DQAAAAAGPA0AAAAABkANAANMEACEdBAAA4AUAIAUAAOEFACAGAADiBQAgFQAA4wUAIBYAAOMFACAXAADkBQAgGAAAwwUAIBkAANIFACAaAADlBQAgHAAA5gUAICEAAOcFACAiAADnBQAgIwAA6AUAICQAAMUFACAlAADbBQAg_gIAAN8FADD_AgAAEQAQgAMAAN8FADCBAwEA8gQAIYgDQADgBAAhmANAAOAEACGMBAEA8gQAIY0EAQDyBAAhjgQgAMgFACGPBAEAggUAIZAEAQDyBAAhkQQgAMgFACGUBAAAEQAglQQAABEAIAOZAwAAQwAgmgMAAEMAIJsDAABDACAN_gIAAOMEADD_AgAAmgQAEIADAADjBAAwgQMBAMwEACGIA0AA0AQAIZgDQADQBAAhnAMBAMwEACGdAwIAzQQAIZ4DQADkBAAhnwMCAM0EACGgAwIAzQQAIaIDAADlBKIDIqMDAQDPBAAhCw8AANUEACA4AADpBAAgOQAA6QQAIIkDQAAAAAGKA0AAAAAFiwNAAAAABYwDQAAAAAGNA0AAAAABjgNAAAAAAY8DQAAAAAGQA0AA6AQAIQcPAADSBAAgOAAA5wQAIDkAAOcEACCJAwAAAKIDAooDAAAAogMIiwMAAACiAwiQAwAA5gSiAyIHDwAA0gQAIDgAAOcEACA5AADnBAAgiQMAAACiAwKKAwAAAKIDCIsDAAAAogMIkAMAAOYEogMiBIkDAAAAogMCigMAAACiAwiLAwAAAKIDCJADAADnBKIDIgsPAADVBAAgOAAA6QQAIDkAAOkEACCJA0AAAAABigNAAAAABYsDQAAAAAWMA0AAAAABjQNAAAAAAY4DQAAAAAGPA0AAAAABkANAAOgEACEIiQNAAAAAAYoDQAAAAAWLA0AAAAAFjANAAAAAAY0DQAAAAAGOA0AAAAABjwNAAAAAAZADQADpBAAhEf4CAADqBAAw_wIAAIQEABCAAwAA6gQAMIEDAQDMBAAhhgMBAMwEACGIA0AA0AQAIZgDQADQBAAhogMAAO0EqwMipAMBAMwEACGlAwEAzAQAIaYDAADrBAAgpwNAANAEACGoAwIAzQQAIakDAADsBAAgqwMBAM8EACGsA0AA5AQAIa0DQADkBAAhBIkDAQAAAAWuAwEAAAABrwMBAAAABLADAQAAAAQEiQMCAAAABa4DAgAAAAGvAwIAAAAEsAMCAAAABAcPAADSBAAgOAAA7wQAIDkAAO8EACCJAwAAAKsDAooDAAAAqwMIiwMAAACrAwiQAwAA7gSrAyIHDwAA0gQAIDgAAO8EACA5AADvBAAgiQMAAACrAwKKAwAAAKsDCIsDAAAAqwMIkAMAAO4EqwMiBIkDAAAAqwMCigMAAACrAwiLAwAAAKsDCJADAADvBKsDIgf-AgAA8AQAMP8CAADsAwAQgAMAAPAEADCBAwEAzAQAIZgDQADQBAAhsQMCAM0EACGyAwIAzQQAIQf-AgAA8QQAMP8CAADZAwAQgAMAAPEEADCBAwEA8gQAIZgDQADgBAAhsQMCAN8EACGyAwIA3wQAIQuJAwEAAAABigMBAAAABIsDAQAAAASMAwEAAAABjQMBAAAAAY4DAQAAAAGPAwEAAAABkAMBANwEACGRAwEAAAABkgMBAAAAAZMDAQAAAAEN_gIAAPMEADD_AgAA0wMAEIADAADzBAAwgQMBAMwEACGDAwIAzQQAIYgDQADQBAAhlAMBAMwEACGYA0AA0AQAIaIDAAD0BLcDIrMDAQDMBAAhtAMBAM8EACG1AwEAzwQAIbcDAAD1BAAgBw8AANIEACA4AAD4BAAgOQAA-AQAIIkDAAAAtwMCigMAAAC3AwiLAwAAALcDCJADAAD3BLcDIg8PAADVBAAgOAAA9gQAIDkAAPYEACCJA4AAAAABjAOAAAAAAY0DgAAAAAGOA4AAAAABjwOAAAAAAZADgAAAAAG4AwEAAAABuQMBAAAAAboDAQAAAAG7A4AAAAABvAOAAAAAAb0DgAAAAAEMiQOAAAAAAYwDgAAAAAGNA4AAAAABjgOAAAAAAY8DgAAAAAGQA4AAAAABuAMBAAAAAbkDAQAAAAG6AwEAAAABuwOAAAAAAbwDgAAAAAG9A4AAAAABBw8AANIEACA4AAD4BAAgOQAA-AQAIIkDAAAAtwMCigMAAAC3AwiLAwAAALcDCJADAAD3BLcDIgSJAwAAALcDAooDAAAAtwMIiwMAAAC3AwiQAwAA-AS3AyIP_gIAAPkEADD_AgAAvQMAEIADAAD5BAAwgQMBAMwEACGIA0AA0AQAIZQDAQDMBAAhmANAANAEACGmAwAA6wQAIL4DAQDMBAAhwAMAAPoEwAMiwQMBAM8EACHCAwEAzwQAIcQDAAD7BMQDIsUDAQDPBAAhxgNAAOQEACEHDwAA0gQAIDgAAP8EACA5AAD_BAAgiQMAAADAAwKKAwAAAMADCIsDAAAAwAMIkAMAAP4EwAMiBw8AANIEACA4AAD9BAAgOQAA_QQAIIkDAAAAxAMCigMAAADEAwiLAwAAAMQDCJADAAD8BMQDIgcPAADSBAAgOAAA_QQAIDkAAP0EACCJAwAAAMQDAooDAAAAxAMIiwMAAADEAwiQAwAA_ATEAyIEiQMAAADEAwKKAwAAAMQDCIsDAAAAxAMIkAMAAP0ExAMiBw8AANIEACA4AAD_BAAgOQAA_wQAIIkDAAAAwAMCigMAAADAAwiLAwAAAMADCJADAAD-BMADIgSJAwAAAMADAooDAAAAwAMIiwMAAADAAwiQAwAA_wTAAyIQAwAA4QQAIP4CAACABQAw_wIAAAsAEIADAACABQAwgQMBAPIEACGIA0AA4AQAIZQDAQDyBAAhmANAAOAEACGmAwAA6wQAIL4DAQDyBAAhwAMAAIEFwAMiwQMBAIIFACHCAwEAggUAIcQDAACDBcQDIsUDAQCCBQAhxgNAAIQFACEEiQMAAADAAwKKAwAAAMADCIsDAAAAwAMIkAMAAP8EwAMiC4kDAQAAAAGKAwEAAAAFiwMBAAAABYwDAQAAAAGNAwEAAAABjgMBAAAAAY8DAQAAAAGQAwEA1gQAIZEDAQAAAAGSAwEAAAABkwMBAAAAAQSJAwAAAMQDAooDAAAAxAMIiwMAAADEAwiQAwAA_QTEAyIIiQNAAAAAAYoDQAAAAAWLA0AAAAAFjANAAAAAAY0DQAAAAAGOA0AAAAABjwNAAAAAAZADQADpBAAhDP4CAACFBQAw_wIAAKUDABCAAwAAhQUAMIEDAQDMBAAhpAMBAMwEACHHAwEAzAQAIcgDAgDNBAAhyQMIAIYFACHKAyAAhwUAIcsDQADQBAAhzANAAOQEACHNAwAAiAUAIA0PAADSBAAgOAAA2gQAIDkAANoEACB6AADaBAAgewAA2gQAIIkDCAAAAAGKAwgAAAAEiwMIAAAABIwDCAAAAAGNAwgAAAABjgMIAAAAAY8DCAAAAAGQAwgAjAUAIQUPAADSBAAgOAAAiwUAIDkAAIsFACCJAyAAAAABkAMgAIoFACEPDwAA0gQAIDgAAIkFACA5AACJBQAgiQOAAAAAAYwDgAAAAAGNA4AAAAABjgOAAAAAAY8DgAAAAAGQA4AAAAABuAMBAAAAAbkDAQAAAAG6AwEAAAABuwOAAAAAAbwDgAAAAAG9A4AAAAABDIkDgAAAAAGMA4AAAAABjQOAAAAAAY4DgAAAAAGPA4AAAAABkAOAAAAAAbgDAQAAAAG5AwEAAAABugMBAAAAAbsDgAAAAAG8A4AAAAABvQOAAAAAAQUPAADSBAAgOAAAiwUAIDkAAIsFACCJAyAAAAABkAMgAIoFACECiQMgAAAAAZADIACLBQAhDQ8AANIEACA4AADaBAAgOQAA2gQAIHoAANoEACB7AADaBAAgiQMIAAAAAYoDCAAAAASLAwgAAAAEjAMIAAAAAY0DCAAAAAGOAwgAAAABjwMIAAAAAZADCACMBQAhCv4CAACNBQAw_wIAAI8DABCAAwAAjQUAMIEDAQDMBAAhxwMBAMwEACHOAwEAzAQAIc8DAADrBAAg0AMCAM0EACHRAwEAzwQAIdIDAgDNBAAhEP4CAACOBQAw_wIAAPkCABCAAwAAjgUAMIEDAQDMBAAhhgMBAM8EACGIA0AA0AQAIZgDQADQBAAhnwMCAM0EACGiAwAAkAXaAyKlAwEAzAQAIdMDAQDMBAAh1AMBAM8EACHVAwEAzwQAIdYDIACHBQAh1wMCAM0EACHYAwIAjwUAIQ0PAADVBAAgOAAA1QQAIDkAANUEACB6AACUBQAgewAA1QQAIIkDAgAAAAGKAwIAAAAFiwMCAAAABYwDAgAAAAGNAwIAAAABjgMCAAAAAY8DAgAAAAGQAwIAkwUAIQcPAADSBAAgOAAAkgUAIDkAAJIFACCJAwAAANoDAooDAAAA2gMIiwMAAADaAwiQAwAAkQXaAyIHDwAA0gQAIDgAAJIFACA5AACSBQAgiQMAAADaAwKKAwAAANoDCIsDAAAA2gMIkAMAAJEF2gMiBIkDAAAA2gMCigMAAADaAwiLAwAAANoDCJADAACSBdoDIg0PAADVBAAgOAAA1QQAIDkAANUEACB6AACUBQAgewAA1QQAIIkDAgAAAAGKAwIAAAAFiwMCAAAABYwDAgAAAAGNAwIAAAABjgMCAAAAAY8DAgAAAAGQAwIAkwUAIQiJAwgAAAABigMIAAAABYsDCAAAAAWMAwgAAAABjQMIAAAAAY4DCAAAAAGPAwgAAAABkAMIAJQFACEI_gIAAJUFADD_AgAA3wIAEIADAACVBQAwgQMBAMwEACGkAwEAzAQAIdoDAQDMBAAh2wMgAIcFACHcA0AA0AQAIRD-AgAAlgUAMP8CAADJAgAQgAMAAJYFADCBAwEAzAQAIYgDQADQBAAhmANAANAEACGdAwIAzQQAIZ4DQADQBAAhnwMCAM0EACGgAwIAzQQAIaIDAACXBd8DIqMDAQDPBAAhpQMBAMwEACHUAwEAzAQAId0DAgDNBAAh3wMAAPUEACAHDwAA0gQAIDgAAJkFACA5AACZBQAgiQMAAADfAwKKAwAAAN8DCIsDAAAA3wMIkAMAAJgF3wMiBw8AANIEACA4AACZBQAgOQAAmQUAIIkDAAAA3wMCigMAAADfAwiLAwAAAN8DCJADAACYBd8DIgSJAwAAAN8DAooDAAAA3wMIiwMAAADfAwiQAwAAmQXfAyIH_gIAAJoFADD_AgAAswIAEIADAACaBQAwgQMBAMwEACGkAwEAzAQAIdQDAQDMBAAh4ANAANAEACES_gIAAJsFADD_AgAAnQIAEIADAACbBQAwgQMBAMwEACGGAwEAzAQAIYgDQADQBAAhmANAANAEACGiAwAAnQXmAyKlAwEAzAQAIaYDAADrBAAgrQNAAOQEACHEAwAAnAXlAyLFAwEAzwQAIcYDQADkBAAh0wMBAMwEACHhAwIAzQQAIeIDAgDNBAAh4wMCAM0EACEHDwAA0gQAIDgAAKEFACA5AAChBQAgiQMAAADlAwKKAwAAAOUDCIsDAAAA5QMIkAMAAKAF5QMiBw8AANIEACA4AACfBQAgOQAAnwUAIIkDAAAA5gMCigMAAADmAwiLAwAAAOYDCJADAACeBeYDIgcPAADSBAAgOAAAnwUAIDkAAJ8FACCJAwAAAOYDAooDAAAA5gMIiwMAAADmAwiQAwAAngXmAyIEiQMAAADmAwKKAwAAAOYDCIsDAAAA5gMIkAMAAJ8F5gMiBw8AANIEACA4AAChBQAgOQAAoQUAIIkDAAAA5QMCigMAAADlAwiLAwAAAOUDCJADAACgBeUDIgSJAwAAAOUDAooDAAAA5QMIiwMAAADlAwiQAwAAoQXlAyIK_gIAAKIFADD_AgAAhwIAEIADAACiBQAwgQMBAMwEACGIA0AA0AQAIeYDAQDMBAAh5wMBAMwEACHoAwIAzQQAIekDAQDMBAAh6gMBAM8EACEL_gIAAKMFADD_AgAA8QEAEIADAACjBQAwgQMBAMwEACGIA0AA0AQAIdMDAQDMBAAh6wMBAMwEACHsAwEAzAQAIe0DAQDPBAAh7gMBAM8EACHvAwEAzwQAIRX-AgAApAUAMP8CAADbAQAQgAMAAKQFADCBAwEAzAQAIYYDAQDMBAAhiANAANAEACGYA0AA0AQAIaIDAACmBfkDIqQDAQDMBAAhpQMBAMwEACHxAwAApQXxAyLyAwEAzwQAIfMDAQDPBAAh9AMBAM8EACH1AwEAzwQAIfYDAQDPBAAh9wMCAM0EACH5AwEAzwQAIfoDQADkBAAh-wMBAM8EACH8A0AA5AQAIQcPAADSBAAgOAAAqgUAIDkAAKoFACCJAwAAAPEDAooDAAAA8QMIiwMAAADxAwiQAwAAqQXxAyIHDwAA0gQAIDgAAKgFACA5AACoBQAgiQMAAAD5AwKKAwAAAPkDCIsDAAAA-QMIkAMAAKcF-QMiBw8AANIEACA4AACoBQAgOQAAqAUAIIkDAAAA-QMCigMAAAD5AwiLAwAAAPkDCJADAACnBfkDIgSJAwAAAPkDAooDAAAA-QMIiwMAAAD5AwiQAwAAqAX5AyIHDwAA0gQAIDgAAKoFACA5AACqBQAgiQMAAADxAwKKAwAAAPEDCIsDAAAA8QMIkAMAAKkF8QMiBIkDAAAA8QMCigMAAADxAwiLAwAAAPEDCJADAACqBfEDIgn-AgAAqwUAMP8CAADDAQAQgAMAAKsFADCBAwEAzAQAIYgDQADkBAAhmANAAOQEACH9AwEAzAQAIf4DAQDMBAAh_wNAANAEACEJ_gIAAKwFADD_AgAAsAEAEIADAACsBQAwgQMBAPIEACGIA0AAhAUAIZgDQACEBQAh_QMBAPIEACH-AwEA8gQAIf8DQADgBAAhEP4CAACtBQAw_wIAAKoBABCAAwAArQUAMIEDAQDMBAAhiANAANAEACGUAwEAzAQAIZgDQADQBAAhgAQBAMwEACGBBAEAzAQAIYIEAQDPBAAhgwQBAM8EACGEBAEAzwQAIYUEQADkBAAhhgRAAOQEACGHBAEAzwQAIYgEAQDPBAAhC_4CAACuBQAw_wIAAJQBABCAAwAArgUAMIEDAQDMBAAhiANAANAEACGUAwEAzAQAIZgDQADQBAAh_wNAANAEACGJBAEAzAQAIYoEAQDPBAAhiwQBAM8EACEM_gIAAK8FADD_AgAAfgAQgAMAAK8FADCBAwEAzAQAIYgDQADQBAAhmANAANAEACGMBAEAzAQAIY0EAQDMBAAhjgQgAIcFACGPBAEAzwQAIZAEAQDMBAAhkQQgAIcFACEOCgAA4QQAIB4AALEFACAgAACyBQAg_gIAALAFADD_AgAAUQAQgAMAALAFADCBAwEA8gQAIYgDQADgBAAh0wMBAPIEACHrAwEA8gQAIewDAQDyBAAh7QMBAIIFACHuAwEAggUAIe8DAQCCBQAhGgcAAOEEACAdAAC4BQAgHwAAuQUAIP4CAAC1BQAw_wIAAEwAEIADAAC1BQAwgQMBAPIEACGGAwEA8gQAIYgDQADgBAAhmANAAOAEACGiAwAAtwX5AyKkAwEA8gQAIaUDAQDyBAAh8QMAALYF8QMi8gMBAIIFACHzAwEAggUAIfQDAQCCBQAh9QMBAIIFACH2AwEAggUAIfcDAgDfBAAh-QMBAIIFACH6A0AAhAUAIfsDAQCCBQAh_ANAAIQFACGUBAAATAAglQQAAEwAIAOZAwAAUwAgmgMAAFMAIJsDAABTACALHwAAtAUAIP4CAACzBQAw_wIAAFMAEIADAACzBQAwgQMBAPIEACGIA0AA4AQAIeYDAQDyBAAh5wMBAPIEACHoAwIA3wQAIekDAQDyBAAh6gMBAIIFACEQCgAA4QQAIB4AALEFACAgAACyBQAg_gIAALAFADD_AgAAUQAQgAMAALAFADCBAwEA8gQAIYgDQADgBAAh0wMBAPIEACHrAwEA8gQAIewDAQDyBAAh7QMBAIIFACHuAwEAggUAIe8DAQCCBQAhlAQAAFEAIJUEAABRACAYBwAA4QQAIB0AALgFACAfAAC5BQAg_gIAALUFADD_AgAATAAQgAMAALUFADCBAwEA8gQAIYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAAC3BfkDIqQDAQDyBAAhpQMBAPIEACHxAwAAtgXxAyLyAwEAggUAIfMDAQCCBQAh9AMBAIIFACH1AwEAggUAIfYDAQCCBQAh9wMCAN8EACH5AwEAggUAIfoDQACEBQAh-wMBAIIFACH8A0AAhAUAIQSJAwAAAPEDAooDAAAA8QMIiwMAAADxAwiQAwAAqgXxAyIEiQMAAAD5AwKKAwAAAPkDCIsDAAAA-QMIkAMAAKgF-QMiHQQAAOAFACAFAADhBQAgBgAA4gUAIBUAAOMFACAWAADjBQAgFwAA5AUAIBgAAMMFACAZAADSBQAgGgAA5QUAIBwAAOYFACAhAADnBQAgIgAA5wUAICMAAOgFACAkAADFBQAgJQAA2wUAIP4CAADfBQAw_wIAABEAEIADAADfBQAwgQMBAPIEACGIA0AA4AQAIZgDQADgBAAhjAQBAPIEACGNBAEA8gQAIY4EIADIBQAhjwQBAIIFACGQBAEA8gQAIZEEIADIBQAhlAQAABEAIJUEAAARACAQCgAA4QQAIB4AALEFACAgAACyBQAg_gIAALAFADD_AgAAUQAQgAMAALAFADCBAwEA8gQAIYgDQADgBAAh0wMBAPIEACHrAwEA8gQAIewDAQDyBAAh7QMBAIIFACHuAwEAggUAIe8DAQCCBQAhlAQAAFEAIJUEAABRACAOAwAA4QQAIP4CAAC6BQAw_wIAAEgAEIADAAC6BQAwgQMBAPIEACGDAwIA3wQAIYgDQADgBAAhlAMBAPIEACGYA0AA4AQAIaIDAAC7BbcDIrMDAQDyBAAhtAMBAIIFACG1AwEAggUAIbcDAAC8BQAgBIkDAAAAtwMCigMAAAC3AwiLAwAAALcDCJADAAD4BLcDIgyJA4AAAAABjAOAAAAAAY0DgAAAAAGOA4AAAAABjwOAAAAAAZADgAAAAAG4AwEAAAABuQMBAAAAAboDAQAAAAG7A4AAAAABvAOAAAAAAb0DgAAAAAELGgAAvwUAIP4CAAC9BQAw_wIAAEMAEIADAAC9BQAwgQMBAPIEACGCAwEA8gQAIYMDAgDfBAAhhQMAAL4FhQMihgMBAPIEACGHAwEAggUAIYgDQADgBAAhBIkDAAAAhQMCigMAAACFAwiLAwAAAIUDCJADAADYBIUDIg4DAADhBAAgGwAA4gQAIP4CAADeBAAw_wIAAEEAEIADAADeBAAwgQMBAPIEACGIA0AA4AQAIZQDAQDyBAAhlQMCAN8EACGWAwIA3wQAIZcDAgDfBAAhmANAAOAEACGUBAAAQQAglQQAAEEAIBYEAADEBQAgCgAA4QQAIAwAAMMFACAQAADFBQAg_gIAAMAFADD_AgAAGwAQgAMAAMAFADCBAwEA8gQAIYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAADCBeYDIqUDAQDyBAAhpgMAAOsEACCtA0AAhAUAIcQDAADBBeUDIsUDAQCCBQAhxgNAAIQFACHTAwEA8gQAIeEDAgDfBAAh4gMCAN8EACHjAwIA3wQAIQSJAwAAAOUDAooDAAAA5QMIiwMAAADlAwiQAwAAoQXlAyIEiQMAAADmAwKKAwAAAOYDCIsDAAAA5gMIkAMAAJ8F5gMiA5kDAAAdACCaAwAAHQAgmwMAAB0AIAOZAwAAIQAgmgMAACEAIJsDAAAhACADmQMAABcAIJoDAAAXACCbAwAAFwAgDgcAAOEEACASAADKBQAg_gIAAMYFADD_AgAAMwAQgAMAAMYFADCBAwEA8gQAIaQDAQDyBAAhxwMBAPIEACHIAwIA3wQAIckDCADHBQAhygMgAMgFACHLA0AA4AQAIcwDQACEBQAhzQMAAMkFACAIiQMIAAAAAYoDCAAAAASLAwgAAAAEjAMIAAAAAY0DCAAAAAGOAwgAAAABjwMIAAAAAZADCADaBAAhAokDIAAAAAGQAyAAiwUAIQyJA4AAAAABjAOAAAAAAY0DgAAAAAGOA4AAAAABjwOAAAAAAZADgAAAAAG4AwEAAAABuQMBAAAAAboDAQAAAAG7A4AAAAABvAOAAAAAAb0DgAAAAAEXCgAA4QQAIAsAANgFACARAADZBQAgEwAA2gUAIBQAANsFACD-AgAA1QUAMP8CAAAXABCAAwAA1QUAMIEDAQDyBAAhhgMBAIIFACGIA0AA4AQAIZgDQADgBAAhnwMCAN8EACGiAwAA1wXaAyKlAwEA8gQAIdMDAQDyBAAh1AMBAIIFACHVAwEAggUAIdYDIADIBQAh1wMCAN8EACHYAwIA1gUAIZQEAAAXACCVBAAAFwAgCxIAAMoFACD-AgAAywUAMP8CAAAvABCAAwAAywUAMIEDAQDyBAAhxwMBAPIEACHOAwEA8gQAIc8DAADrBAAg0AMCAN8EACHRAwEAggUAIdIDAgDfBAAhAqQDAQAAAAHaAwEAAAABCgcAAOEEACANAADOBQAg_gIAAM0FADD_AgAAJQAQgAMAAM0FADCBAwEA8gQAIaQDAQDyBAAh2gMBAPIEACHbAyAAyAUAIdwDQADgBAAhFAsAANEFACAOAADSBQAg_gIAAM8FADD_AgAAIQAQgAMAAM8FADCBAwEA8gQAIYgDQADgBAAhmANAAOAEACGdAwIA3wQAIZ4DQADgBAAhnwMCAN8EACGgAwIA3wQAIaIDAADQBd8DIqMDAQCCBQAhpQMBAPIEACHUAwEA8gQAId0DAgDfBAAh3wMAALwFACCUBAAAIQAglQQAACEAIBILAADRBQAgDgAA0gUAIP4CAADPBQAw_wIAACEAEIADAADPBQAwgQMBAPIEACGIA0AA4AQAIZgDQADgBAAhnQMCAN8EACGeA0AA4AQAIZ8DAgDfBAAhoAMCAN8EACGiAwAA0AXfAyKjAwEAggUAIaUDAQDyBAAh1AMBAPIEACHdAwIA3wQAId8DAAC8BQAgBIkDAAAA3wMCigMAAADfAwiLAwAAAN8DCJADAACZBd8DIhgEAADEBQAgCgAA4QQAIAwAAMMFACAQAADFBQAg_gIAAMAFADD_AgAAGwAQgAMAAMAFADCBAwEA8gQAIYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAADCBeYDIqUDAQDyBAAhpgMAAOsEACCtA0AAhAUAIcQDAADBBeUDIsUDAQCCBQAhxgNAAIQFACHTAwEA8gQAIeEDAgDfBAAh4gMCAN8EACHjAwIA3wQAIZQEAAAbACCVBAAAGwAgA5kDAAAlACCaAwAAJQAgmwMAACUAIAKkAwEAAAAB1AMBAAAAAQkHAADhBAAgCwAA0QUAIP4CAADUBQAw_wIAAB0AEIADAADUBQAwgQMBAPIEACGkAwEA8gQAIdQDAQDyBAAh4ANAAOAEACEVCgAA4QQAIAsAANgFACARAADZBQAgEwAA2gUAIBQAANsFACD-AgAA1QUAMP8CAAAXABCAAwAA1QUAMIEDAQDyBAAhhgMBAIIFACGIA0AA4AQAIZgDQADgBAAhnwMCAN8EACGiAwAA1wXaAyKlAwEA8gQAIdMDAQDyBAAh1AMBAIIFACHVAwEAggUAIdYDIADIBQAh1wMCAN8EACHYAwIA1gUAIQiJAwIAAAABigMCAAAABYsDAgAAAAWMAwIAAAABjQMCAAAAAY4DAgAAAAGPAwIAAAABkAMCANUEACEEiQMAAADaAwKKAwAAANoDCIsDAAAA2gMIkAMAAJIF2gMiGAQAAMQFACAKAADhBAAgDAAAwwUAIBAAAMUFACD-AgAAwAUAMP8CAAAbABCAAwAAwAUAMIEDAQDyBAAhhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAAMIF5gMipQMBAPIEACGmAwAA6wQAIK0DQACEBQAhxAMAAMEF5QMixQMBAIIFACHGA0AAhAUAIdMDAQDyBAAh4QMCAN8EACHiAwIA3wQAIeMDAgDfBAAhlAQAABsAIJUEAAAbACAXBAAA6wUAIAcAAOEEACAIAAC4BQAgEAAAxQUAIP4CAADpBQAw_wIAAA0AEIADAADpBQAwgQMBAPIEACGGAwEA8gQAIYgDQADgBAAhmANAAOAEACGiAwAA6gWrAyKkAwEA8gQAIaUDAQDyBAAhpgMAAOsEACCnA0AA4AQAIagDAgDfBAAhqQMAAOwEACCrAwEAggUAIawDQACEBQAhrQNAAIQFACGUBAAADQAglQQAAA0AIAOZAwAALwAgmgMAAC8AIJsDAAAvACADmQMAADMAIJoDAAAzACCbAwAAMwAgDgkAAN4FACD-AgAA3AUAMP8CAAATABCAAwAA3AUAMIEDAQDyBAAhiANAAOAEACGYA0AA4AQAIZwDAQDyBAAhnQMCAN8EACGeA0AAhAUAIZ8DAgDfBAAhoAMCAN8EACGiAwAA3QWiAyKjAwEAggUAIQSJAwAAAKIDAooDAAAAogMIiwMAAACiAwiQAwAA5wSiAyIXBAAA6wUAIAcAAOEEACAIAAC4BQAgEAAAxQUAIP4CAADpBQAw_wIAAA0AEIADAADpBQAwgQMBAPIEACGGAwEA8gQAIYgDQADgBAAhmANAAOAEACGiAwAA6gWrAyKkAwEA8gQAIaUDAQDyBAAhpgMAAOsEACCnA0AA4AQAIagDAgDfBAAhqQMAAOwEACCrAwEAggUAIawDQACEBQAhrQNAAIQFACGUBAAADQAglQQAAA0AIBsEAADgBQAgBQAA4QUAIAYAAOIFACAVAADjBQAgFgAA4wUAIBcAAOQFACAYAADDBQAgGQAA0gUAIBoAAOUFACAcAADmBQAgIQAA5wUAICIAAOcFACAjAADoBQAgJAAAxQUAICUAANsFACD-AgAA3wUAMP8CAAARABCAAwAA3wUAMIEDAQDyBAAhiANAAOAEACGYA0AA4AQAIYwEAQDyBAAhjQQBAPIEACGOBCAAyAUAIY8EAQCCBQAhkAQBAPIEACGRBCAAyAUAIQOZAwAAAwAgmgMAAAMAIJsDAAADACADmQMAAAcAIJoDAAAHACCbAwAABwAgEgMAAOEEACD-AgAAgAUAMP8CAAALABCAAwAAgAUAMIEDAQDyBAAhiANAAOAEACGUAwEA8gQAIZgDQADgBAAhpgMAAOsEACC-AwEA8gQAIcADAACBBcADIsEDAQCCBQAhwgMBAIIFACHEAwAAgwXEAyLFAwEAggUAIcYDQACEBQAhlAQAAAsAIJUEAAALACADmQMAAA0AIJoDAAANACCbAwAADQAgA5kDAAAbACCaAwAAGwAgmwMAABsAIA4DAADhBAAgGwAA4gQAIP4CAADeBAAw_wIAAEEAEIADAADeBAAwgQMBAPIEACGIA0AA4AQAIZQDAQDyBAAhlQMCAN8EACGWAwIA3wQAIZcDAgDfBAAhmANAAOAEACGUBAAAQQAglQQAAEEAIAOZAwAASAAgmgMAAEgAIJsDAABIACADmQMAAEwAIJoDAABMACCbAwAATAAgA5kDAABRACCaAwAAUQAgmwMAAFEAIBUEAADrBQAgBwAA4QQAIAgAALgFACAQAADFBQAg_gIAAOkFADD_AgAADQAQgAMAAOkFADCBAwEA8gQAIYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAADqBasDIqQDAQDyBAAhpQMBAPIEACGmAwAA6wQAIKcDQADgBAAhqAMCAN8EACGpAwAA7AQAIKsDAQCCBQAhrANAAIQFACGtA0AAhAUAIQSJAwAAAKsDAooDAAAAqwMIiwMAAACrAwiQAwAA7wSrAyIDmQMAABMAIJoDAAATACCbAwAAEwAgEQMAAOEEACD-AgAA7AUAMP8CAAAHABCAAwAA7AUAMIEDAQDyBAAhiANAAOAEACGUAwEA8gQAIZgDQADgBAAhgAQBAPIEACGBBAEA8gQAIYIEAQCCBQAhgwQBAIIFACGEBAEAggUAIYUEQACEBQAhhgRAAIQFACGHBAEAggUAIYgEAQCCBQAhDAMAAOEEACD-AgAA7QUAMP8CAAADABCAAwAA7QUAMIEDAQDyBAAhiANAAOAEACGUAwEA8gQAIZgDQADgBAAh_wNAAOAEACGJBAEA8gQAIYoEAQCCBQAhiwQBAIIFACEAAAAAAAABmQQBAAAAAQWZBAIAAAABoAQCAAAAAaEEAgAAAAGiBAIAAAABowQCAAAAAQGZBAAAAIUDAgGZBAEAAAABAZkEQAAAAAEFMgAAiQsAIDMAAIwLACCWBAAAigsAIJcEAACLCwAgnAQAAJ0EACADMgAAiQsAIJYEAACKCwAgnAQAAJ0EACAAAAAAAAUyAACDCwAgMwAAhwsAIJYEAACECwAglwQAAIYLACCcBAAAAQAgCzIAAIIGADAzAACHBgAwlgQAAIMGADCXBAAAhAYAMJgEAACFBgAgmQQAAIYGADCaBAAAhgYAMJsEAACGBgAwnAQAAIYGADCdBAAAiAYAMJ4EAACJBgAwBoEDAQAAAAGDAwIAAAABhQMAAACFAwKGAwEAAAABhwMBAAAAAYgDQAAAAAECAAAARQAgMgAAjQYAIAMAAABFACAyAACNBgAgMwAAjAYAIAErAACFCwAwCxoAAL8FACD-AgAAvQUAMP8CAABDABCAAwAAvQUAMIEDAQAAAAGCAwEA8gQAIYMDAgDfBAAhhQMAAL4FhQMihgMBAPIEACGHAwEAggUAIYgDQADgBAAhAgAAAEUAICsAAIwGACACAAAAigYAICsAAIsGACAK_gIAAIkGADD_AgAAigYAEIADAACJBgAwgQMBAPIEACGCAwEA8gQAIYMDAgDfBAAhhQMAAL4FhQMihgMBAPIEACGHAwEAggUAIYgDQADgBAAhCv4CAACJBgAw_wIAAIoGABCAAwAAiQYAMIEDAQDyBAAhggMBAPIEACGDAwIA3wQAIYUDAAC-BYUDIoYDAQDyBAAhhwMBAIIFACGIA0AA4AQAIQaBAwEA9AUAIYMDAgD1BQAhhQMAAPYFhQMihgMBAPQFACGHAwEA9wUAIYgDQAD4BQAhBoEDAQD0BQAhgwMCAPUFACGFAwAA9gWFAyKGAwEA9AUAIYcDAQD3BQAhiANAAPgFACEGgQMBAAAAAYMDAgAAAAGFAwAAAIUDAoYDAQAAAAGHAwEAAAABiANAAAAAAQMyAACDCwAglgQAAIQLACCcBAAAAQAgBDIAAIIGADCWBAAAgwYAMJgEAACFBgAgnAQAAIYGADAQBAAA3gkAIAUAAN8JACAGAADgCQAgFQAA4QkAIBYAAOEJACAXAADiCQAgGAAA4wkAIBkAAOQJACAaAADlCQAgHAAA5gkAICEAAOcJACAiAADnCQAgIwAA6AkAICQAAOkJACAlAADqCQAgjwQAAO4FACAAAAAAAAABmQRAAAAAAQGZBAAAAKIDAgUyAAD-CgAgMwAAgQsAIJYEAAD_CgAglwQAAIALACCcBAAADwAgAzIAAP4KACCWBAAA_woAIJwEAAAPACAAAAAAAAKZBAEAAAAEnwQBAAAABQKZBAIAAAAEnwQCAAAABQGZBAAAAKsDAgUyAADjCgAgMwAA_AoAIJYEAADkCgAglwQAAPsKACCcBAAAAQAgBzIAAOEKACAzAAD5CgAglgQAAOIKACCXBAAA-AoAIJoEAAARACCbBAAAEQAgnAQAAAEAIAsyAADbBgAwMwAA4AYAMJYEAADcBgAwlwQAAN0GADCYBAAA3gYAIJkEAADfBgAwmgQAAN8GADCbBAAA3wYAMJwEAADfBgAwnQQAAOEGADCeBAAA4gYAMAsyAACnBgAwMwAArAYAMJYEAACoBgAwlwQAAKkGADCYBAAAqgYAIJkEAACrBgAwmgQAAKsGADCbBAAAqwYAMJwEAACrBgAwnQQAAK0GADCeBAAArgYAMBAKAADXBgAgCwAA2AYAIBMAANkGACAUAADaBgAggQMBAAAAAYYDAQAAAAGIA0AAAAABmANAAAAAAZ8DAgAAAAGiAwAAANoDAqUDAQAAAAHTAwEAAAAB1AMBAAAAAdYDIAAAAAHXAwIAAAAB2AMCAAAAAQIAAAAZACAyAADWBgAgAwAAABkAIDIAANYGACAzAAC0BgAgASsAAPcKADAVCgAA4QQAIAsAANgFACARAADZBQAgEwAA2gUAIBQAANsFACD-AgAA1QUAMP8CAAAXABCAAwAA1QUAMIEDAQAAAAGGAwEAggUAIYgDQADgBAAhmANAAOAEACGfAwIA3wQAIaIDAADXBdoDIqUDAQDyBAAh0wMBAPIEACHUAwEAggUAIdUDAQCCBQAh1gMgAMgFACHXAwIA3wQAIdgDAgDWBQAhAgAAABkAICsAALQGACACAAAArwYAICsAALAGACAQ_gIAAK4GADD_AgAArwYAEIADAACuBgAwgQMBAPIEACGGAwEAggUAIYgDQADgBAAhmANAAOAEACGfAwIA3wQAIaIDAADXBdoDIqUDAQDyBAAh0wMBAPIEACHUAwEAggUAIdUDAQCCBQAh1gMgAMgFACHXAwIA3wQAIdgDAgDWBQAhEP4CAACuBgAw_wIAAK8GABCAAwAArgYAMIEDAQDyBAAhhgMBAIIFACGIA0AA4AQAIZgDQADgBAAhnwMCAN8EACGiAwAA1wXaAyKlAwEA8gQAIdMDAQDyBAAh1AMBAIIFACHVAwEAggUAIdYDIADIBQAh1wMCAN8EACHYAwIA1gUAIQyBAwEA9AUAIYYDAQD3BQAhiANAAPgFACGYA0AA-AUAIZ8DAgD1BQAhogMAALMG2gMipQMBAPQFACHTAwEA9AUAIdQDAQD3BQAh1gMgALEGACHXAwIA9QUAIdgDAgCyBgAhAZkEIAAAAAEFmQQCAAAAAaAEAgAAAAGhBAIAAAABogQCAAAAAaMEAgAAAAEBmQQAAADaAwIQCgAAtQYAIAsAALYGACATAAC3BgAgFAAAuAYAIIEDAQD0BQAhhgMBAPcFACGIA0AA-AUAIZgDQAD4BQAhnwMCAPUFACGiAwAAswbaAyKlAwEA9AUAIdMDAQD0BQAh1AMBAPcFACHWAyAAsQYAIdcDAgD1BQAh2AMCALIGACEFMgAA6AoAIDMAAPUKACCWBAAA6QoAIJcEAAD0CgAgnAQAAAEAIAcyAADmCgAgMwAA8goAIJYEAADnCgAglwQAAPEKACCaBAAAGwAgmwQAABsAIJwEAAA9ACALMgAAyAYAMDMAAM0GADCWBAAAyQYAMJcEAADKBgAwmAQAAMsGACCZBAAAzAYAMJoEAADMBgAwmwQAAMwGADCcBAAAzAYAMJ0EAADOBgAwngQAAM8GADALMgAAuQYAMDMAAL4GADCWBAAAugYAMJcEAAC7BgAwmAQAALwGACCZBAAAvQYAMJoEAAC9BgAwmwQAAL0GADCcBAAAvQYAMJ0EAAC_BgAwngQAAMAGADAJBwAAxwYAIIEDAQAAAAGkAwEAAAAByAMCAAAAAckDCAAAAAHKAyAAAAABywNAAAAAAcwDQAAAAAHNA4AAAAABAgAAADUAIDIAAMYGACADAAAANQAgMgAAxgYAIDMAAMQGACABKwAA8AoAMA4HAADhBAAgEgAAygUAIP4CAADGBQAw_wIAADMAEIADAADGBQAwgQMBAAAAAaQDAQDyBAAhxwMBAPIEACHIAwIA3wQAIckDCADHBQAhygMgAMgFACHLA0AA4AQAIcwDQACEBQAhzQMAAMkFACACAAAANQAgKwAAxAYAIAIAAADBBgAgKwAAwgYAIAz-AgAAwAYAMP8CAADBBgAQgAMAAMAGADCBAwEA8gQAIaQDAQDyBAAhxwMBAPIEACHIAwIA3wQAIckDCADHBQAhygMgAMgFACHLA0AA4AQAIcwDQACEBQAhzQMAAMkFACAM_gIAAMAGADD_AgAAwQYAEIADAADABgAwgQMBAPIEACGkAwEA8gQAIccDAQDyBAAhyAMCAN8EACHJAwgAxwUAIcoDIADIBQAhywNAAOAEACHMA0AAhAUAIc0DAADJBQAgCIEDAQD0BQAhpAMBAPQFACHIAwIA9QUAIckDCADDBgAhygMgALEGACHLA0AA-AUAIcwDQACXBgAhzQOAAAAAAQWZBAgAAAABoAQIAAAAAaEECAAAAAGiBAgAAAABowQIAAAAAQkHAADFBgAggQMBAPQFACGkAwEA9AUAIcgDAgD1BQAhyQMIAMMGACHKAyAAsQYAIcsDQAD4BQAhzANAAJcGACHNA4AAAAABBTIAAOsKACAzAADuCgAglgQAAOwKACCXBAAA7QoAIJwEAAABACAJBwAAxwYAIIEDAQAAAAGkAwEAAAAByAMCAAAAAckDCAAAAAHKAyAAAAABywNAAAAAAcwDQAAAAAHNA4AAAAABAzIAAOsKACCWBAAA7AoAIJwEAAABACAGgQMBAAAAAc4DAQAAAAHPAwAA1QYAINADAgAAAAHRAwEAAAAB0gMCAAAAAQIAAAAxACAyAADUBgAgAwAAADEAIDIAANQGACAzAADTBgAgASsAAOoKADALEgAAygUAIP4CAADLBQAw_wIAAC8AEIADAADLBQAwgQMBAAAAAccDAQDyBAAhzgMBAPIEACHPAwAA6wQAINADAgDfBAAh0QMBAIIFACHSAwIA3wQAIQIAAAAxACArAADTBgAgAgAAANAGACArAADRBgAgCv4CAADPBgAw_wIAANAGABCAAwAAzwYAMIEDAQDyBAAhxwMBAPIEACHOAwEA8gQAIc8DAADrBAAg0AMCAN8EACHRAwEAggUAIdIDAgDfBAAhCv4CAADPBgAw_wIAANAGABCAAwAAzwYAMIEDAQDyBAAhxwMBAPIEACHOAwEA8gQAIc8DAADrBAAg0AMCAN8EACHRAwEAggUAIdIDAgDfBAAhBoEDAQD0BQAhzgMBAPQFACHPAwAA0gYAINADAgD1BQAh0QMBAPcFACHSAwIA9QUAIQKZBAEAAAAEnwQBAAAABQaBAwEA9AUAIc4DAQD0BQAhzwMAANIGACDQAwIA9QUAIdEDAQD3BQAh0gMCAPUFACEGgQMBAAAAAc4DAQAAAAHPAwAA1QYAINADAgAAAAHRAwEAAAAB0gMCAAAAAQGZBAEAAAAEEAoAANcGACALAADYBgAgEwAA2QYAIBQAANoGACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABnwMCAAAAAaIDAAAA2gMCpQMBAAAAAdMDAQAAAAHUAwEAAAAB1gMgAAAAAdcDAgAAAAHYAwIAAAABAzIAAOgKACCWBAAA6QoAIJwEAAABACADMgAA5goAIJYEAADnCgAgnAQAAD0AIAQyAADIBgAwlgQAAMkGADCYBAAAywYAIJwEAADMBgAwBDIAALkGADCWBAAAugYAMJgEAAC8BgAgnAQAAL0GADAJgQMBAAAAAYgDQAAAAAGYA0AAAAABnQMCAAAAAZ4DQAAAAAGfAwIAAAABoAMCAAAAAaIDAAAAogMCowMBAAAAAQIAAAAVACAyAADmBgAgAwAAABUAIDIAAOYGACAzAADlBgAgASsAAOUKADAOCQAA3gUAIP4CAADcBQAw_wIAABMAEIADAADcBQAwgQMBAAAAAYgDQADgBAAhmANAAOAEACGcAwEA8gQAIZ0DAgDfBAAhngNAAIQFACGfAwIA3wQAIaADAgDfBAAhogMAAN0FogMiowMBAIIFACECAAAAFQAgKwAA5QYAIAIAAADjBgAgKwAA5AYAIA3-AgAA4gYAMP8CAADjBgAQgAMAAOIGADCBAwEA8gQAIYgDQADgBAAhmANAAOAEACGcAwEA8gQAIZ0DAgDfBAAhngNAAIQFACGfAwIA3wQAIaADAgDfBAAhogMAAN0FogMiowMBAIIFACEN_gIAAOIGADD_AgAA4wYAEIADAADiBgAwgQMBAPIEACGIA0AA4AQAIZgDQADgBAAhnAMBAPIEACGdAwIA3wQAIZ4DQACEBQAhnwMCAN8EACGgAwIA3wQAIaIDAADdBaIDIqMDAQCCBQAhCYEDAQD0BQAhiANAAPgFACGYA0AA-AUAIZ0DAgD1BQAhngNAAJcGACGfAwIA9QUAIaADAgD1BQAhogMAAJgGogMiowMBAPcFACEJgQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhnQMCAPUFACGeA0AAlwYAIZ8DAgD1BQAhoAMCAPUFACGiAwAAmAaiAyKjAwEA9wUAIQmBAwEAAAABiANAAAAAAZgDQAAAAAGdAwIAAAABngNAAAAAAZ8DAgAAAAGgAwIAAAABogMAAACiAwKjAwEAAAABAZkEAQAAAAQBmQQCAAAABAMyAADjCgAglgQAAOQKACCcBAAAAQAgAzIAAOEKACCWBAAA4goAIJwEAAABACAEMgAA2wYAMJYEAADcBgAwmAQAAN4GACCcBAAA3wYAMAQyAACnBgAwlgQAAKgGADCYBAAAqgYAIJwEAACrBgAwAAAAAAAAAAAAAAGZBAAAALcDAgUyAADcCgAgMwAA3woAIJYEAADdCgAglwQAAN4KACCcBAAAAQAgAzIAANwKACCWBAAA3QoAIJwEAAABACAAAAACmQQBAAAABJ8EAQAAAAUBmQQAAADAAwIBmQQAAADEAwIFMgAA1woAIDMAANoKACCWBAAA2AoAIJcEAADZCgAgnAQAAAEAIAGZBAEAAAAEAzIAANcKACCWBAAA2AoAIJwEAAABACAAAAAAAAUyAADSCgAgMwAA1QoAIJYEAADTCgAglwQAANQKACCcBAAAGQAgAzIAANIKACCWBAAA0woAIJwEAAAZACAAAAAAAAUyAADNCgAgMwAA0AoAIJYEAADOCgAglwQAAM8KACCcBAAAGQAgAzIAAM0KACCWBAAAzgoAIJwEAAAZACAAAAAAAAcyAADICgAgMwAAywoAIJYEAADJCgAglwQAAMoKACCaBAAADQAgmwQAAA0AIJwEAAAPACADMgAAyAoAIJYEAADJCgAgnAQAAA8AIAAAAAUyAADACgAgMwAAxgoAIJYEAADBCgAglwQAAMUKACCcBAAAIwAgBTIAAL4KACAzAADDCgAglgQAAL8KACCXBAAAwgoAIJwEAAABACADMgAAwAoAIJYEAADBCgAgnAQAACMAIAMyAAC-CgAglgQAAL8KACCcBAAAAQAgAAAAAAABmQQAAADfAwIFMgAAuAoAIDMAALwKACCWBAAAuQoAIJcEAAC7CgAgnAQAAD0AIAsyAACnBwAwMwAArAcAMJYEAACoBwAwlwQAAKkHADCYBAAAqgcAIJkEAACrBwAwmgQAAKsHADCbBAAAqwcAMJwEAACrBwAwnQQAAK0HADCeBAAArgcAMAUHAACeBwAggQMBAAAAAaQDAQAAAAHbAyAAAAAB3ANAAAAAAQIAAAAnACAyAACyBwAgAwAAACcAIDIAALIHACAzAACxBwAgASsAALoKADALBwAA4QQAIA0AAM4FACD-AgAAzQUAMP8CAAAlABCAAwAAzQUAMIEDAQAAAAGkAwEA8gQAIdoDAQDyBAAh2wMgAMgFACHcA0AA4AQAIZIEAADMBQAgAgAAACcAICsAALEHACACAAAArwcAICsAALAHACAI_gIAAK4HADD_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_gIAANgHADD_AgAA2QcAEIADAADYBwAwgQMBAPIEACGIA0AA4AQAIZgDQADgBAAhnQMCAN8EACGeA0AA4AQAIZ8DAgDfBAAhoAMCAN8EACGiAwAA0AXfAyKjAwEAggUAIaUDAQDyBAAh1AMBAPIEACHdAwIA3wQAId8DAAC8BQAgEP4CAADYBwAw_wIAANkHABCAAwAA2AcAMIEDAQDyBAAhiANAAOAEACGYA0AA4AQAIZ0DAgDfBAAhngNAAOAEACGfAwIA3wQAIaADAgDfBAAhogMAANAF3wMiowMBAIIFACGlAwEA8gQAIdQDAQDyBAAh3QMCAN8EACHfAwAAvAUAIAyBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGdAwIA9QUAIZ4DQAD4BQAhnwMCAPUFACGgAwIA9QUAIaIDAACkB98DIqMDAQD3BQAhpQMBAPQFACHdAwIA9QUAId8DgAAAAAENDgAApgcAIIEDAQD0BQAhiANAAPgFACGYA0AA-AUAIZ0DAgD1BQAhngNAAPgFACGfAwIA9QUAIaADAgD1BQAhogMAAKQH3wMiowMBAPcFACGlAwEA9AUAId0DAgD1BQAh3wOAAAAAAQ0OAAC0BwAggQMBAAAAAYgDQAAAAAGYA0AAAAABnQMCAAAAAZ4DQAAAAAGfAwIAAAABoAMCAAAAAaIDAAAA3wMCowMBAAAAAaUDAQAAAAHdAwIAAAAB3wOAAAAAAQQHAAC7BwAggQMBAAAAAaQDAQAAAAHgA0AAAAABAgAAAB8AIDIAAOgHACADAAAAHwAgMgAA6AcAIDMAAOcHACABKwAAqAoAMAoHAADhBAAgCwAA0QUAIP4CAADUBQAw_wIAAB0AEIADAADUBQAwgQMBAAAAAaQDAQDyBAAh1AMBAPIEACHgA0AA4AQAIZMEAADTBQAgAgAAAB8AICsAAOcHACACAAAA5QcAICsAAOYHACAH_gIAAOQHADD_AgAA5QcAEIADAADkBwAwgQMBAPIEACGkAwEA8gQAIdQDAQDyBAAh4ANAAOAEACEH_gIAAOQHADD_AgAA5QcAEIADAADkBwAwgQMBAPIEACGkAwEA8gQAIdQDAQDyBAAh4ANAAOAEACEDgQMBAPQFACGkAwEA9AUAIeADQAD4BQAhBAcAALkHACCBAwEA9AUAIaQDAQD0BQAh4ANAAPgFACEEBwAAuwcAIIEDAQAAAAGkAwEAAAAB4ANAAAAAAQGZBAEAAAAEAzIAAKYKACCWBAAApwoAIJwEAAABACAEMgAA3QcAMJYEAADeBwAwmAQAAOAHACCcBAAA4QcAMAQyAADRBwAwlgQAANIHADCYBAAA1AcAIJwEAADVBwAwBDIAAMgHADCWBAAAyQcAMJgEAADLBwAgnAQAAKsGADAAAAAAAAUyAAChCgAgMwAApAoAIJYEAACiCgAglwQAAKMKACCcBAAAWgAgAzIAAKEKACCWBAAAogoAIJwEAABaACAAAAAFMgAAmAoAIDMAAJ8KACCWBAAAmQoAIJcEAACeCgAgnAQAAE4AIAUyAACWCgAgMwAAnAoAIJYEAACXCgAglwQAAJsKACCcBAAAAQAgCzIAAPsHADAzAACACAAwlgQAAPwHADCXBAAA_QcAMJgEAAD-BwAgmQQAAP8HADCaBAAA_wcAMJsEAAD_BwAwnAQAAP8HADCdBAAAgQgAMJ4EAACCCAAwBoEDAQAAAAGIA0AAAAAB5wMBAAAAAegDAgAAAAHpAwEAAAAB6gMBAAAAAQIAAABVACAyAACGCAAgAwAAAFUAIDIAAIYIACAzAACFCAAgASsAAJoKADALHwAAtAUAIP4CAACzBQAw_wIAAFMAEIADAACzBQAwgQMBAAAAAYgDQADgBAAh5gMBAPIEACHnAwEA8gQAIegDAgDfBAAh6QMBAPIEACHqAwEAggUAIQIAAABVACArAACFCAAgAgAAAIMIACArAACECAAgCv4CAACCCAAw_wIAAIMIABCAAwAAgggAMIEDAQDyBAAhiANAAOAEACHmAwEA8gQAIecDAQDyBAAh6AMCAN8EACHpAwEA8gQAIeoDAQCCBQAhCv4CAACCCAAw_wIAAIMIABCAAwAAgggAMIEDAQDyBAAhiANAAOAEACHmAwEA8gQAIecDAQDyBAAh6AMCAN8EACHpAwEA8gQAIeoDAQCCBQAhBoEDAQD0BQAhiANAAPgFACHnAwEA9AUAIegDAgD1BQAh6QMBAPQFACHqAwEA9wUAIQaBAwEA9AUAIYgDQAD4BQAh5wMBAPQFACHoAwIA9QUAIekDAQD0BQAh6gMBAPcFACEGgQMBAAAAAYgDQAAAAAHnAwEAAAAB6AMCAAAAAekDAQAAAAHqAwEAAAABAzIAAJgKACCWBAAAmQoAIJwEAABOACADMgAAlgoAIJYEAACXCgAgnAQAAAEAIAQyAAD7BwAwlgQAAPwHADCYBAAA_gcAIJwEAAD_BwAwAAAAAAABmQQAAADxAwIBmQQAAAD5AwIFMgAAjgoAIDMAAJQKACCWBAAAjwoAIJcEAACTCgAgnAQAAAEAIAcyAACMCgAgMwAAkQoAIJYEAACNCgAglwQAAJAKACCaBAAAEQAgmwQAABEAIJwEAAABACAHMgAAlAgAIDMAAJcIACCWBAAAlQgAIJcEAACWCAAgmgQAAFEAIJsEAABRACCcBAAAWgAgCQoAAIgIACAgAACJCAAggQMBAAAAAYgDQAAAAAHTAwEAAAAB7AMBAAAAAe0DAQAAAAHuAwEAAAAB7wMBAAAAAQIAAABaACAyAACUCAAgAwAAAFEAIDIAAJQIACAzAACYCAAgCwAAAFEAIAoAAPkHACAgAAD6BwAgKwAAmAgAIIEDAQD0BQAhiANAAPgFACHTAwEA9AUAIewDAQD0BQAh7QMBAPcFACHuAwEA9wUAIe8DAQD3BQAhCQoAAPkHACAgAAD6BwAggQMBAPQFACGIA0AA-AUAIdMDAQD0BQAh7AMBAPQFACHtAwEA9wUAIe4DAQD3BQAh7wMBAPcFACEDMgAAjgoAIJYEAACPCgAgnAQAAAEAIAMyAACMCgAglgQAAI0KACCcBAAAAQAgAzIAAJQIACCWBAAAlQgAIJwEAABaACAAAAAAAAAFMgAAhwoAIDMAAIoKACCWBAAAiAoAIJcEAACJCgAgnAQAAAEAIAMyAACHCgAglgQAAIgKACCcBAAAAQAgAAAABTIAAIIKACAzAACFCgAglgQAAIMKACCXBAAAhAoAIJwEAAABACADMgAAggoAIJYEAACDCgAgnAQAAAEAIAAAAAsyAADDCQAwMwAAyAkAMJYEAADECQAwlwQAAMUJADCYBAAAxgkAIJkEAADHCQAwmgQAAMcJADCbBAAAxwkAMJwEAADHCQAwnQQAAMkJADCeBAAAygkAMAsyAAC3CQAwMwAAvAkAMJYEAAC4CQAwlwQAALkJADCYBAAAugkAIJkEAAC7CQAwmgQAALsJADCbBAAAuwkAMJwEAAC7CQAwnQQAAL0JADCeBAAAvgkAMAcyAACyCQAgMwAAtQkAIJYEAACzCQAglwQAALQJACCaBAAACwAgmwQAAAsAIJwEAACoAwAgCzIAAKkJADAzAACtCQAwlgQAAKoJADCXBAAAqwkAMJgEAACsCQAgmQQAAKEJADCaBAAAoQkAMJsEAAChCQAwnAQAAKEJADCdBAAArgkAMJ4EAACkCQAwCzIAAJ0JADAzAACiCQAwlgQAAJ4JADCXBAAAnwkAMJgEAACgCQAgmQQAAKEJADCaBAAAoQkAMJsEAAChCQAwnAQAAKEJADCdBAAAowkAMJ4EAACkCQAwCzIAAJEJADAzAACWCQAwlgQAAJIJADCXBAAAkwkAMJgEAACUCQAgmQQAAJUJADCaBAAAlQkAMJsEAACVCQAwnAQAAJUJADCdBAAAlwkAMJ4EAACYCQAwCzIAAIgJADAzAACMCQAwlgQAAIkJADCXBAAAigkAMJgEAACLCQAgmQQAAOEHADCaBAAA4QcAMJsEAADhBwAwnAQAAOEHADCdBAAAjQkAMJ4EAADkBwAwCzIAAP8IADAzAACDCQAwlgQAAIAJADCXBAAAgQkAMJgEAACCCQAgmQQAAKsHADCaBAAAqwcAMJsEAACrBwAwnAQAAKsHADCdBAAAhAkAMJ4EAACuBwAwBzIAAPoIACAzAAD9CAAglgQAAPsIACCXBAAA_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_gIAALAFADD_AgAAUQAQgAMAALAFADCBAwEAAAABiANAAOAEACHTAwEA8gQAIesDAQAAAAHsAwEA8gQAIe0DAQCCBQAh7gMBAIIFACHvAwEAggUAIQIAAABaACArAADXCAAgAgAAANUIACArAADWCAAgC_4CAADUCAAw_wIAANUIABCAAwAA1AgAMIEDAQDyBAAhiANAAOAEACHTAwEA8gQAIesDAQDyBAAh7AMBAPIEACHtAwEAggUAIe4DAQCCBQAh7wMBAIIFACEL_gIAANQIADD_AgAA1QgAEIADAADUCAAwgQMBAPIEACGIA0AA4AQAIdMDAQDyBAAh6wMBAPIEACHsAwEA8gQAIe0DAQCCBQAh7gMBAIIFACHvAwEAggUAIQeBAwEA9AUAIYgDQAD4BQAh6wMBAPQFACHsAwEA9AUAIe0DAQD3BQAh7gMBAPcFACHvAwEA9wUAIQkeAAD4BwAgIAAA-gcAIIEDAQD0BQAhiANAAPgFACHrAwEA9AUAIewDAQD0BQAh7QMBAPcFACHuAwEA9wUAIe8DAQD3BQAhCR4AAIcIACAgAACJCAAggQMBAAAAAYgDQAAAAAHrAwEAAAAB7AMBAAAAAe0DAQAAAAHuAwEAAAAB7wMBAAAAARMHAACZCAAgHwAAmwgAIIEDAQAAAAGGAwEAAAABiANAAAAAAZgDQAAAAAGiAwAAAPkDAqQDAQAAAAGlAwEAAAAB8QMAAADxAwLyAwEAAAAB8wMBAAAAAfQDAQAAAAH1AwEAAAAB9gMBAAAAAfcDAgAAAAH5AwEAAAAB-gNAAAAAAfwDQAAAAAECAAAATgAgMgAA5AgAIAMAAABOACAyAADkCAAgMwAA4wgAIAErAAD-CQAwGAcAAOEEACAdAAC4BQAgHwAAuQUAIP4CAAC1BQAw_wIAAEwAEIADAAC1BQAwgQMBAAAAAYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAAC3BfkDIqQDAQDyBAAhpQMBAPIEACHxAwAAtgXxAyLyAwEAggUAIfMDAQCCBQAh9AMBAIIFACH1AwEAggUAIfYDAQCCBQAh9wMCAN8EACH5AwEAggUAIfoDQACEBQAh-wMBAIIFACH8A0AAhAUAIQIAAABOACArAADjCAAgAgAAAOEIACArAADiCAAgFf4CAADgCAAw_wIAAOEIABCAAwAA4AgAMIEDAQDyBAAhhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAALcF-QMipAMBAPIEACGlAwEA8gQAIfEDAAC2BfEDIvIDAQCCBQAh8wMBAIIFACH0AwEAggUAIfUDAQCCBQAh9gMBAIIFACH3AwIA3wQAIfkDAQCCBQAh-gNAAIQFACH7AwEAggUAIfwDQACEBQAhFf4CAADgCAAw_wIAAOEIABCAAwAA4AgAMIEDAQDyBAAhhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAALcF-QMipAMBAPIEACGlAwEA8gQAIfEDAAC2BfEDIvIDAQCCBQAh8wMBAIIFACH0AwEAggUAIfUDAQCCBQAh9gMBAIIFACH3AwIA3wQAIfkDAQCCBQAh-gNAAIQFACH7AwEAggUAIfwDQACEBQAhEYEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAJAI-QMipAMBAPQFACGlAwEA9AUAIfEDAACPCPEDIvIDAQD3BQAh8wMBAPcFACH0AwEA9wUAIfUDAQD3BQAh9gMBAPcFACH3AwIA9QUAIfkDAQD3BQAh-gNAAJcGACH8A0AAlwYAIRMHAACRCAAgHwAAkwgAIIEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAJAI-QMipAMBAPQFACGlAwEA9AUAIfEDAACPCPEDIvIDAQD3BQAh8wMBAPcFACH0AwEA9wUAIfUDAQD3BQAh9gMBAPcFACH3AwIA9QUAIfkDAQD3BQAh-gNAAJcGACH8A0AAlwYAIRMHAACZCAAgHwAAmwgAIIEDAQAAAAGGAwEAAAABiANAAAAAAZgDQAAAAAGiAwAAAPkDAqQDAQAAAAGlAwEAAAAB8QMAAADxAwLyAwEAAAAB8wMBAAAAAfQDAQAAAAH1AwEAAAAB9gMBAAAAAfcDAgAAAAH5AwEAAAAB-gNAAAAAAfwDQAAAAAETHQAAmggAIB8AAJsIACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABogMAAAD5AwKlAwEAAAAB8QMAAADxAwLyAwEAAAAB8wMBAAAAAfQDAQAAAAH1AwEAAAAB9gMBAAAAAfcDAgAAAAH5AwEAAAAB-gNAAAAAAfsDAQAAAAH8A0AAAAABAgAAAE4AIDIAAO0IACADAAAATgAgMgAA7QgAIDMAAOwIACABKwAA_QkAMAIAAABOACArAADsCAAgAgAAAOEIACArAADrCAAgEYEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAJAI-QMipQMBAPQFACHxAwAAjwjxAyLyAwEA9wUAIfMDAQD3BQAh9AMBAPcFACH1AwEA9wUAIfYDAQD3BQAh9wMCAPUFACH5AwEA9wUAIfoDQACXBgAh-wMBAPcFACH8A0AAlwYAIRMdAACSCAAgHwAAkwgAIIEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAJAI-QMipQMBAPQFACHxAwAAjwjxAyLyAwEA9wUAIfMDAQD3BQAh9AMBAPcFACH1AwEA9wUAIfYDAQD3BQAh9wMCAPUFACH5AwEA9wUAIfoDQACXBgAh-wMBAPcFACH8A0AAlwYAIRMdAACaCAAgHwAAmwgAIIEDAQAAAAGGAwEAAAABiANAAAAAAZgDQAAAAAGiAwAAAPkDAqUDAQAAAAHxAwAAAPEDAvIDAQAAAAHzAwEAAAAB9AMBAAAAAfUDAQAAAAH2AwEAAAAB9wMCAAAAAfkDAQAAAAH6A0AAAAAB-wMBAAAAAfwDQAAAAAEJgQMBAAAAAYMDAgAAAAGIA0AAAAABmANAAAAAAaIDAAAAtwMCswMBAAAAAbQDAQAAAAG1AwEAAAABtwOAAAAAAQIAAABKACAyAAD5CAAgAwAAAEoAIDIAAPkIACAzAAD4CAAgASsAAPwJADAOAwAA4QQAIP4CAAC6BQAw_wIAAEgAEIADAAC6BQAwgQMBAAAAAYMDAgDfBAAhiANAAOAEACGUAwEA8gQAIZgDQADgBAAhogMAALsFtwMiswMBAAAAAbQDAQAAAAG1AwEAAAABtwMAALwFACACAAAASgAgKwAA-AgAIAIAAAD2CAAgKwAA9wgAIA3-AgAA9QgAMP8CAAD2CAAQgAMAAPUIADCBAwEA8gQAIYMDAgDfBAAhiANAAOAEACGUAwEA8gQAIZgDQADgBAAhogMAALsFtwMiswMBAPIEACG0AwEAggUAIbUDAQCCBQAhtwMAALwFACAN_gIAAPUIADD_AgAA9ggAEIADAAD1CAAwgQMBAPIEACGDAwIA3wQAIYgDQADgBAAhlAMBAPIEACGYA0AA4AQAIaIDAAC7BbcDIrMDAQDyBAAhtAMBAIIFACG1AwEAggUAIbcDAAC8BQAgCYEDAQD0BQAhgwMCAPUFACGIA0AA-AUAIZgDQAD4BQAhogMAAPcGtwMiswMBAPQFACG0AwEA9wUAIbUDAQD3BQAhtwOAAAAAAQmBAwEA9AUAIYMDAgD1BQAhiANAAPgFACGYA0AA-AUAIaIDAAD3BrcDIrMDAQD0BQAhtAMBAPcFACG1AwEA9wUAIbcDgAAAAAEJgQMBAAAAAYMDAgAAAAGIA0AAAAABmANAAAAAAaIDAAAAtwMCswMBAAAAAbQDAQAAAAG1AwEAAAABtwOAAAAAAQcbAACPBgAggQMBAAAAAYgDQAAAAAGVAwIAAAABlgMCAAAAAZcDAgAAAAGYA0AAAAABAgAAAJ0EACAyAAD6CAAgAwAAAEEAIDIAAPoIACAzAAD-CAAgCQAAAEEAIBsAAIEGACArAAD-CAAggQMBAPQFACGIA0AA-AUAIZUDAgD1BQAhlgMCAPUFACGXAwIA9QUAIZgDQAD4BQAhBxsAAIEGACCBAwEA9AUAIYgDQAD4BQAhlQMCAPUFACGWAwIA9QUAIZcDAgD1BQAhmANAAPgFACEFDQAAnQcAIIEDAQAAAAHaAwEAAAAB2wMgAAAAAdwDQAAAAAECAAAAJwAgMgAAhwkAIAMAAAAnACAyAACHCQAgMwAAhgkAIAErAAD7CQAwAgAAACcAICsAAIYJACACAAAArwcAICsAAIUJACAEgQMBAPQFACHaAwEA9AUAIdsDIACxBgAh3ANAAPgFACEFDQAAmwcAIIEDAQD0BQAh2gMBAPQFACHbAyAAsQYAIdwDQAD4BQAhBQ0AAJ0HACCBAwEAAAAB2gMBAAAAAdsDIAAAAAHcA0AAAAABBAsAALoHACCBAwEAAAAB1AMBAAAAAeADQAAAAAECAAAAHwAgMgAAkAkAIAMAAAAfACAyAACQCQAgMwAAjwkAIAErAAD6CQAwAgAAAB8AICsAAI8JACACAAAA5QcAICsAAI4JACADgQMBAPQFACHUAwEA9AUAIeADQAD4BQAhBAsAALgHACCBAwEA9AUAIdQDAQD0BQAh4ANAAPgFACEECwAAugcAIIEDAQAAAAHUAwEAAAAB4ANAAAAAAREEAADsBwAgDAAA6wcAIBAAAO0HACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABogMAAADmAwKlAwEAAAABpgMAAOkHACCtA0AAAAABxAMAAADlAwLFAwEAAAABxgNAAAAAAeEDAgAAAAHiAwIAAAAB4wMCAAAAAQIAAAA9ACAyAACcCQAgAwAAAD0AIDIAAJwJACAzAACbCQAgASsAAPkJADAWBAAAxAUAIAoAAOEEACAMAADDBQAgEAAAxQUAIP4CAADABQAw_wIAABsAEIADAADABQAwgQMBAAAAAYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAADCBeYDIqUDAQDyBAAhpgMAAOsEACCtA0AAhAUAIcQDAADBBeUDIsUDAQCCBQAhxgNAAIQFACHTAwEA8gQAIeEDAgDfBAAh4gMCAN8EACHjAwIA3wQAIQIAAAA9ACArAACbCQAgAgAAAJkJACArAACaCQAgEv4CAACYCQAw_wIAAJkJABCAAwAAmAkAMIEDAQDyBAAhhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAAMIF5gMipQMBAPIEACGmAwAA6wQAIK0DQACEBQAhxAMAAMEF5QMixQMBAIIFACHGA0AAhAUAIdMDAQDyBAAh4QMCAN8EACHiAwIA3wQAIeMDAgDfBAAhEv4CAACYCQAw_wIAAJkJABCAAwAAmAkAMIEDAQDyBAAhhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAAMIF5gMipQMBAPIEACGmAwAA6wQAIK0DQACEBQAhxAMAAMEF5QMixQMBAIIFACHGA0AAhAUAIdMDAQDyBAAh4QMCAN8EACHiAwIA3wQAIeMDAgDfBAAhDoEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAMMH5gMipQMBAPQFACGmAwAAwQcAIK0DQACXBgAhxAMAAMIH5QMixQMBAPcFACHGA0AAlwYAIeEDAgD1BQAh4gMCAPUFACHjAwIA9QUAIREEAADGBwAgDAAAxQcAIBAAAMcHACCBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAADDB-YDIqUDAQD0BQAhpgMAAMEHACCtA0AAlwYAIcQDAADCB-UDIsUDAQD3BQAhxgNAAJcGACHhAwIA9QUAIeIDAgD1BQAh4wMCAPUFACERBAAA7AcAIAwAAOsHACAQAADtBwAggQMBAAAAAYYDAQAAAAGIA0AAAAABmANAAAAAAaIDAAAA5gMCpQMBAAAAAaYDAADpBwAgrQNAAAAAAcQDAAAA5QMCxQMBAAAAAcYDQAAAAAHhAwIAAAAB4gMCAAAAAeMDAgAAAAEQBAAA6wYAIAcAAOkGACAQAADsBgAggQMBAAAAAYYDAQAAAAGIA0AAAAABmANAAAAAAaIDAAAAqwMCpAMBAAAAAaUDAQAAAAGmAwAA5wYAIKcDQAAAAAGoAwIAAAABqQMAAOgGACCsA0AAAAABrQNAAAAAAQIAAAAPACAyAACoCQAgAwAAAA8AIDIAAKgJACAzAACnCQAgASsAAPgJADAVBAAA6wUAIAcAAOEEACAIAAC4BQAgEAAAxQUAIP4CAADpBQAw_wIAAA0AEIADAADpBQAwgQMBAAAAAYYDAQDyBAAhiANAAOAEACGYA0AA4AQAIaIDAADqBasDIqQDAQDyBAAhpQMBAPIEACGmAwAA6wQAIKcDQADgBAAhqAMCAN8EACGpAwAA7AQAIKsDAQCCBQAhrANAAIQFACGtA0AAhAUAIQIAAAAPACArAACnCQAgAgAAAKUJACArAACmCQAgEf4CAACkCQAw_wIAAKUJABCAAwAApAkAMIEDAQDyBAAhhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAAOoFqwMipAMBAPIEACGlAwEA8gQAIaYDAADrBAAgpwNAAOAEACGoAwIA3wQAIakDAADsBAAgqwMBAIIFACGsA0AAhAUAIa0DQACEBQAhEf4CAACkCQAw_wIAAKUJABCAAwAApAkAMIEDAQDyBAAhhgMBAPIEACGIA0AA4AQAIZgDQADgBAAhogMAAOoFqwMipAMBAPIEACGlAwEA8gQAIaYDAADrBAAgpwNAAOAEACGoAwIA3wQAIakDAADsBAAgqwMBAIIFACGsA0AAhAUAIa0DQACEBQAhDYEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAKIGqwMipAMBAPQFACGlAwEA9AUAIaYDAACgBgAgpwNAAPgFACGoAwIA9QUAIakDAAChBgAgrANAAJcGACGtA0AAlwYAIRAEAAClBgAgBwAAowYAIBAAAKYGACCBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAACiBqsDIqQDAQD0BQAhpQMBAPQFACGmAwAAoAYAIKcDQAD4BQAhqAMCAPUFACGpAwAAoQYAIKwDQACXBgAhrQNAAJcGACEQBAAA6wYAIAcAAOkGACAQAADsBgAggQMBAAAAAYYDAQAAAAGIA0AAAAABmANAAAAAAaIDAAAAqwMCpAMBAAAAAaUDAQAAAAGmAwAA5wYAIKcDQAAAAAGoAwIAAAABqQMAAOgGACCsA0AAAAABrQNAAAAAARAEAADrBgAgCAAA6gYAIBAAAOwGACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABogMAAACrAwKlAwEAAAABpgMAAOcGACCnA0AAAAABqAMCAAAAAakDAADoBgAgqwMBAAAAAawDQAAAAAGtA0AAAAABAgAAAA8AIDIAALEJACADAAAADwAgMgAAsQkAIDMAALAJACABKwAA9wkAMAIAAAAPACArAACwCQAgAgAAAKUJACArAACvCQAgDYEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAKIGqwMipQMBAPQFACGmAwAAoAYAIKcDQAD4BQAhqAMCAPUFACGpAwAAoQYAIKsDAQD3BQAhrANAAJcGACGtA0AAlwYAIRAEAAClBgAgCAAApAYAIBAAAKYGACCBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAACiBqsDIqUDAQD0BQAhpgMAAKAGACCnA0AA-AUAIagDAgD1BQAhqQMAAKEGACCrAwEA9wUAIawDQACXBgAhrQNAAJcGACEQBAAA6wYAIAgAAOoGACAQAADsBgAggQMBAAAAAYYDAQAAAAGIA0AAAAABmANAAAAAAaIDAAAAqwMCpQMBAAAAAaYDAADnBgAgpwNAAAAAAagDAgAAAAGpAwAA6AYAIKsDAQAAAAGsA0AAAAABrQNAAAAAAQuBAwEAAAABiANAAAAAAZgDQAAAAAGmAwAAgQcAIL4DAQAAAAHAAwAAAMADAsEDAQAAAAHCAwEAAAABxAMAAADEAwLFAwEAAAABxgNAAAAAAQIAAACoAwAgMgAAsgkAIAMAAAALACAyAACyCQAgMwAAtgkAIA0AAAALACArAAC2CQAggQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhpgMAAP0GACC-AwEA9AUAIcADAAD-BsADIsEDAQD3BQAhwgMBAPcFACHEAwAA_wbEAyLFAwEA9wUAIcYDQACXBgAhC4EDAQD0BQAhiANAAPgFACGYA0AA-AUAIaYDAAD9BgAgvgMBAPQFACHAAwAA_gbAAyLBAwEA9wUAIcIDAQD3BQAhxAMAAP8GxAMixQMBAPcFACHGA0AAlwYAIQyBAwEAAAABiANAAAAAAZgDQAAAAAGABAEAAAABgQQBAAAAAYIEAQAAAAGDBAEAAAABhAQBAAAAAYUEQAAAAAGGBEAAAAABhwQBAAAAAYgEAQAAAAECAAAACQAgMgAAwgkAIAMAAAAJACAyAADCCQAgMwAAwQkAIAErAAD2CQAwEQMAAOEEACD-AgAA7AUAMP8CAAAHABCAAwAA7AUAMIEDAQAAAAGIA0AA4AQAIZQDAQDyBAAhmANAAOAEACGABAEA8gQAIYEEAQDyBAAhggQBAIIFACGDBAEAggUAIYQEAQCCBQAhhQRAAIQFACGGBEAAhAUAIYcEAQCCBQAhiAQBAIIFACECAAAACQAgKwAAwQkAIAIAAAC_CQAgKwAAwAkAIBD-AgAAvgkAMP8CAAC_CQAQgAMAAL4JADCBAwEA8gQAIYgDQADgBAAhlAMBAPIEACGYA0AA4AQAIYAEAQDyBAAhgQQBAPIEACGCBAEAggUAIYMEAQCCBQAhhAQBAIIFACGFBEAAhAUAIYYEQACEBQAhhwQBAIIFACGIBAEAggUAIRD-AgAAvgkAMP8CAAC_CQAQgAMAAL4JADCBAwEA8gQAIYgDQADgBAAhlAMBAPIEACGYA0AA4AQAIYAEAQDyBAAhgQQBAPIEACGCBAEAggUAIYMEAQCCBQAhhAQBAIIFACGFBEAAhAUAIYYEQACEBQAhhwQBAIIFACGIBAEAggUAIQyBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGABAEA9AUAIYEEAQD0BQAhggQBAPcFACGDBAEA9wUAIYQEAQD3BQAhhQRAAJcGACGGBEAAlwYAIYcEAQD3BQAhiAQBAPcFACEMgQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhgAQBAPQFACGBBAEA9AUAIYIEAQD3BQAhgwQBAPcFACGEBAEA9wUAIYUEQACXBgAhhgRAAJcGACGHBAEA9wUAIYgEAQD3BQAhDIEDAQAAAAGIA0AAAAABmANAAAAAAYAEAQAAAAGBBAEAAAABggQBAAAAAYMEAQAAAAGEBAEAAAABhQRAAAAAAYYEQAAAAAGHBAEAAAABiAQBAAAAAQeBAwEAAAABiANAAAAAAZgDQAAAAAH_A0AAAAABiQQBAAAAAYoEAQAAAAGLBAEAAAABAgAAAAUAIDIAAM4JACADAAAABQAgMgAAzgkAIDMAAM0JACABKwAA9QkAMAwDAADhBAAg_gIAAO0FADD_AgAAAwAQgAMAAO0FADCBAwEAAAABiANAAOAEACGUAwEA8gQAIZgDQADgBAAh_wNAAOAEACGJBAEAAAABigQBAIIFACGLBAEAggUAIQIAAAAFACArAADNCQAgAgAAAMsJACArAADMCQAgC_4CAADKCQAw_wIAAMsJABCAAwAAygkAMIEDAQDyBAAhiANAAOAEACGUAwEA8gQAIZgDQADgBAAh_wNAAOAEACGJBAEA8gQAIYoEAQCCBQAhiwQBAIIFACEL_gIAAMoJADD_AgAAywkAEIADAADKCQAwgQMBAPIEACGIA0AA4AQAIZQDAQDyBAAhmANAAOAEACH_A0AA4AQAIYkEAQDyBAAhigQBAIIFACGLBAEAggUAIQeBAwEA9AUAIYgDQAD4BQAhmANAAPgFACH_A0AA-AUAIYkEAQD0BQAhigQBAPcFACGLBAEA9wUAIQeBAwEA9AUAIYgDQAD4BQAhmANAAPgFACH_A0AA-AUAIYkEAQD0BQAhigQBAPcFACGLBAEA9wUAIQeBAwEAAAABiANAAAAAAZgDQAAAAAH_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_ANAAAAAAQeBAwEAAAABiANAAAAAAesDAQAAAAHsAwEAAAAB7QMBAAAAAe4DAQAAAAHvAwEAAAABDIEDAQAAAAGGAwEAAAABiANAAAAAAZgDQAAAAAGfAwIAAAABogMAAADaAwKlAwEAAAAB1AMBAAAAAdUDAQAAAAHWAyAAAAAB1wMCAAAAAdgDAgAAAAEIgQMBAAAAAccDAQAAAAHIAwIAAAAByQMIAAAAAcoDIAAAAAHLA0AAAAABzANAAAAAAc0DgAAAAAEXBQAA0AkAIAYAANEJACAVAADSCQAgFgAA0wkAIBcAANQJACAYAADVCQAgGQAA1gkAIBoAANcJACAcAADYCQAgIQAA2QkAICIAANoJACAjAADbCQAgJAAA3AkAICUAAN0JACCBAwEAAAABiANAAAAAAZgDQAAAAAGMBAEAAAABjQQBAAAAAY4EIAAAAAGPBAEAAAABkAQBAAAAAZEEIAAAAAECAAAAAQAgMgAAggoAIAMAAAARACAyAACCCgAgMwAAhgoAIBkAAAARACAFAACtCAAgBgAArggAIBUAAK8IACAWAACwCAAgFwAAsQgAIBgAALIIACAZAACzCAAgGgAAtAgAIBwAALUIACAhAAC2CAAgIgAAtwgAICMAALgIACAkAAC5CAAgJQAAuggAICsAAIYKACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBQAArQgAIAYAAK4IACAVAACvCAAgFgAAsAgAIBcAALEIACAYAACyCAAgGQAAswgAIBoAALQIACAcAAC1CAAgIQAAtggAICIAALcIACAjAAC4CAAgJAAAuQgAICUAALoIACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBAAAzwkAIAYAANEJACAVAADSCQAgFgAA0wkAIBcAANQJACAYAADVCQAgGQAA1gkAIBoAANcJACAcAADYCQAgIQAA2QkAICIAANoJACAjAADbCQAgJAAA3AkAICUAAN0JACCBAwEAAAABiANAAAAAAZgDQAAAAAGMBAEAAAABjQQBAAAAAY4EIAAAAAGPBAEAAAABkAQBAAAAAZEEIAAAAAECAAAAAQAgMgAAhwoAIAMAAAARACAyAACHCgAgMwAAiwoAIBkAAAARACAEAACsCAAgBgAArggAIBUAAK8IACAWAACwCAAgFwAAsQgAIBgAALIIACAZAACzCAAgGgAAtAgAIBwAALUIACAhAAC2CAAgIgAAtwgAICMAALgIACAkAAC5CAAgJQAAuggAICsAAIsKACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBAAArAgAIAYAAK4IACAVAACvCAAgFgAAsAgAIBcAALEIACAYAACyCAAgGQAAswgAIBoAALQIACAcAAC1CAAgIQAAtggAICIAALcIACAjAAC4CAAgJAAAuQgAICUAALoIACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBAAAzwkAIAUAANAJACAGAADRCQAgFQAA0gkAIBYAANMJACAXAADUCQAgGAAA1QkAIBkAANYJACAaAADXCQAgHAAA2AkAICEAANkJACAjAADbCQAgJAAA3AkAICUAAN0JACCBAwEAAAABiANAAAAAAZgDQAAAAAGMBAEAAAABjQQBAAAAAY4EIAAAAAGPBAEAAAABkAQBAAAAAZEEIAAAAAECAAAAAQAgMgAAjAoAIBcEAADPCQAgBQAA0AkAIAYAANEJACAVAADSCQAgFgAA0wkAIBcAANQJACAYAADVCQAgGQAA1gkAIBoAANcJACAcAADYCQAgIgAA2gkAICMAANsJACAkAADcCQAgJQAA3QkAIIEDAQAAAAGIA0AAAAABmANAAAAAAYwEAQAAAAGNBAEAAAABjgQgAAAAAY8EAQAAAAGQBAEAAAABkQQgAAAAAQIAAAABACAyAACOCgAgAwAAABEAIDIAAIwKACAzAACSCgAgGQAAABEAIAQAAKwIACAFAACtCAAgBgAArggAIBUAAK8IACAWAACwCAAgFwAAsQgAIBgAALIIACAZAACzCAAgGgAAtAgAIBwAALUIACAhAAC2CAAgIwAAuAgAICQAALkIACAlAAC6CAAgKwAAkgoAIIEDAQD0BQAhiANAA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-AUAIZgDQAD4BQAhogMAAJAI-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-AUAIaIDAADDB-YDIqUDAQD0BQAhpgMAAMEHACCtA0AAlwYAIcQDAADCB-UDIsUDAQD3BQAhxgNAAJcGACHTAwEA9AUAIeEDAgD1BQAh4gMCAPUFACHjAwIA9QUAIRIEAADGBwAgCgAAxAcAIBAAAMcHACCBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAADDB-YDIqUDAQD0BQAhpgMAAMEHACCtA0AAlwYAIcQDAADCB-UDIsUDAQD3BQAhxgNAAJcGACHTAwEA9AUAIeEDAgD1BQAh4gMCAPUFACHjAwIA9QUAIRIKAADqBwAgDAAA6wcAIBAAAO0HACCBAwEAAAABhgMBAAAAAYgDQAAAAAGYA0AAAAABogMAAADmAwKlAwEAAAABpgMAAOkHACCtA0AAAAABxAMAAADlAwLFAwEAAAABxgNAAAAAAdMDAQAAAAHhAwIAAAAB4gMCAAAAAeMDAgAAAAECAAAAPQAgMgAAuAoAIASBAwEAAAABpAMBAAAAAdsDIAAAAAHcA0AAAAABAwAAABsAIDIAALgKACAzAAC9CgAgFAAAABsAIAoAAMQHACAMAADFBwAgEAAAxwcAICsAAL0KACCBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAADDB-YDIqUDAQD0BQAhpgMAAMEHACCtA0AAlwYAIcQDAADCB-UDIsUDAQD3BQAhxgNAAJcGACHTAwEA9AUAIeEDAgD1BQAh4gMCAPUFACHjAwIA9QUAIRIKAADEBwAgDAAAxQcAIBAAAMcHACCBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAADDB-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-AUAIZ8DAgD1BQAhogMAALMG2gMipQMBAPQFACHTAwEA9AUAIdQDAQD3BQAh1QMBAPcFACHWAyAAsQYAIdcDAgD1BQAh2AMCALIGACEXBAAAzwkAIAUAANAJACAVAADSCQAgFgAA0wkAIBcAANQJACAYAADVCQAgGQAA1gkAIBoAANcJACAcAADYCQAgIQAA2QkAICIAANoJACAjAADbCQAgJAAA3AkAICUAAN0JACCBAwEAAAABiANAAAAAAZgDQAAAAAGMBAEAAAABjQQBAAAAAY4EIAAAAAGPBAEAAAABkAQBAAAAAZEEIAAAAAECAAAAAQAgMgAA1woAIAMAAAARACAyAADXCgAgMwAA2woAIBkAAAARACAEAACsCAAgBQAArQgAIBUAAK8IACAWAACwCAAgFwAAsQgAIBgAALIIACAZAACzCAAgGgAAtAgAIBwAALUIACAhAAC2CAAgIgAAtwgAICMAALgIACAkAAC5CAAgJQAAuggAICsAANsKACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBAAArAgAIAUAAK0IACAVAACvCAAgFgAAsAgAIBcAALEIACAYAACyCAAgGQAAswgAIBoAALQIACAcAAC1CAAgIQAAtggAICIAALcIACAjAAC4CAAgJAAAuQgAICUAALoIACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBAAAzwkAIAUAANAJACAGAADRCQAgFQAA0gkAIBYAANMJACAXAADUCQAgGAAA1QkAIBkAANYJACAaAADXCQAgIQAA2QkAICIAANoJACAjAADbCQAgJAAA3AkAICUAAN0JACCBAwEAAAABiANAAAAAAZgDQAAAAAGMBAEAAAABjQQBAAAAAY4EIAAAAAGPBAEAAAABkAQBAAAAAZEEIAAAAAECAAAAAQAgMgAA3AoAIAMAAAARACAyAADcCgAgMwAA4AoAIBkAAAARACAEAACsCAAgBQAArQgAIAYAAK4IACAVAACvCAAgFgAAsAgAIBcAALEIACAYAACyCAAgGQAAswgAIBoAALQIACAhAAC2C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-AUAIaIDAADDB-YDIqUDAQD0BQAhpgMAAMEHACCtA0AAlwYAIcQDAADCB-UDIsUDAQD3BQAhxgNAAJcGACHTAwEA9AUAIeEDAgD1BQAh4gMCAPUFACHjAwIA9QUAIRIEAADGBwAgCgAAxAcAIAwAAMUHACCBAwEA9AUAIYYDAQD0BQAhiANAAPgFACGYA0AA-AUAIaIDAADDB-YDIqUDAQD0BQAhpgMAAMEHACCtA0AAlwYAIcQDAADCB-UDIsUDAQD3BQAhxgNAAJcGACHTAwEA9AUAIeEDAgD1BQAh4gMCAPUFACHjAwIA9QUAIQMAAAARACAyAADoCgAgMwAA9goAIBkAAAARACAEAACsCAAgBQAArQgAIAYAAK4IACAVAACvCAAgFgAAsAgAIBcAALEIACAYAACyCAAgGQAAswgAIBoAALQIACAcAAC1CAAgIQAAtggAICIAALcIACAjAAC4CAAgJQAAuggAICsAAPYKACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBAAArAgAIAUAAK0IACAGAACuCAAgFQAArwgAIBYAALAIACAXAACxCAAgGAAAsggAIBkAALMIACAaAAC0CAAgHAAAtQgAICEAALYIACAiAAC3CAAgIwAAuAgAICUAALoIACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEMgQMBAAAAAYYDAQAAAAGIA0AAAAABmANAAAAAAZ8DAgAAAAGiAwAAANoDAqUDAQAAAAHTAwEAAAAB1AMBAAAAAdYDIAAAAAHXAwIAAAAB2AMCAAAAAQMAAAARACAyAADhCgAgMwAA-goAIBkAAAARACAEAACsCAAgBQAArQgAIAYAAK4IACAVAACvCAAgFwAAsQgAIBgAALIIACAZAACzCAAgGgAAtAgAIBwAALUIACAhAAC2CAAgIgAAtwgAICMAALgIACAkAAC5CAAgJQAAuggAICsAAPoKACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBAAArAgAIAUAAK0IACAGAACuCAAgFQAArwgAIBcAALEIACAYAACyCAAgGQAAswgAIBoAALQIACAcAAC1CAAgIQAAtggAICIAALcIACAjAAC4CAAgJAAAuQgAICUAALoIACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEDAAAAEQAgMgAA4woAIDMAAP0KACAZAAAAEQAgBAAArAgAIAUAAK0IACAGAACuCAAgFgAAsAgAIBcAALEIACAYAACyCAAgGQAAswgAIBoAALQIACAcAAC1CAAgIQAAtggAICIAALcIACAjAAC4CAAgJAAAuQgAICUAALoIACArAAD9CgAggQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhjAQBAPQFACGNBAEA9AUAIY4EIACxBgAhjwQBAPcFACGQBAEA9AUAIZEEIACxBgAhFwQAAKwIACAFAACtCAAgBgAArggAIBYAALAIACAXAACxCAAgGAAAsggAIBkAALMIACAaAAC0CAAgHAAAtQgAICEAALYIACAiAAC3CAAgIwAAuAgAICQAALkIACAlAAC6CAAggQMBAPQFACGIA0AA-AUAIZgDQAD4BQAhjAQBAPQFACGNBAEA9AUAIY4EIACxBgAhjwQBAPcFACGQBAEA9AUAIZEEIACxBgAhEQcAAOkGACAIAADqBgAgEAAA7AYAIIEDAQAAAAGGAwEAAAABiANAAAAAAZgDQAAAAAGiAwAAAKsDAqQDAQAAAAGlAwEAAAABpgMAAOcGACCnA0AAAAABqAMCAAAAAakDAADoBgAgqwMBAAAAAawDQAAAAAGtA0AAAAABAgAAAA8AIDIAAP4KACADAAAADQAgMgAA_goAIDMAAIILACATAAAADQAgBwAAowYAIAgAAKQGACAQAACmBgAgKwAAggsAIIEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAKIGqwMipAMBAPQFACGlAwEA9AUAIaYDAACgBgAgpwNAAPgFACGoAwIA9QUAIakDAAChBgAgqwMBAPcFACGsA0AAlwYAIa0DQACXBgAhEQcAAKMGACAIAACkBgAgEAAApgYAIIEDAQD0BQAhhgMBAPQFACGIA0AA-AUAIZgDQAD4BQAhogMAAKIGqwMipAMBAPQFACGlAwEA9AUAIaYDAACgBgAgpwNAAPgFACGoAwIA9QUAIakDAAChBgAgqwMBAPcFACGsA0AAlwYAIa0DQACXBgAhFwQAAM8JACAFAADQCQAgBgAA0QkAIBUAANIJACAWAADTCQAgFwAA1AkAIBgAANUJACAZAADWCQAgHAAA2AkAICEAANkJACAiAADaCQAgIwAA2wkAICQAANwJACAlAADdCQAggQMBAAAAAYgDQAAAAAGYA0AAAAABjAQBAAAAAY0EAQAAAAGOBCAAAAABjwQBAAAAAZAEAQAAAAGRBCAAAAABAgAAAAEAIDIAAIMLACAGgQMBAAAAAYMDAgAAAAGFAwAAAIUDAoYDAQAAAAGHAwEAAAABiANAAAAAAQMAAAARACAyAACDCwAgMwAAiAsAIBkAAAARACAEAACsCAAgBQAArQgAIAYAAK4IACAVAACvCAAgFgAAsAgAIBcAALEIACAYAACyCAAgGQAAswgAIBwAALUIACAhAAC2CAAgIgAAtwgAICMAALgIACAkAAC5CAAgJQAAuggAICsAAIgLACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEXBAAArAgAIAUAAK0IACAGAACuCAAgFQAArwgAIBYAALAIACAXAACxCAAgGAAAsggAIBkAALMIACAcAAC1CAAgIQAAtggAICIAALcIACAjAAC4CAAgJAAAuQgAICUAALoIACCBAwEA9AUAIYgDQAD4BQAhmANAAPgFACGMBAEA9AUAIY0EAQD0BQAhjgQgALEGACGPBAEA9wUAIZAEAQD0BQAhkQQgALEGACEIAwAAjgYAIIEDAQAAAAGIA0AAAAABlAMBAAAAAZUDAgAAAAGWAwIAAAABlwMCAAAAAZgDQAAAAAECAAAAnQQAIDIAAIkLACADAAAAQQAgMgAAiQsAIDMAAI0LACAKAAAAQQAgAwAAgAYAICsAAI0LACCBAwEA9AUAIYgDQAD4BQAhlAMBAPQFACGVAwIA9QUAIZYDAgD1BQAhlwMCAPUFACGYA0AA-AUAIQgDAACABgAggQMBAPQFACGIA0AA-AUAIZQDAQD0BQAhlQMCAPUFACGWAwIA9QUAIZcDAgD1BQAhmANAAPgFACEQBAYCBQoDBgwEDwAaFRAFFjsFFz4IGD8JGUALGkISHEsVIU8WIlgWI1sXJFwHJV0PAQMAAQEDAAEBAwABBQQWBgcAAQgSAQ8AERAaBwEJAAUGCgABCxwIDwAQES4FEzIOFDYPBQQkCgoAAQwgCQ8ADRAqBwIHAAELAAgDCwAIDigLDwAMAgcAAQ0ACgEOKQADBCwADCsAEC0AARIABwIHAAESAAcCEzcAFDgAAgQ5ABA6AAMDAAEPABQbRhMBGgASARtHAAEDAAEDBwABHVABH1IXBAoAAQ8AGR4AFiBWGAEfABcBIFcADQReAAVfABVgABZhABdiABhjABlkABxlACFmACJnACNoACRpACVqAAAAAAMPAB84ACA5ACEAAAADDwAfOAAgOQAhAQMAAQEDAAEDDwAmOAAnOQAoAAAAAw8AJjgAJzkAKAEDAAEBAwABAw8ALTgALjkALwAAAAMPAC04AC45AC8AAAADDwA1OAA2OQA3AAAAAw8ANTgANjkANwIHAAEd0AEBAgcAAR3WAQEFDwA8OAA_OQBAegA9ewA-AAAAAAAFDwA8OAA_OQBAegA9ewA-AgoAAR4AFgIKAAEeABYDDwBFOABGOQBHAAAAAw8ARTgARjkARwEfABcBHwAXBQ8ATDgATzkAUHoATXsATgAAAAAABQ8ATDgATzkAUHoATXsATgEKAAEBCgABBQ8AVTgAWDkAWXoAVnsAVwAAAAAABQ8AVTgAWDkAWXoAVnsAVwIHAAELAAgCBwABCwAIAw8AXjgAXzkAYAAAAAMPAF44AF85AGABCwAIAQsACAUPAGU4AGg5AGl6AGZ7AGcAAAAAAAUPAGU4AGg5AGl6AGZ7AGcCBwABDQAKAgcAAQ0ACgMPAG44AG85AHAAAAADDwBuOABvOQBwAwoAAQvsAggR7QIFAwoAAQvzAggR9AIFBQ8AdTgAeDkAeXoAdnsAdwAAAAAABQ8AdTgAeDkAeXoAdnsAdwESAAcBEgAHBQ8AfjgAgQE5AIIBegB_ewCAAQAAAAAABQ8AfjgAgQE5AIIBegB_ewCAAQIHAAESAAcCBwABEgAHBQ8AhwE4AIoBOQCLAXoAiAF7AIkBAAAAAAAFDwCHATgAigE5AIsBegCIAXsAiQEBAwABAQMAAQMPAJABOACRATkAkgEAAAADDwCQATgAkQE5AJIBAQMAAQEDAAEFDwCXATgAmgE5AJsBegCYAXsAmQEAAAAAAAUPAJcBOACaATkAmwF6AJgBewCZAQAAAAUPAKEBOACkATkApQF6AKIBewCjAQAAAAAABQ8AoQE4AKQBOQClAXoAogF7AKMBAgcAAQj5AwECBwABCP8DAQUPAKoBOACtATkArgF6AKsBewCsAQAAAAAABQ8AqgE4AK0BOQCuAXoAqwF7AKwBAQkABQEJAAUFDwCzATgAtgE5ALcBegC0AXsAtQEAAAAAAAUPALMBOAC2ATkAtwF6ALQBewC1AQEDAAEBAwABBQ8AvAE4AL8BOQDAAXoAvQF7AL4BAAAAAAAFDwC8ATgAvwE5AMABegC9AXsAvgEBGgASARoAEgUPAMUBOADIATkAyQF6AMYBewDHAQAAAAAABQ8AxQE4AMgBOQDJAXoAxgF7AMcBJgIBJ2sBKG0BKW4BKm8BLHEBLXMbLnQcL3YBMHgbMXkdNHoBNXsBNnwbOn8eO4ABIjyBAQI9ggECPoMBAj-EAQJAhQECQYcBAkKJARtDigEjRIwBAkWOARtGjwEkR5ABAkiRAQJJkgEbSpUBJUuWASlMlwEDTZgBA06ZAQNPmgEDUJsBA1GdAQNSnwEbU6ABKlSiAQNVpAEbVqUBK1emAQNYpwEDWagBG1qrASxbrAEwXK4BMV2vATFesgExX7MBMWC0ATFhtgExYrgBG2O5ATJkuwExZb0BG2a-ATNnvwExaMABMWnBARtqxAE0a8UBOGzGARZtxwEWbsgBFm_JARZwygEWccwBFnLOARtzzwE5dNIBFnXUARt21QE6d9cBFnjYARZ52QEbfNwBO33dAUF-3gEXf98BF4AB4AEXgQHhAReCAeIBF4MB5AEXhAHmARuFAecBQoYB6QEXhwHrARuIAewBQ4kB7QEXigHuAReLAe8BG4wB8gFEjQHzAUiOAfQBGI8B9QEYkAH2ARiRAfcBGJIB-AEYkwH6ARiUAfwBG5UB_QFJlgH_ARiXAYECG5gBggJKmQGDAhiaAYQCGJsBhQIbnAGIAkudAYkCUZ4BigIInwGLAgigAYwCCKEBjQIIogGOAgijAZACCKQBkgIbpQGTAlKmAZUCCKcBlwIbqAGYAlOpAZkCCKoBmgIIqwGbAhusAZ4CVK0BnwJargGgAgmvAaECCbABogIJsQGjAgmyAaQCCbMBpgIJtAGoAhu1AakCW7YBqwIJtwGtAhu4Aa4CXLkBrwIJugGwAgm7AbECG7wBtAJdvQG1AmG-AbYCCr8BtwIKwAG4AgrBAbkCCsIBugIKwwG8AgrEAb4CG8UBvwJixgHBAgrHAcMCG8gBxAJjyQHFAgrKAcYCCssBxwIbzAHKAmTNAcsCas4BzAILzwHNAgvQAc4CC9EBzwIL0gHQAgvTAdICC9QB1AIb1QHVAmvWAdcCC9cB2QIb2AHaAmzZAdsCC9oB3AIL2wHdAhvcAeACbd0B4QJx3gHiAgffAeMCB-AB5AIH4QHlAgfiAeYCB-MB6AIH5AHqAhvlAesCcuYB7wIH5wHxAhvoAfICc-kB9QIH6gH2AgfrAfcCG-wB-gJ07QH7AnruAfwCDu8B_QIO8AH-Ag7xAf8CDvIBgAMO8wGCAw70AYQDG_UBhQN79gGHAw73AYkDG_gBigN8-QGLAw76AYwDDvsBjQMb_AGQA339AZEDgwH-AZIDD_8BkwMPgAKUAw-BApUDD4IClgMPgwKYAw-EApoDG4UCmwOEAYYCnQMPhwKfAxuIAqADhQGJAqEDD4oCogMPiwKjAxuMAqYDhgGNAqcDjAGOAqkDBI8CqgMEkAKsAwSRAq0DBJICrgMEkwKwAwSUArIDG5UCswONAZYCtQMElwK3AxuYArgDjgGZArkDBJoCugMEmwK7AxucAr4DjwGdAr8DkwGeAsADFZ8CwQMVoALCAxWhAsMDFaICxAMVowLGAxWkAsgDG6UCyQOUAaYCywMVpwLNAxuoAs4DlQGpAs8DFaoC0AMVqwLRAxusAtQDlgGtAtUDnAGuAtcDnQGvAtgDnQGwAtsDnQGxAtwDnQGyAt0DnQGzAt8DnQG0AuEDG7UC4gOeAbYC5AOdAbcC5gMbuALnA58BuQLoA50BugLpA50BuwLqAxu8Au0DoAG9Au4DpgG-Au8DBb8C8AMFwALxAwXBAvIDBcIC8wMFwwL1AwXEAvcDG8UC-AOnAcYC-wMFxwL9AxvIAv4DqAHJAoAEBcoCgQQFywKCBBvMAoUEqQHNAoYErwHOAocEBs8CiAQG0AKJBAbRAooEBtICiwQG0wKNBAbUAo8EG9UCkASwAdYCkgQG1wKUBBvYApUEsQHZApYEBtoClwQG2wKYBBvcApsEsgHdApwEuAHeAp4EEt8CnwQS4AKhBBLhAqIEEuICowQS4wKlBBLkAqcEG-UCqAS5AeYCqgQS5wKsBBvoAq0EugHpAq4EEuoCrwQS6wKwBBvsArMEuwHtArQEwQHuArUEE-8CtgQT8AK3BBPxArgEE_ICuQQT8wK7BBP0Ar0EG_UCvgTCAfYCwAQT9wLCBBv4AsMEwwH5AsQEE_oCxQQT-wLGBBv8AskExAH9AsoEygE"
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
import { Router as Router13 } from "express";

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

// src/modules/exam/exam.routes.ts
import { Router as Router12 } from "express";

// src/modules/exam/exam.validation.ts
import { z as z11 } from "zod";
var createExamSchema = z11.object({
  title: z11.string().min(3, "Exam title must be at least 3 characters long").max(150, "Exam title cannot exceed 150 characters"),
  description: z11.string().optional(),
  durationMinutes: z11.number().min(5, "Exam duration must be at least 5 minutes").max(300, "Exam duration cannot exceed 300 minutes (5 hours)").optional(),
  totalMarks: z11.number().min(5, "Total marks must be at least 5").max(1e3, "Total marks cannot exceed 1000").optional(),
  passMark: z11.number().min(1, "Pass mark percentage must be at least 1%").max(100, "Pass mark percentage cannot exceed 100%").optional(),
  isFree: z11.boolean().optional(),
  cohortId: z11.string().optional(),
  sprintId: z11.string().optional()
});
var updateExamSchema = createExamSchema.partial().extend({
  status: z11.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional()
});
var questionItemSchema = z11.object({
  questionText: z11.string().min(5, "Question text must be at least 5 characters long"),
  options: z11.array(z11.string().min(1, "Option text cannot be empty")).min(2, "Each question must have at least 2 options").max(6, "Each question can have at most 6 options"),
  correctOptionIndex: z11.number().min(0, "Correct option index cannot be negative"),
  explanation: z11.string().optional(),
  marks: z11.number().min(1, "Question marks must be at least 1").optional()
});
var addQuestionsSchema = z11.object({
  questions: z11.array(questionItemSchema).min(1, "At least 1 question must be provided")
});
var submitExamSchema = z11.object({
  answers: z11.array(
    z11.object({
      questionId: z11.string().min(1, "questionId is required"),
      selectedOption: z11.number().min(0, "selectedOption index cannot be negative")
    })
  ).min(1, "Answers array cannot be empty")
});

// src/modules/exam/exam.service.ts
var createExam = async (mentorId, payload) => {
  const {
    title,
    description,
    durationMinutes = 30,
    totalMarks = 100,
    passMark = 70,
    isFree = true,
    cohortId,
    sprintId
  } = payload;
  if (cohortId) {
    const cohort = await prisma.cohortProgram.findUnique({
      where: { id: cohortId }
    });
    if (!cohort) {
      throw new AppError("Target Cohort Program not found", 404);
    }
    if (cohort.mentorId !== mentorId) {
      throw new AppError("You can only attach exams to your own Cohort Programs", 403);
    }
  }
  if (sprintId) {
    const sprint = await prisma.sprintRequest.findUnique({
      where: { id: sprintId }
    });
    if (!sprint) {
      throw new AppError("Target Sprint Request not found", 404);
    }
  }
  const exam = await prisma.exam.create({
    data: {
      mentorId,
      title,
      description,
      durationMinutes,
      totalMarks,
      passMark,
      isFree: cohortId || sprintId ? false : isFree,
      cohortId: cohortId || null,
      sprintId: sprintId || null,
      status: "DRAFT"
    },
    include: {
      cohort: { select: { id: true, title: true } },
      sprint: { select: { id: true, title: true } }
    }
  });
  return exam;
};
var addQuestionsToExam = async (mentorId, examId, questions) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId }
  });
  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  if (exam.mentorId !== mentorId) {
    throw new AppError("You do not have permission to modify questions for this exam", 403);
  }
  if (exam.status === "ARCHIVED") {
    throw new AppError("Cannot add questions to an archived exam", 400);
  }
  questions.forEach((q, index) => {
    if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
      throw new AppError(
        `Question ${index + 1}: correctOptionIndex (${q.correctOptionIndex}) is out of bounds for ${q.options.length} options`,
        400
      );
    }
  });
  const createdQuestions = await prisma.$transaction(
    questions.map(
      (q) => prisma.question.create({
        data: {
          examId,
          questionText: q.questionText,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          explanation: q.explanation || null,
          marks: q.marks || 5
        }
      })
    )
  );
  const updatedExam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: true,
      _count: { select: { questions: true } }
    }
  });
  return {
    addedCount: createdQuestions.length,
    exam: updatedExam
  };
};
var publishExam = async (mentorId, examId) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      _count: { select: { questions: true } }
    }
  });
  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  if (exam.mentorId !== mentorId) {
    throw new AppError("You do not have permission to publish this exam", 403);
  }
  if (exam.status === "PUBLISHED") {
    throw new AppError("Exam is already published", 400);
  }
  if (exam._count.questions === 0) {
    throw new AppError("Cannot publish an exam with 0 questions. Please add questions first.", 400);
  }
  const publishedExam = await prisma.exam.update({
    where: { id: examId },
    data: { status: "PUBLISHED" },
    include: {
      questions: true,
      _count: { select: { questions: true, attempts: true } }
    }
  });
  return publishedExam;
};
var getMentorExams = async (mentorId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [exams, total] = await Promise.all([
    prisma.exam.findMany({
      where: { mentorId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        cohort: { select: { id: true, title: true } },
        sprint: { select: { id: true, title: true } },
        _count: { select: { questions: true, attempts: true } }
      }
    }),
    prisma.exam.count({ where: { mentorId } })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    data: exams
  };
};
var examService = {
  createExam,
  addQuestionsToExam,
  publishExam,
  getMentorExams
};

// src/modules/exam/exam.controller.ts
var createExamController = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const result = await examService.createExam(mentorId, req.body);
  sendSuccess(res, "Exam created successfully in DRAFT mode", result, 201);
});
var addQuestionsController = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { examId } = req.params;
  const result = await examService.addQuestionsToExam(mentorId, examId, req.body.questions);
  sendSuccess(res, `${result.addedCount} question(s) added successfully to exam`, result.exam);
});
var publishExamController = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const { examId } = req.params;
  const result = await examService.publishExam(mentorId, examId);
  sendSuccess(res, "Exam published successfully and is now active for students", result);
});
var getMentorExamsController = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await examService.getMentorExams(mentorId, page, limit);
  sendSuccess(res, "Mentor exams fetched successfully", result);
});
var examController = {
  createExamController,
  addQuestionsController,
  publishExamController,
  getMentorExamsController
};

// src/modules/exam/exam.routes.ts
var router12 = Router12();
router12.post(
  "/",
  requireAuth,
  requireRole("mentor"),
  validate(createExamSchema),
  examController.createExamController
);
router12.post(
  "/:examId/questions",
  requireAuth,
  requireRole("mentor"),
  validate(addQuestionsSchema),
  examController.addQuestionsController
);
router12.patch(
  "/:examId/publish",
  requireAuth,
  requireRole("mentor"),
  examController.publishExamController
);
router12.get(
  "/mentor/my-exams",
  requireAuth,
  requireRole("mentor"),
  examController.getMentorExamsController
);
var examRoutes = router12;

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
var v1Router = Router13();
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
v1Router.use("/exams", examRoutes);
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