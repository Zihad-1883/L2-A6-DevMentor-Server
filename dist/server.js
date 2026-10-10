
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
import { emailOTP } from "better-auth/plugins";

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
  "inlineSchema": 'model User {\n  id            String   @id\n  name          String\n  email         String   @unique\n  emailVerified Boolean\n  image         String?\n  role          String   @default("student")\n  isBlocked     Boolean  @default(false)\n  createdAt     DateTime\n  updatedAt     DateTime\n\n  sessions             Session[]\n  accounts             Account[]\n  mentorProfile        MentorProfile?\n  sprintsRequested     SprintRequest[]            @relation("StudentSprints")\n  sprintsClaimed       SprintRequest[]            @relation("MentorSprints")\n  sprintsTargeted      SprintRequest[]            @relation("TargetedMentorSprints")\n  cohortsCreated       CohortProgram[]            @relation("MentorCohorts")\n  cohortEnrollments    CohortEnrollment[]         @relation("StudentCohortEnrollments")\n  cohortSessionsJoined CohortSessionParticipant[] @relation("StudentCohortSessions")\n  wallet               Wallet?\n  payments             Payment[]\n  studentCodeReviews   CodeReviewRequest[]        @relation("StudentCodeReviews")\n  mentorCodeReviews    CodeReviewRequest[]        @relation("MentorCodeReviews")\n  mentorSubmissions    CodeReviewSubmission[]     @relation("MentorSubmissions")\n  mentorExams          Exam[]                     @relation("MentorExams")\n  studentExamAttempts  ExamAttempt[]              @relation("StudentExamAttempts")\n  payoutRequests       PayoutRequest[]            @relation("MentorPayouts")\n  processedPayouts     PayoutRequest[]            @relation("AdminProcessedPayouts")\n\n  @@map("user")\n}\n\nmodel Session {\n  id        String   @id\n  expiresAt DateTime\n  token     String   @unique\n  createdAt DateTime\n  updatedAt DateTime\n  ipAddress String?\n  userAgent String?\n  userId    String\n  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@map("session")\n}\n\nmodel Account {\n  id                    String    @id\n  accountId             String\n  providerId            String\n  userId                String\n  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n  accessToken           String?\n  refreshToken          String?\n  idToken               String?\n  accessTokenExpiresAt  DateTime?\n  refreshTokenExpiresAt DateTime?\n  scope                 String?\n  password              String?\n  createdAt             DateTime\n  updatedAt             DateTime\n\n  @@map("account")\n}\n\nmodel Verification {\n  id         String    @id\n  identifier String\n  value      String\n  expiresAt  DateTime\n  createdAt  DateTime?\n  updatedAt  DateTime?\n\n  @@map("verification")\n}\n\nenum CodeReviewTier {\n  QUICK\n  DEEP\n}\n\nenum CodeReviewStatus {\n  OPEN\n  PREVIEW_LOCKED\n  CLAIMED\n  DELIVERED\n  COMPLETED\n  CANCELLED\n  EXPIRED\n}\n\nmodel CodeReviewRequest {\n  id             String           @id @default(cuid())\n  studentId      String\n  student        User             @relation("StudentCodeReviews", fields: [studentId], references: [id], onDelete: Cascade)\n  tier           CodeReviewTier   @default(QUICK)\n  title          String\n  description    String\n  codeSnippet    String? // Direct code snippet input by student\n  language       String?          @default("typescript") // e.g., "typescript", "javascript", "python"\n  githubRepoUrl  String?\n  branchName     String?          @default("main")\n  specificFiles  String?\n  attachmentUrl  String? // Direct file attachment or git diff patch URL (Cloudinary)\n  attachmentName String? // Original filename e.g. "feature.diff", "index.ts"\n  attachmentSize Int? // File size in bytes\n  creditReward   Int\n  status         CodeReviewStatus @default(OPEN)\n\n  previewMentorId  String?\n  previewExpiresAt DateTime?\n\n  assignedMentorId String?\n  assignedMentor   User?     @relation("MentorCodeReviews", fields: [assignedMentorId], references: [id])\n  deliveryDeadline DateTime?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  submission CodeReviewSubmission?\n\n  @@map("code_review_request")\n}\n\nmodel CodeReviewSubmission {\n  id        String            @id @default(cuid())\n  requestId String            @unique\n  request   CodeReviewRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)\n  mentorId  String\n  mentor    User              @relation("MentorSubmissions", fields: [mentorId], references: [id])\n\n  summary             String\n  reviewedCodeSnippet String?\n  videoUrl            String?\n  pullRequestUrl      String?\n  attachmentUrl       String?\n  attachmentName      String?\n\n  comments  CodeReviewComment[]\n  createdAt DateTime            @default(now())\n\n  @@map("code_review_submission")\n}\n\nmodel CodeReviewComment {\n  id           String               @id @default(cuid())\n  submissionId String\n  submission   CodeReviewSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)\n\n  filePath    String\n  lineNumber  Int\n  commentText String\n  severity    String? @default("SUGGESTION")\n\n  createdAt DateTime @default(now())\n\n  @@map("code_review_comment")\n}\n\nenum CohortApprovalStatus {\n  PENDING_APPROVAL\n  APPROVED\n  REJECTED\n}\n\nenum CohortStatus {\n  DRAFT\n  PUBLISHED\n  ARCHIVED\n}\n\nenum CohortSessionStatus {\n  PENDING\n  CONFIRMED\n  COMPLETED\n  CANCELLED\n}\n\nmodel CohortProgram {\n  id       String @id @default(cuid())\n  mentorId String\n  mentor   User   @relation("MentorCohorts", fields: [mentorId], references: [id], onDelete: Cascade)\n\n  title         String\n  description   String\n  durationWeeks Int\n  capacity      Int\n  totalCost     Int      @default(0)\n  techStackTags String[]\n\n  approvalStatus CohortApprovalStatus @default(PENDING_APPROVAL)\n  status         CohortStatus         @default(DRAFT)\n  approvedBy     String?\n  approvedAt     DateTime?\n\n  createdAt DateTime  @default(now())\n  updatedAt DateTime  @updatedAt\n  deletedAt DateTime?\n\n  enrollments CohortEnrollment[]\n  sessions    CohortSession[]\n  exams       Exam[]             @relation("CohortExams")\n\n  @@map("cohort_program")\n}\n\nmodel CohortEnrollment {\n  id        String        @id @default(cuid())\n  cohortId  String\n  cohort    CohortProgram @relation(fields: [cohortId], references: [id], onDelete: Cascade)\n  studentId String\n  student   User          @relation("StudentCohortEnrollments", fields: [studentId], references: [id], onDelete: Cascade)\n\n  enrolledAt DateTime @default(now())\n\n  @@unique([cohortId, studentId])\n  @@map("cohort_enrollment")\n}\n\nmodel CohortSession {\n  id       String        @id @default(cuid())\n  cohortId String\n  cohort   CohortProgram @relation(fields: [cohortId], references: [id], onDelete: Cascade)\n\n  sessionNumber   Int\n  dayNumber       Int\n  title           String\n  scheduledAt     DateTime\n  durationMinutes Int                 @default(60)\n  creditCost      Int\n  status          CohortSessionStatus @default(PENDING)\n  joinLink        String?\n  resources       Json?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  participants CohortSessionParticipant[]\n\n  @@map("cohort_session")\n}\n\nmodel CohortSessionParticipant {\n  id              String        @id @default(cuid())\n  cohortSessionId String\n  cohortSession   CohortSession @relation(fields: [cohortSessionId], references: [id], onDelete: Cascade)\n  studentId       String\n  student         User          @relation("StudentCohortSessions", fields: [studentId], references: [id], onDelete: Cascade)\n\n  paid     Boolean  @default(true)\n  joinedAt DateTime @default(now())\n\n  @@unique([cohortSessionId, studentId])\n  @@map("cohort_session_participant")\n}\n\nenum ExamStatus {\n  DRAFT\n  PUBLISHED\n  ARCHIVED\n}\n\nmodel Exam {\n  id       String @id @default(cuid())\n  mentorId String\n  mentor   User   @relation("MentorExams", fields: [mentorId], references: [id], onDelete: Cascade)\n\n  cohortId String?\n  cohort   CohortProgram? @relation("CohortExams", fields: [cohortId], references: [id], onDelete: SetNull)\n\n  sprintId String?\n  sprint   SprintRequest? @relation("SprintExams", fields: [sprintId], references: [id], onDelete: SetNull)\n\n  isFree Boolean @default(true)\n\n  title           String\n  description     String?\n  durationMinutes Int        @default(0)\n  totalQuestions  Int        @default(0)\n  totalMarks      Int        @default(0)\n  passMark        Int?       @default(60)\n  status          ExamStatus @default(DRAFT)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  questions Question[]\n  attempts  ExamAttempt[]\n\n  @@map("exam")\n}\n\nmodel Question {\n  id     String @id @default(cuid())\n  examId String\n  exam   Exam   @relation(fields: [examId], references: [id], onDelete: Cascade)\n\n  questionText       String\n  options            String[]\n  correctOptionIndex Int\n  explanation        String?\n  marks              Int      @default(1)\n\n  @@map("question")\n}\n\nmodel ExamAttempt {\n  id        String @id @default(cuid())\n  examId    String\n  exam      Exam   @relation(fields: [examId], references: [id], onDelete: Cascade)\n  studentId String\n  student   User   @relation("StudentExamAttempts", fields: [studentId], references: [id], onDelete: Cascade)\n\n  score       Int       @default(0)\n  percentage  Float     @default(0)\n  isPassed    Boolean   @default(false)\n  startedAt   DateTime  @default(now())\n  submittedAt DateTime?\n\n  answers Json\n\n  @@map("exam_attempt")\n}\n\nenum ExperienceLevel {\n  JUNIOR\n  MID\n  SENIOR\n}\n\nenum ApprovalStatus {\n  PENDING\n  APPROVED\n  REJECTED\n}\n\nmodel MentorProfile {\n  id     String @id @default(cuid())\n  userId String @unique\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  bio             String\n  techStackTags   String[]\n  experienceLevel ExperienceLevel @default(JUNIOR)\n  githubUrl       String?\n  resumeUrl       String?\n\n  approvalStatus ApprovalStatus @default(PENDING)\n  approvedBy     String?\n  approvedAt     DateTime?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@map("mentor_profile")\n}\n\nenum PaymentStatus {\n  INITIATED\n  COMPLETED\n  FAILED\n  CANCELLED\n  EXPIRED\n}\n\nmodel Payment {\n  id     String @id @default(cuid())\n  userId String\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  merchantInvoiceNumber String        @unique\n  paymentID             String?       @unique\n  trxID                 String?       @unique\n  amount                Int\n  status                PaymentStatus @default(INITIATED)\n  gatewayResponse       Json?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@map("payment")\n}\n\nmodel PlatformSetting {\n  id                       String   @id @default(cuid())\n  sprintCreditPerSession   Int      @default(50)\n  sessionCommissionPercent Int      @default(15)\n  updatedAt                DateTime @updatedAt\n\n  @@map("platform_setting")\n}\n\ngenerator client {\n  provider      = "prisma-client"\n  output        = "../../src/generated/prisma"\n  binaryTargets = ["native", "rhel-openssl-3.0.x"]\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nenum SprintStatus {\n  PENDING_CLAIM\n  CLAIMED\n  IN_PROGRESS\n  COMPLETED\n  CANCELLED\n}\n\nenum SprintSessionStatus {\n  PENDING\n  CONFIRMED\n  COMPLETED\n  CANCELLED\n}\n\nmodel SprintRequest {\n  id        String @id @default(cuid())\n  studentId String\n  student   User   @relation("StudentSprints", fields: [studentId], references: [id], onDelete: Cascade)\n\n  title         String\n  description   String\n  techStackTags String[]\n  startDate     DateTime\n  durationDays  Int\n  selectedDays  Int[]\n\n  status            SprintStatus @default(PENDING_CLAIM)\n  claimedByMentorId String?\n  claimedByMentor   User?        @relation("MentorSprints", fields: [claimedByMentorId], references: [id], onDelete: SetNull)\n  claimedAt         DateTime?\n\n  targetMentorId String?\n  targetMentor   User?   @relation("TargetedMentorSprints", fields: [targetMentorId], references: [id], onDelete: SetNull)\n\n  createdAt DateTime  @default(now())\n  updatedAt DateTime  @updatedAt\n  deletedAt DateTime?\n\n  sessions SprintSession[]\n  exams    Exam[]          @relation("SprintExams")\n\n  @@map("sprint_request")\n}\n\nmodel SprintSession {\n  id              String        @id @default(cuid())\n  sprintRequestId String\n  sprintRequest   SprintRequest @relation(fields: [sprintRequestId], references: [id], onDelete: Cascade)\n\n  dayNumber       Int\n  scheduledAt     DateTime?\n  durationMinutes Int                 @default(60)\n  creditCost      Int                 @default(0)\n  status          SprintSessionStatus @default(PENDING)\n  joinLink        String?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@map("sprint_session")\n}\n\nenum CreditTransactionType {\n  TOP_UP\n  SPRINT_ESCROW\n  SPRINT_RELEASE\n  SPRINT_REFUND\n  COHORT_FEE\n  COHORT_RELEASE\n  WITHDRAWAL\n  WITHDRAWAL_REFUND\n  PLATFORM_COMMISSION\n}\n\nenum PayoutStatus {\n  PENDING\n  PROCESSED\n  REJECTED\n}\n\nmodel Wallet {\n  id     String @id @default(cuid())\n  userId String @unique\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  balance        Int @default(0)\n  totalEarned    Int @default(0)\n  totalWithdrawn Int @default(0)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  transactions   CreditTransaction[]\n  payoutRequests PayoutRequest[]\n\n  @@map("wallet")\n}\n\nmodel CreditTransaction {\n  id       String @id @default(cuid())\n  walletId String\n  wallet   Wallet @relation(fields: [walletId], references: [id], onDelete: Cascade)\n\n  amount      Int\n  type        CreditTransactionType\n  description String\n  referenceId String?\n\n  createdAt DateTime @default(now())\n\n  @@map("credit_transaction")\n}\n\nmodel PayoutRequest {\n  id              String       @id @default(cuid())\n  mentorId        String\n  mentor          User         @relation("MentorPayouts", fields: [mentorId], references: [id], onDelete: Cascade)\n  walletId        String\n  wallet          Wallet       @relation(fields: [walletId], references: [id], onDelete: Cascade)\n  amountCredits   Int\n  amountBdt       Int\n  method          String       @default("BKASH")\n  accountNumber   String\n  status          PayoutStatus @default(PENDING)\n  processedBy     String?\n  admin           User?        @relation("AdminProcessedPayouts", fields: [processedBy], references: [id], onDelete: SetNull)\n  processedAt     DateTime?\n  rejectionReason String?\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@map("payout_request")\n}\n',
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
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"emailVerified","kind":"scalar","type":"Boolean"},{"name":"image","kind":"scalar","type":"String"},{"name":"role","kind":"scalar","type":"String"},{"name":"isBlocked","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"accounts","kind":"object","type":"Account","relationName":"AccountToUser"},{"name":"mentorProfile","kind":"object","type":"MentorProfile","relationName":"MentorProfileToUser"},{"name":"sprintsRequested","kind":"object","type":"SprintRequest","relationName":"StudentSprints"},{"name":"sprintsClaimed","kind":"object","type":"SprintRequest","relationName":"MentorSprints"},{"name":"sprintsTargeted","kind":"object","type":"SprintRequest","relationName":"TargetedMentorSprints"},{"name":"cohortsCreated","kind":"object","type":"CohortProgram","relationName":"MentorCohorts"},{"name":"cohortEnrollments","kind":"object","type":"CohortEnrollment","relationName":"StudentCohortEnrollments"},{"name":"cohortSessionsJoined","kind":"object","type":"CohortSessionParticipant","relationName":"StudentCohortSessions"},{"name":"wallet","kind":"object","type":"Wallet","relationName":"UserToWallet"},{"name":"payments","kind":"object","type":"Payment","relationName":"PaymentToUser"},{"name":"studentCodeReviews","kind":"object","type":"CodeReviewRequest","relationName":"StudentCodeReviews"},{"name":"mentorCodeReviews","kind":"object","type":"CodeReviewRequest","relationName":"MentorCodeReviews"},{"name":"mentorSubmissions","kind":"object","type":"CodeReviewSubmission","relationName":"MentorSubmissions"},{"name":"mentorExams","kind":"object","type":"Exam","relationName":"MentorExams"},{"name":"studentExamAttempts","kind":"object","type":"ExamAttempt","relationName":"StudentExamAttempts"},{"name":"payoutRequests","kind":"object","type":"PayoutRequest","relationName":"MentorPayouts"},{"name":"processedPayouts","kind":"object","type":"PayoutRequest","relationName":"AdminProcessedPayouts"}],"dbName":"user","schema":null},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"token","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":"session","schema":null},"Account":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String"},{"name":"providerId","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"AccountToUser"},{"name":"accessToken","kind":"scalar","type":"String"},{"name":"refreshToken","kind":"scalar","type":"String"},{"name":"idToken","kind":"scalar","type":"String"},{"name":"accessTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"refreshTokenExpiresAt","kind":"scalar","type":"DateTime"},{"name":"scope","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"account","schema":null},"Verification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"identifier","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"String"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"verification","schema":null},"CodeReviewRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCodeReviews"},{"name":"tier","kind":"enum","type":"CodeReviewTier"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"codeSnippet","kind":"scalar","type":"String"},{"name":"language","kind":"scalar","type":"String"},{"name":"githubRepoUrl","kind":"scalar","type":"String"},{"name":"branchName","kind":"scalar","type":"String"},{"name":"specificFiles","kind":"scalar","type":"String"},{"name":"attachmentUrl","kind":"scalar","type":"String"},{"name":"attachmentName","kind":"scalar","type":"String"},{"name":"attachmentSize","kind":"scalar","type":"Int"},{"name":"creditReward","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"CodeReviewStatus"},{"name":"previewMentorId","kind":"scalar","type":"String"},{"name":"previewExpiresAt","kind":"scalar","type":"DateTime"},{"name":"assignedMentorId","kind":"scalar","type":"String"},{"name":"assignedMentor","kind":"object","type":"User","relationName":"MentorCodeReviews"},{"name":"deliveryDeadline","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"submission","kind":"object","type":"CodeReviewSubmission","relationName":"CodeReviewRequestToCodeReviewSubmission"}],"dbName":"code_review_request","schema":null},"CodeReviewSubmission":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"requestId","kind":"scalar","type":"String"},{"name":"request","kind":"object","type":"CodeReviewRequest","relationName":"CodeReviewRequestToCodeReviewSubmission"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorSubmissions"},{"name":"summary","kind":"scalar","type":"String"},{"name":"reviewedCodeSnippet","kind":"scalar","type":"String"},{"name":"videoUrl","kind":"scalar","type":"String"},{"name":"pullRequestUrl","kind":"scalar","type":"String"},{"name":"attachmentUrl","kind":"scalar","type":"String"},{"name":"attachmentName","kind":"scalar","type":"String"},{"name":"comments","kind":"object","type":"CodeReviewComment","relationName":"CodeReviewCommentToCodeReviewSubmission"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"code_review_submission","schema":null},"CodeReviewComment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"submissionId","kind":"scalar","type":"String"},{"name":"submission","kind":"object","type":"CodeReviewSubmission","relationName":"CodeReviewCommentToCodeReviewSubmission"},{"name":"filePath","kind":"scalar","type":"String"},{"name":"lineNumber","kind":"scalar","type":"Int"},{"name":"commentText","kind":"scalar","type":"String"},{"name":"severity","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"code_review_comment","schema":null},"CohortProgram":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorCohorts"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"durationWeeks","kind":"scalar","type":"Int"},{"name":"capacity","kind":"scalar","type":"Int"},{"name":"totalCost","kind":"scalar","type":"Int"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"approvalStatus","kind":"enum","type":"CohortApprovalStatus"},{"name":"status","kind":"enum","type":"CohortStatus"},{"name":"approvedBy","kind":"scalar","type":"String"},{"name":"approvedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"enrollments","kind":"object","type":"CohortEnrollment","relationName":"CohortEnrollmentToCohortProgram"},{"name":"sessions","kind":"object","type":"CohortSession","relationName":"CohortProgramToCohortSession"},{"name":"exams","kind":"object","type":"Exam","relationName":"CohortExams"}],"dbName":"cohort_program","schema":null},"CohortEnrollment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortId","kind":"scalar","type":"String"},{"name":"cohort","kind":"object","type":"CohortProgram","relationName":"CohortEnrollmentToCohortProgram"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCohortEnrollments"},{"name":"enrolledAt","kind":"scalar","type":"DateTime"}],"dbName":"cohort_enrollment","schema":null},"CohortSession":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortId","kind":"scalar","type":"String"},{"name":"cohort","kind":"object","type":"CohortProgram","relationName":"CohortProgramToCohortSession"},{"name":"sessionNumber","kind":"scalar","type":"Int"},{"name":"dayNumber","kind":"scalar","type":"Int"},{"name":"title","kind":"scalar","type":"String"},{"name":"scheduledAt","kind":"scalar","type":"DateTime"},{"name":"durationMinutes","kind":"scalar","type":"Int"},{"name":"creditCost","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"CohortSessionStatus"},{"name":"joinLink","kind":"scalar","type":"String"},{"name":"resources","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"participants","kind":"object","type":"CohortSessionParticipant","relationName":"CohortSessionToCohortSessionParticipant"}],"dbName":"cohort_session","schema":null},"CohortSessionParticipant":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"cohortSessionId","kind":"scalar","type":"String"},{"name":"cohortSession","kind":"object","type":"CohortSession","relationName":"CohortSessionToCohortSessionParticipant"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentCohortSessions"},{"name":"paid","kind":"scalar","type":"Boolean"},{"name":"joinedAt","kind":"scalar","type":"DateTime"}],"dbName":"cohort_session_participant","schema":null},"Exam":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorExams"},{"name":"cohortId","kind":"scalar","type":"String"},{"name":"cohort","kind":"object","type":"CohortProgram","relationName":"CohortExams"},{"name":"sprintId","kind":"scalar","type":"String"},{"name":"sprint","kind":"object","type":"SprintRequest","relationName":"SprintExams"},{"name":"isFree","kind":"scalar","type":"Boolean"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"durationMinutes","kind":"scalar","type":"Int"},{"name":"totalQuestions","kind":"scalar","type":"Int"},{"name":"totalMarks","kind":"scalar","type":"Int"},{"name":"passMark","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"ExamStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"questions","kind":"object","type":"Question","relationName":"ExamToQuestion"},{"name":"attempts","kind":"object","type":"ExamAttempt","relationName":"ExamToExamAttempt"}],"dbName":"exam","schema":null},"Question":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"examId","kind":"scalar","type":"String"},{"name":"exam","kind":"object","type":"Exam","relationName":"ExamToQuestion"},{"name":"questionText","kind":"scalar","type":"String"},{"name":"options","kind":"scalar","type":"String"},{"name":"correctOptionIndex","kind":"scalar","type":"Int"},{"name":"explanation","kind":"scalar","type":"String"},{"name":"marks","kind":"scalar","type":"Int"}],"dbName":"question","schema":null},"ExamAttempt":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"examId","kind":"scalar","type":"String"},{"name":"exam","kind":"object","type":"Exam","relationName":"ExamToExamAttempt"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentExamAttempts"},{"name":"score","kind":"scalar","type":"Int"},{"name":"percentage","kind":"scalar","type":"Float"},{"name":"isPassed","kind":"scalar","type":"Boolean"},{"name":"startedAt","kind":"scalar","type":"DateTime"},{"name":"submittedAt","kind":"scalar","type":"DateTime"},{"name":"answers","kind":"scalar","type":"Json"}],"dbName":"exam_attempt","schema":null},"MentorProfile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"MentorProfileToUser"},{"name":"bio","kind":"scalar","type":"String"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"experienceLevel","kind":"enum","type":"ExperienceLevel"},{"name":"githubUrl","kind":"scalar","type":"String"},{"name":"resumeUrl","kind":"scalar","type":"String"},{"name":"approvalStatus","kind":"enum","type":"ApprovalStatus"},{"name":"approvedBy","kind":"scalar","type":"String"},{"name":"approvedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"mentor_profile","schema":null},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"PaymentToUser"},{"name":"merchantInvoiceNumber","kind":"scalar","type":"String"},{"name":"paymentID","kind":"scalar","type":"String"},{"name":"trxID","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"gatewayResponse","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"payment","schema":null},"PlatformSetting":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"sprintCreditPerSession","kind":"scalar","type":"Int"},{"name":"sessionCommissionPercent","kind":"scalar","type":"Int"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"platform_setting","schema":null},"SprintRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"studentId","kind":"scalar","type":"String"},{"name":"student","kind":"object","type":"User","relationName":"StudentSprints"},{"name":"title","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"techStackTags","kind":"scalar","type":"String"},{"name":"startDate","kind":"scalar","type":"DateTime"},{"name":"durationDays","kind":"scalar","type":"Int"},{"name":"selectedDays","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"SprintStatus"},{"name":"claimedByMentorId","kind":"scalar","type":"String"},{"name":"claimedByMentor","kind":"object","type":"User","relationName":"MentorSprints"},{"name":"claimedAt","kind":"scalar","type":"DateTime"},{"name":"targetMentorId","kind":"scalar","type":"String"},{"name":"targetMentor","kind":"object","type":"User","relationName":"TargetedMentorSprints"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"sessions","kind":"object","type":"SprintSession","relationName":"SprintRequestToSprintSession"},{"name":"exams","kind":"object","type":"Exam","relationName":"SprintExams"}],"dbName":"sprint_request","schema":null},"SprintSession":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"sprintRequestId","kind":"scalar","type":"String"},{"name":"sprintRequest","kind":"object","type":"SprintRequest","relationName":"SprintRequestToSprintSession"},{"name":"dayNumber","kind":"scalar","type":"Int"},{"name":"scheduledAt","kind":"scalar","type":"DateTime"},{"name":"durationMinutes","kind":"scalar","type":"Int"},{"name":"creditCost","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"SprintSessionStatus"},{"name":"joinLink","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"sprint_session","schema":null},"Wallet":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"UserToWallet"},{"name":"balance","kind":"scalar","type":"Int"},{"name":"totalEarned","kind":"scalar","type":"Int"},{"name":"totalWithdrawn","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"transactions","kind":"object","type":"CreditTransaction","relationName":"CreditTransactionToWallet"},{"name":"payoutRequests","kind":"object","type":"PayoutRequest","relationName":"PayoutRequestToWallet"}],"dbName":"wallet","schema":null},"CreditTransaction":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"walletId","kind":"scalar","type":"String"},{"name":"wallet","kind":"object","type":"Wallet","relationName":"CreditTransactionToWallet"},{"name":"amount","kind":"scalar","type":"Int"},{"name":"type","kind":"enum","type":"CreditTransactionType"},{"name":"description","kind":"scalar","type":"String"},{"name":"referenceId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"credit_transaction","schema":null},"PayoutRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"mentorId","kind":"scalar","type":"String"},{"name":"mentor","kind":"object","type":"User","relationName":"MentorPayouts"},{"name":"walletId","kind":"scalar","type":"String"},{"name":"wallet","kind":"object","type":"Wallet","relationName":"PayoutRequestToWallet"},{"name":"amountCredits","kind":"scalar","type":"Int"},{"name":"amountBdt","kind":"scalar","type":"Int"},{"name":"method","kind":"scalar","type":"String"},{"name":"accountNumber","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PayoutStatus"},{"name":"processedBy","kind":"scalar","type":"String"},{"name":"admin","kind":"object","type":"User","relationName":"AdminProcessedPayouts"},{"name":"processedAt","kind":"scalar","type":"DateTime"},{"name":"rejectionReason","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"payout_request","schema":null}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","user","sessions","accounts","mentorProfile","student","claimedByMentor","targetMentor","sprintRequest","mentor","cohort","enrollments","cohortSession","participants","_count","exams","sprint","exam","questions","attempts","sprintsRequested","sprintsClaimed","sprintsTargeted","cohortsCreated","cohortEnrollments","cohortSessionsJoined","wallet","transactions","admin","payoutRequests","payments","assignedMentor","request","submission","comments","studentCodeReviews","mentorCodeReviews","mentorSubmissions","mentorExams","studentExamAttempts","processedPayouts","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_min","_max","User.groupBy","User.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.createManyAndReturn","Session.updateOne","Session.updateMany","Session.updateManyAndReturn","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","Account.findUnique","Account.findUniqueOrThrow","Account.findFirst","Account.findFirstOrThrow","Account.findMany","Account.createOne","Account.createMany","Account.createManyAndReturn","Account.updateOne","Account.updateMany","Account.updateManyAndReturn","Account.upsertOne","Account.deleteOne","Account.deleteMany","Account.groupBy","Account.aggregate","Verification.findUnique","Verification.findUniqueOrThrow","Verification.findFirst","Verification.findFirstOrThrow","Verification.findMany","Verification.createOne","Verification.createMany","Verification.createManyAndReturn","Verification.updateOne","Verification.updateMany","Verification.updateManyAndReturn","Verification.upsertOne","Verification.deleteOne","Verification.deleteMany","Verification.groupBy","Verification.aggregate","CodeReviewRequest.findUnique","CodeReviewRequest.findUniqueOrThrow","CodeReviewRequest.findFirst","CodeReviewRequest.findFirstOrThrow","CodeReviewRequest.findMany","CodeReviewRequest.createOne","CodeReviewRequest.createMany","CodeReviewRequest.createManyAndReturn","CodeReviewRequest.updateOne","CodeReviewRequest.updateMany","CodeReviewRequest.updateManyAndReturn","CodeReviewRequest.upsertOne","CodeReviewRequest.deleteOne","CodeReviewRequest.deleteMany","_avg","_sum","CodeReviewRequest.groupBy","CodeReviewRequest.aggregate","CodeReviewSubmission.findUnique","CodeReviewSubmission.findUniqueOrThrow","CodeReviewSubmission.findFirst","CodeReviewSubmission.findFirstOrThrow","CodeReviewSubmission.findMany","CodeReviewSubmission.createOne","CodeReviewSubmission.createMany","CodeReviewSubmission.createManyAndReturn","CodeReviewSubmission.updateOne","CodeReviewSubmission.updateMany","CodeReviewSubmission.updateManyAndReturn","CodeReviewSubmission.upsertOne","CodeReviewSubmission.deleteOne","CodeReviewSubmission.deleteMany","CodeReviewSubmission.groupBy","CodeReviewSubmission.aggregate","CodeReviewComment.findUnique","CodeReviewComment.findUniqueOrThrow","CodeReviewComment.findFirst","CodeReviewComment.findFirstOrThrow","CodeReviewComment.findMany","CodeReviewComment.createOne","CodeReviewComment.createMany","CodeReviewComment.createManyAndReturn","CodeReviewComment.updateOne","CodeReviewComment.updateMany","CodeReviewComment.updateManyAndReturn","CodeReviewComment.upsertOne","CodeReviewComment.deleteOne","CodeReviewComment.deleteMany","CodeReviewComment.groupBy","CodeReviewComment.aggregate","CohortProgram.findUnique","CohortProgram.findUniqueOrThrow","CohortProgram.findFirst","CohortProgram.findFirstOrThrow","CohortProgram.findMany","CohortProgram.createOne","CohortProgram.createMany","CohortProgram.createManyAndReturn","CohortProgram.updateOne","CohortProgram.updateMany","CohortProgram.updateManyAndReturn","CohortProgram.upsertOne","CohortProgram.deleteOne","CohortProgram.deleteMany","CohortProgram.groupBy","CohortProgram.aggregate","CohortEnrollment.findUnique","CohortEnrollment.findUniqueOrThrow","CohortEnrollment.findFirst","CohortEnrollment.findFirstOrThrow","CohortEnrollment.findMany","CohortEnrollment.createOne","CohortEnrollment.createMany","CohortEnrollment.createManyAndReturn","CohortEnrollment.updateOne","CohortEnrollment.updateMany","CohortEnrollment.updateManyAndReturn","CohortEnrollment.upsertOne","CohortEnrollment.deleteOne","CohortEnrollment.deleteMany","CohortEnrollment.groupBy","CohortEnrollment.aggregate","CohortSession.findUnique","CohortSession.findUniqueOrThrow","CohortSession.findFirst","CohortSession.findFirstOrThrow","CohortSession.findMany","CohortSession.createOne","CohortSession.createMany","CohortSession.createManyAndReturn","CohortSession.updateOne","CohortSession.updateMany","CohortSession.updateManyAndReturn","CohortSession.upsertOne","CohortSession.deleteOne","CohortSession.deleteMany","CohortSession.groupBy","CohortSession.aggregate","CohortSessionParticipant.findUnique","CohortSessionParticipant.findUniqueOrThrow","CohortSessionParticipant.findFirst","CohortSessionParticipant.findFirstOrThrow","CohortSessionParticipant.findMany","CohortSessionParticipant.createOne","CohortSessionParticipant.createMany","CohortSessionParticipant.createManyAndReturn","CohortSessionParticipant.updateOne","CohortSessionParticipant.updateMany","CohortSessionParticipant.updateManyAndReturn","CohortSessionParticipant.upsertOne","CohortSessionParticipant.deleteOne","CohortSessionParticipant.deleteMany","CohortSessionParticipant.groupBy","CohortSessionParticipant.aggregate","Exam.findUnique","Exam.findUniqueOrThrow","Exam.findFirst","Exam.findFirstOrThrow","Exam.findMany","Exam.createOne","Exam.createMany","Exam.createManyAndReturn","Exam.updateOne","Exam.updateMany","Exam.updateManyAndReturn","Exam.upsertOne","Exam.deleteOne","Exam.deleteMany","Exam.groupBy","Exam.aggregate","Question.findUnique","Question.findUniqueOrThrow","Question.findFirst","Question.findFirstOrThrow","Question.findMany","Question.createOne","Question.createMany","Question.createManyAndReturn","Question.updateOne","Question.updateMany","Question.updateManyAndReturn","Question.upsertOne","Question.deleteOne","Question.deleteMany","Question.groupBy","Question.aggregate","ExamAttempt.findUnique","ExamAttempt.findUniqueOrThrow","ExamAttempt.findFirst","ExamAttempt.findFirstOrThrow","ExamAttempt.findMany","ExamAttempt.createOne","ExamAttempt.createMany","ExamAttempt.createManyAndReturn","ExamAttempt.updateOne","ExamAttempt.updateMany","ExamAttempt.updateManyAndReturn","ExamAttempt.upsertOne","ExamAttempt.deleteOne","ExamAttempt.deleteMany","ExamAttempt.groupBy","ExamAttempt.aggregate","MentorProfile.findUnique","MentorProfile.findUniqueOrThrow","MentorProfile.findFirst","MentorProfile.findFirstOrThrow","MentorProfile.findMany","MentorProfile.createOne","MentorProfile.createMany","MentorProfile.createManyAndReturn","MentorProfile.updateOne","MentorProfile.updateMany","MentorProfile.updateManyAndReturn","MentorProfile.upsertOne","MentorProfile.deleteOne","MentorProfile.deleteMany","MentorProfile.groupBy","MentorProfile.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","PlatformSetting.findUnique","PlatformSetting.findUniqueOrThrow","PlatformSetting.findFirst","PlatformSetting.findFirstOrThrow","PlatformSetting.findMany","PlatformSetting.createOne","PlatformSetting.createMany","PlatformSetting.createManyAndReturn","PlatformSetting.updateOne","PlatformSetting.updateMany","PlatformSetting.updateManyAndReturn","PlatformSetting.upsertOne","PlatformSetting.deleteOne","PlatformSetting.deleteMany","PlatformSetting.groupBy","PlatformSetting.aggregate","SprintRequest.findUnique","SprintRequest.findUniqueOrThrow","SprintRequest.findFirst","SprintRequest.findFirstOrThrow","SprintRequest.findMany","SprintRequest.createOne","SprintRequest.createMany","SprintRequest.createManyAndReturn","SprintRequest.updateOne","SprintRequest.updateMany","SprintRequest.updateManyAndReturn","SprintRequest.upsertOne","SprintRequest.deleteOne","SprintRequest.deleteMany","SprintRequest.groupBy","SprintRequest.aggregate","SprintSession.findUnique","SprintSession.findUniqueOrThrow","SprintSession.findFirst","SprintSession.findFirstOrThrow","SprintSession.findMany","SprintSession.createOne","SprintSession.createMany","SprintSession.createManyAndReturn","SprintSession.updateOne","SprintSession.updateMany","SprintSession.updateManyAndReturn","SprintSession.upsertOne","SprintSession.deleteOne","SprintSession.deleteMany","SprintSession.groupBy","SprintSession.aggregate","Wallet.findUnique","Wallet.findUniqueOrThrow","Wallet.findFirst","Wallet.findFirstOrThrow","Wallet.findMany","Wallet.createOne","Wallet.createMany","Wallet.createManyAndReturn","Wallet.updateOne","Wallet.updateMany","Wallet.updateManyAndReturn","Wallet.upsertOne","Wallet.deleteOne","Wallet.deleteMany","Wallet.groupBy","Wallet.aggregate","CreditTransaction.findUnique","CreditTransaction.findUniqueOrThrow","CreditTransaction.findFirst","CreditTransaction.findFirstOrThrow","CreditTransaction.findMany","CreditTransaction.createOne","CreditTransaction.createMany","CreditTransaction.createManyAndReturn","CreditTransaction.updateOne","CreditTransaction.updateMany","CreditTransaction.updateManyAndReturn","CreditTransaction.upsertOne","CreditTransaction.deleteOne","CreditTransaction.deleteMany","CreditTransaction.groupBy","CreditTransaction.aggregate","PayoutRequest.findUnique","PayoutRequest.findUniqueOrThrow","PayoutRequest.findFirst","PayoutRequest.findFirstOrThrow","PayoutRequest.findMany","PayoutRequest.createOne","PayoutRequest.createMany","PayoutRequest.createManyAndReturn","PayoutRequest.updateOne","PayoutRequest.updateMany","PayoutRequest.updateManyAndReturn","PayoutRequest.upsertOne","PayoutRequest.deleteOne","PayoutRequest.deleteMany","PayoutRequest.groupBy","PayoutRequest.aggregate","AND","OR","NOT","id","mentorId","walletId","amountCredits","amountBdt","method","accountNumber","PayoutStatus","status","processedBy","processedAt","rejectionReason","createdAt","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","amount","CreditTransactionType","type","description","referenceId","userId","balance","totalEarned","totalWithdrawn","every","some","none","sprintRequestId","dayNumber","scheduledAt","durationMinutes","creditCost","SprintSessionStatus","joinLink","studentId","title","techStackTags","startDate","durationDays","selectedDays","SprintStatus","claimedByMentorId","claimedAt","targetMentorId","deletedAt","has","hasEvery","hasSome","sprintCreditPerSession","sessionCommissionPercent","merchantInvoiceNumber","paymentID","trxID","PaymentStatus","gatewayResponse","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","bio","ExperienceLevel","experienceLevel","githubUrl","resumeUrl","ApprovalStatus","approvalStatus","approvedBy","approvedAt","examId","score","percentage","isPassed","startedAt","submittedAt","answers","questionText","options","correctOptionIndex","explanation","marks","cohortId","sprintId","isFree","totalQuestions","totalMarks","passMark","ExamStatus","cohortSessionId","paid","joinedAt","sessionNumber","CohortSessionStatus","resources","enrolledAt","durationWeeks","capacity","totalCost","CohortApprovalStatus","CohortStatus","submissionId","filePath","lineNumber","commentText","severity","requestId","summary","reviewedCodeSnippet","videoUrl","pullRequestUrl","attachmentUrl","attachmentName","CodeReviewTier","tier","codeSnippet","language","githubRepoUrl","branchName","specificFiles","attachmentSize","creditReward","CodeReviewStatus","previewMentorId","previewExpiresAt","assignedMentorId","deliveryDeadline","identifier","value","expiresAt","accountId","providerId","accessToken","refreshToken","idToken","accessTokenExpiresAt","refreshTokenExpiresAt","scope","password","token","ipAddress","userAgent","name","email","emailVerified","image","role","isBlocked","cohortSessionId_studentId","cohortId_studentId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","push","increment","decrement","multiply","divide"]'),
  graph: "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_AwIAjQUAIcEDAQCuBQAhAwoAAN4KACC9AwAAnAYAIMEDAACcBgAgDgoAAIwGACCTAwAAigYAMJQDAAAUABCVAwAAigYAMJYDAQAAAAGeAwAAiwbBAyKiA0AAjgUAIaMDQACOBQAhuwMBAJ4FACG8AwIAjQUAIb0DQACwBQAhvgMCAI0FACG_AwIAjQUAIcEDAQCuBQAhAwAAABQAIAEAABUAMAIAABYAIBYLAACPBQAgDAAAhgYAIBIAAIcGACAUAACIBgAgFQAAiQYAIJMDAACEBgAwlAMAABgAEJUDAACEBgAwlgMBAJ4FACGXAwEAngUAIZ4DAACFBvkDIqIDQACOBQAhowNAAI4FACGyAwEArgUAIb4DAgCNBQAhwwMBAJ4FACHyAwEArgUAIfMDAQCuBQAh9AMgAPcFACH1AwIAjQUAIfYDAgCNBQAh9wMCAOMFACEJCwAA2QYAIAwAAN0KACASAADeCgAgFAAA3woAIBUAANYKACCyAwAAnAYAIPIDAACcBgAg8wMAAJwGACD3AwAAnAYAIBYLAACPBQAgDAAAhgYAIBIAAIcGACAUAACIBgAgFQAAiQYAIJMDAACEBgAwlAMAABgAEJUDAACEBgAwlgMBAAAAAZcDAQCeBQAhngMAAIUG-QMiogNAAI4FACGjA0AAjgUAIbIDAQCuBQAhvgMCAI0FACHDAwEAngUAIfIDAQCuBQAh8wMBAK4FACH0AyAA9wUAIfUDAgCNBQAh9gMCAI0FACH3AwIA4wUAIQMAAAAYACABAAAZADACAAAaACAWBAAA8wUAIAsAAI8FACANAADyBQAgEQAA9AUAIJMDAADvBQAwlAMAABwAEJUDAADvBQAwlgMBAJ4FACGXAwEAngUAIZ4DAADxBYUEIqIDQACOBQAhowNAAI4FACGyAwEAngUAIcMDAQCeBQAhxAMAAJcFACDMA0AAsAUAIeMDAADwBYQEIuQDAQCuBQAh5QNAALAFACGABAIAjQUAIYEEAgCNBQAhggQCAI0FACEBAAAAHAAgCQcAAI8FACAMAACABgAgkwMAAIMGADCUAwAAHgAQlQMAAIMGADCWAwEAngUAIcIDAQCeBQAh8gMBAJ4FACH_A0AAjgUAIQIHAADZBgAgDAAA3QoAIAoHAACPBQAgDAAAgAYAIJMDAACDBgAwlAMAAB4AEJUDAACDBgAwlgMBAAAAAcIDAQCeBQAh8gMBAJ4FACH_A0AAjgUAIbUEAACCBgAgAwAAAB4AIAEAAB8AMAIAACAAIBIMAACABgAgDwAAgQYAIJMDAAD-BQAwlAMAACIAEJUDAAD-BQAwlgMBAJ4FACGeAwAA_wX-AyKiA0AAjgUAIaMDQACOBQAhvAMCAI0FACG9A0AAjgUAIb4DAgCNBQAhvwMCAI0FACHBAwEArgUAIcMDAQCeBQAh8gMBAJ4FACH8AwIAjQUAIf4DAADpBQAgBAwAAN0KACAPAADQCgAgwQMAAJwGACD-AwAAnAYAIBIMAACABgAgDwAAgQYAIJMDAAD-BQAwlAMAACIAEJUDAAD-BQAwlgMBAAAAAZ4DAAD_Bf4DIqIDQACOBQAhowNAAI4FACG8AwIAjQUAIb0DQACOBQAhvgMCAI0FACG_AwIAjQUAIcEDAQCuBQAhwwMBAJ4FACHyAwEAngUAIfwDAgCNBQAh_gMAAOkFACADAAAAIgAgAQAAIwAwAgAAJAAgCgcAAI8FACAOAAD9BQAgkwMAAPwFADCUAwAAJgAQlQMAAPwFADCWAwEAngUAIcIDAQCeBQAh-QMBAJ4FACH6AyAA9wUAIfsDQACOBQAhAgcAANkGACAOAADcCgAgCwcAAI8FACAOAAD9BQAgkwMAAPwFADCUAwAAJgAQlQMAAPwFADCWAwEAAAABwgMBAJ4FACH5AwEAngUAIfoDIAD3BQAh-wNAAI4FACG0BAAA-wUAIAMAAAAmACABAAAnADACAAAoACABAAAAJgAgAwAAABgAIAEAABkAMAIAABoAIAEAAAAeACABAAAAIgAgAQAAABgAIAEAAAANACALEwAA-QUAIJMDAAD6BQAwlAMAADAAEJUDAAD6BQAwlgMBAJ4FACHmAwEAngUAIe0DAQCeBQAh7gMAAJcFACDvAwIAjQUAIfADAQCuBQAh8QMCAI0FACECEwAA2woAIPADAACcBgAgCxMAAPkFACCTAwAA-gUAMJQDAAAwABCVAwAA-gUAMJYDAQAAAAHmAwEAngUAIe0DAQCeBQAh7gMAAJcFACDvAwIAjQUAIfADAQCuBQAh8QMCAI0FACEDAAAAMAAgAQAAMQAwAgAAMgAgDgcAAI8FACATAAD5BQAgkwMAAPUFADCUAwAANAAQlQMAAPUFADCWAwEAngUAIcIDAQCeBQAh5gMBAJ4FACHnAwIAjQUAIegDCAD2BQAh6QMgAPcFACHqA0AAjgUAIesDQACwBQAh7AMAAPgFACADBwAA2QYAIBMAANsKACDrAwAAnAYAIA4HAACPBQAgEwAA-QUAIJMDAAD1BQAwlAMAADQAEJUDAAD1BQAwlgMBAAAAAcIDAQCeBQAh5gMBAJ4FACHnAwIAjQUAIegDCAD2BQAh6QMgAPcFACHqA0AAjgUAIesDQACwBQAh7AMAAPgFACADAAAANAAgAQAANQAwAgAANgAgAQAAADAAIAEAAAA0ACABAAAAFAAgAQAAABgAIAMAAAANACABAAAOADACAAAPACADAAAADQAgAQAADgAwAgAADwAgBwQAANoKACALAADZBgAgDQAAzwoAIBEAANUKACDMAwAAnAYAIOQDAACcBgAg5QMAAJwGACAWBAAA8wUAIAsAAI8FACANAADyBQAgEQAA9AUAIJMDAADvBQAwlAMAABwAEJUDAADvBQAwlgMBAAAAAZcDAQCeBQAhngMAAPEFhQQiogNAAI4FACGjA0AAjgUAIbIDAQCeBQAhwwMBAJ4FACHEAwAAlwUAIMwDQACwBQAh4wMAAPAFhAQi5AMBAK4FACHlA0AAsAUAIYAEAgCNBQAhgQQCAI0FACGCBAIAjQUAIQMAAAAcACABAAA-ADACAAA_ACADAAAAHgAgAQAAHwAwAgAAIAAgAwAAACYAIAEAACcAMAIAACgAIA0DAACPBQAgHQAAkAUAIB8AAJEFACCTAwAAjAUAMJQDAABDABCVAwAAjAUAMJYDAQCeBQAhogNAAI4FACGjA0AAjgUAIbQDAQCeBQAhtQMCAI0FACG2AwIAjQUAIbcDAgCNBQAhAQAAAEMAIAscAADsBQAgkwMAAO0FADCUAwAARQAQlQMAAO0FADCWAwEAngUAIZgDAQCeBQAhogNAAI4FACGvAwIAjQUAIbEDAADuBbEDIrIDAQCeBQAhswMBAK4FACECHAAA0QoAILMDAACcBgAgCxwAAOwFACCTAwAA7QUAMJQDAABFABCVAwAA7QUAMJYDAQAAAAGYAwEAngUAIaIDQACOBQAhrwMCAI0FACGxAwAA7gWxAyKyAwEAngUAIbMDAQCuBQAhAwAAAEUAIAEAAEYAMAIAAEcAIBMLAACPBQAgHAAA7AUAIB4AAOUFACCTAwAA6gUAMJQDAABJABCVAwAA6gUAMJYDAQCeBQAhlwMBAJ4FACGYAwEAngUAIZkDAgCNBQAhmgMCAI0FACGbAwEAngUAIZwDAQCeBQAhngMAAOsFngMinwMBAK4FACGgA0AAsAUAIaEDAQCuBQAhogNAAI4FACGjA0AAjgUAIQYLAADZBgAgHAAA0QoAIB4AANkGACCfAwAAnAYAIKADAACcBgAgoQMAAJwGACATCwAAjwUAIBwAAOwFACAeAADlBQAgkwMAAOoFADCUAwAASQAQlQMAAOoFADCWAwEAAAABlwMBAJ4FACGYAwEAngUAIZkDAgCNBQAhmgMCAI0FACGbAwEAngUAIZwDAQCeBQAhngMAAOsFngMinwMBAK4FACGgA0AAsAUAIaEDAQCuBQAhogNAAI4FACGjA0AAjgUAIQMAAABJACABAABKADACAABLACABAAAAEQAgAQAAAEUAIAEAAABJACAOAwAAjwUAIJMDAADnBQAwlAMAAFAAEJUDAADnBQAwlgMBAJ4FACGeAwAA6AXWAyKiA0AAjgUAIaMDQACOBQAhrwMCAI0FACG0AwEAngUAIdIDAQCeBQAh0wMBAK4FACHUAwEArgUAIdYDAADpBQAgBAMAANkGACDTAwAAnAYAINQDAACcBgAg1gMAAJwGACAOAwAAjwUAIJMDAADnBQAwlAMAAFAAEJUDAADnBQAwlgMBAAAAAZ4DAADoBdYDIqIDQACOBQAhowNAAI4FACGvAwIAjQUAIbQDAQCeBQAh0gMBAAAAAdMDAQAAAAHUAwEAAAAB1gMAAOkFACADAAAAUAAgAQAAUQAwAgAAUgAgGwcAAI8FACAhAADlBQAgIwAA5gUAIJMDAADhBQAwlAMAAFQAEJUDAADhBQAwlgMBAJ4FACGeAwAA5AWbBCKiA0AAjgUAIaMDQACOBQAhsgMBAJ4FACHCAwEAngUAIcMDAQCeBQAhjwQBAK4FACGQBAEArgUAIZIEAADiBZIEIpMEAQCuBQAhlAQBAK4FACGVBAEArgUAIZYEAQCuBQAhlwQBAK4FACGYBAIA4wUAIZkEAgCNBQAhmwQBAK4FACGcBEAAsAUAIZ0EAQCuBQAhngRAALAFACEPBwAA2QYAICEAANkGACAjAADZCgAgjwQAAJwGACCQBAAAnAYAIJMEAACcBgAglAQAAJwGACCVBAAAnAYAIJYEAACcBgAglwQAAJwGACCYBAAAnAYAIJsEAACcBgAgnAQAAJwGACCdBAAAnAYAIJ4EAACcBgAgGwcAAI8FACAhAADlBQAgIwAA5gUAIJMDAADhBQAwlAMAAFQAEJUDAADhBQAwlgMBAAAAAZ4DAADkBZsEIqIDQACOBQAhowNAAI4FACGyAwEAngUAIcIDAQCeBQAhwwMBAJ4FACGPBAEArgUAIZAEAQCuBQAhkgQAAOIFkgQikwQBAK4FACGUBAEArgUAIZUEAQCuBQAhlgQBAK4FACGXBAEArgUAIZgEAgDjBQAhmQQCAI0FACGbBAEArgUAIZwEQACwBQAhnQQBAK4FACGeBEAAsAUAIQMAAABUACABAABVADACAABWACABAAAAEQAgEAsAAI8FACAiAADdBQAgJAAA3gUAIJMDAADcBQAwlAMAAFkAEJUDAADcBQAwlgMBAJ4FACGXAwEAngUAIaIDQACOBQAhigQBAJ4FACGLBAEAngUAIYwEAQCuBQAhjQQBAK4FACGOBAEArgUAIY8EAQCuBQAhkAQBAK4FACEBAAAAWQAgCyMAAOAFACCTAwAA3wUAMJQDAABbABCVAwAA3wUAMJYDAQCeBQAhogNAAI4FACGFBAEAngUAIYYEAQCeBQAhhwQCAI0FACGIBAEAngUAIYkEAQCuBQAhAiMAANkKACCJBAAAnAYAIAsjAADgBQAgkwMAAN8FADCUAwAAWwAQlQMAAN8FADCWAwEAAAABogNAAI4FACGFBAEAngUAIYYEAQCeBQAhhwQCAI0FACGIBAEAngUAIYkEAQCuBQAhAwAAAFsAIAEAAFwAMAIAAF0AIAEAAABbACADAAAAVAAgAQAAVQAwAgAAVgAgCAsAANkGACAiAADXCgAgJAAA2AoAIIwEAACcBgAgjQQAAJwGACCOBAAAnAYAII8EAACcBgAgkAQAAJwGACAQCwAAjwUAICIAAN0FACAkAADeBQAgkwMAANwFADCUAwAAWQAQlQMAANwFADCWAwEAAAABlwMBAJ4FACGiA0AAjgUAIYoEAQAAAAGLBAEAngUAIYwEAQCuBQAhjQQBAK4FACGOBAEArgUAIY8EAQCuBQAhkAQBAK4FACEDAAAAWQAgAQAAYQAwAgAAYgAgAwAAABgAIAEAABkAMAIAABoAIAMAAAA0ACABAAA1ADACAAA2ACADAAAASQAgAQAASgAwAgAASwAgAwAAAEkAIAEAAEoAMAIAAEsAIAEAAAADACABAAAABwAgAQAAAA0AIAEAAAANACABAAAADQAgAQAAABwAIAEAAAAeACABAAAAJgAgAQAAAFAAIAEAAABUACABAAAAVAAgAQAAAFkAIAEAAAAYACABAAAANAAgAQAAAEkAIAEAAABJACABAAAAAQAgEwQAAMoKACAFAADLCgAgBgAAzAoAIBYAAM0KACAXAADNCgAgGAAAzQoAIBkAAM4KACAaAADPCgAgGwAA0AoAIBwAANEKACAfAADbBgAgIAAA0goAICUAANMKACAmAADTCgAgJwAA1AoAICgAANUKACApAADWCgAgKgAA2wYAILEEAACcBgAgAwAAABEAIAEAAHkAMAIAAAEAIAMAAAARACABAAB5ADACAAABACADAAAAEQAgAQAAeQAwAgAAAQAgGwQAALgKACAFAAC5CgAgBgAAugoAIBYAALsKACAXAAC8CgAgGAAAvQoAIBkAAL4KACAaAAC_CgAgGwAAwAoAIBwAAMEKACAfAADICgAgIAAAwgoAICUAAMMKACAmAADECgAgJwAAxQoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQEwAAB9ACAJlgMBAAAAAaIDQAAAAAGjA0AAAAABrgQBAAAAAa8EAQAAAAGwBCAAAAABsQQBAAAAAbIEAQAAAAGzBCAAAAABATAAAH8AMAEwAAB_ADAbBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_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_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_ACADAAAAHAAgAQAAPgAwAgAAPwAgAwAAABwAIAEAAD4AMAIAAD8AIAMAAAAcACABAAA-ADACAAA_ACATBAAAtwgAIAsAALUIACANAAC2CAAgEQAAuAgAIJYDAQAAAAGXAwEAAAABngMAAACFBAKiA0AAAAABowNAAAAAAbIDAQAAAAHDAwEAAAABxAMAALQIACDMA0AAAAAB4wMAAACEBALkAwEAAAAB5QNAAAAAAYAEAgAAAAGBBAIAAAABggQCAAAAAQEwAACcAgAgD5YDAQAAAAGXAwEAAAABngMAAACFBAKiA0AAAAABowNAAAAAAbIDAQAAAAHDAwEAAAABxAMAALQIACDMA0AAAAAB4wMAAACEBALkAwEAAAAB5QNAAAAAAYAEAgAAAAGBBAIAAAABggQCAAAAAQEwAACeAgAwATAAAJ4CADATBAAAkQgAIAsAAI8IACANAACQCAAgEQAAkggAIJYDAQCiBgAhlwMBAKIGACGeAwAAjgiFBCKiA0AApwYAIaMDQACnBgAhsgMBAKIGACHDAwEAogYAIcQDAACMCAAgzANAAKUGACHjAwAAjQiEBCLkAwEApgYAIeUDQAClBgAhgAQCAKMGACGBBAIAowYAIYIEAgCjBgAhAgAAAD8AIDAAAKECACAPlgMBAKIGACGXAwEAogYAIZ4DAACOCIUEIqIDQACnBgAhowNAAKcGACGyAwEAogYAIcMDAQCiBgAhxAMAAIwIACDMA0AApQYAIeMDAACNCIQEIuQDAQCmBgAh5QNAAKUGACGABAIAowYAIYEEAgCjBgAhggQCAKMGACECAAAAHAAgMAAAowIAIAIAAAAcACAwAACjAgAgAwAAAD8AIDcAAJwCACA4AAChAgAgAQAAAD8AIAEAAAAcACAIEAAAhwgAID0AAIoIACA-AACJCAAgfwAAiAgAIIABAACLCAAgzAMAAJwGACDkAwAAnAYAIOUDAACcBgAgEpMDAADHBQAwlAMAAKoCABCVAwAAxwUAMJYDAQDzBAAhlwMBAPMEACGeAwAAyQWFBCKiA0AA-AQAIaMDQAD4BAAhsgMBAPMEACHDAwEA8wQAIcQDAACXBQAgzANAAPcEACHjAwAAyAWEBCLkAwEA9gQAIeUDQAD3BAAhgAQCAPQEACGBBAIA9AQAIYIEAgD0BAAhAwAAABwAIAEAAKkCADA8AACqAgAgAwAAABwAIAEAAD4AMAIAAD8AIAEAAAAgACABAAAAIAAgAwAAAB4AIAEAAB8AMAIAACAAIAMAAAAeACABAAAfADACAAAgACADAAAAHgAgAQAAHwAwAgAAIAAgBgcAAIYIACAMAACFCAAglgMBAAAAAcIDAQAAAAHyAwEAAAAB_wNAAAAAAQEwAACyAgAgBJYDAQAAAAHCAwEAAAAB8gMBAAAAAf8DQAAAAAEBMAAAtAIAMAEwAAC0AgAwBgcAAIQIACAMAACDCAAglgMBAKIGACHCAwEAogYAIfIDAQCiBgAh_wNAAKcGACECAAAAIAAgMAAAtwIAIASWAwEAogYAIcIDAQCiBgAh8gMBAKIGACH_A0AApwYAIQIAAAAeACAwAAC5AgAgAgAAAB4AIDAAALkCACADAAAAIAAgNwAAsgIAIDgAALcCACABAAAAIAAgAQAAAB4AIAMQAACACAAgPQAAgggAID4AAIEIACAHkwMAAMYFADCUAwAAwAIAEJUDAADGBQAwlgMBAPMEACHCAwEA8wQAIfIDAQDzBAAh_wNAAPgEACEDAAAAHgAgAQAAvwIAMDwAAMACACADAAAAHgAgAQAAHwAwAgAAIAAgAQAAACQAIAEAAAAkACADAAAAIgAgAQAAIwAwAgAAJAAgAwAAACIAIAEAACMAMAIAACQAIAMAAAAiACABAAAjADACAAAkACAPDAAA_gcAIA8AAP8HACCWAwEAAAABngMAAAD-AwKiA0AAAAABowNAAAAAAbwDAgAAAAG9A0AAAAABvgMCAAAAAb8DAgAAAAHBAwEAAAABwwMBAAAAAfIDAQAAAAH8AwIAAAAB_gOAAAAAAQEwAADIAgAgDZYDAQAAAAGeAwAAAP4DAqIDQAAAAAGjA0AAAAABvAMCAAAAAb0DQAAAAAG-AwIAAAABvwMCAAAAAcEDAQAAAAHDAwEAAAAB8gMBAAAAAfwDAgAAAAH-A4AAAAABATAAAMoCADABMAAAygIAMA8MAADwBwAgDwAA8QcAIJYDAQCiBgAhngMAAO8H_gMiogNAAKcGACGjA0AApwYAIbwDAgCjBgAhvQNAAKcGACG-AwIAowYAIb8DAgCjBgAhwQMBAKYGACHDAwEAogYAIfIDAQCiBgAh_AMCAKMGACH-A4AAAAABAgAAACQAIDAAAM0CACANlgMBAKIGACGeAwAA7wf-AyKiA0AApwYAIaMDQACnBgAhvAMCAKMGACG9A0AApwYAIb4DAgCjBgAhvwMCAKMGACHBAwEApgYAIcMDAQCiBgAh8gMBAKIGACH8AwIAowYAIf4DgAAAAAECAAAAIgAgMAAAzwIAIAIAAAAiACAwAADPAgAgAwAAACQAIDcAAMgCACA4AADNAgAgAQAAACQAIAEAAAAiACAHEAAA6gcAID0AAO0HACA-AADsBwAgfwAA6wcAIIABAADuBwAgwQMAAJwGACD-AwAAnAYAIBCTAwAAwgUAMJQDAADWAgAQlQMAAMIFADCWAwEA8wQAIZ4DAADDBf4DIqIDQAD4BAAhowNAAPgEACG8AwIA9AQAIb0DQAD4BAAhvgMCAPQEACG_AwIA9AQAIcEDAQD2BAAhwwMBAPMEACHyAwEA8wQAIfwDAgD0BAAh_gMAAKEFACADAAAAIgAgAQAA1QIAMDwAANYCACADAAAAIgAgAQAAIwAwAgAAJAAgAQAAACgAIAEAAAAoACADAAAAJgAgAQAAJwAwAgAAKAAgAwAAACYAIAEAACcAMAIAACgAIAMAAAAmACABAAAnADACAAAoACAHBwAA6QcAIA4AAOgHACCWAwEAAAABwgMBAAAAAfkDAQAAAAH6AyAAAAAB-wNAAAAAAQEwAADeAgAgBZYDAQAAAAHCAwEAAAAB-QMBAAAAAfoDIAAAAAH7A0AAAAABATAAAOACADABMAAA4AIAMAcHAADnBwAgDgAA5gcAIJYDAQCiBgAhwgMBAKIGACH5AwEAogYAIfoDIAD7BgAh-wNAAKcGACECAAAAKAAgMAAA4wIAIAWWAwEAogYAIcIDAQCiBgAh-QMBAKIGACH6AyAA-wYAIfsDQACnBgAhAgAAACYAIDAAAOUCACACAAAAJgAgMAAA5QIAIAMAAAAoACA3AADeAgAgOAAA4wIAIAEAAAAoACABAAAAJgAgAxAAAOMHACA9AADlBwAgPgAA5AcAIAiTAwAAwQUAMJQDAADsAgAQlQMAAMEFADCWAwEA8wQAIcIDAQDzBAAh-QMBAPMEACH6AyAAswUAIfsDQAD4BAAhAwAAACYAIAEAAOsCADA8AADsAgAgAwAAACYAIAEAACcAMAIAACgAIAEAAAAaACABAAAAGgAgAwAAABgAIAEAABkAMAIAABoAIAMAAAAYACABAAAZADACAAAaACADAAAAGAAgAQAAGQAwAgAAGgAgEwsAAKEHACAMAACiBwAgEgAA4gcAIBQAAKMHACAVAACkBwAglgMBAAAAAZcDAQAAAAGeAwAAAPkDAqIDQAAAAAGjA0AAAAABsgMBAAAAAb4DAgAAAAHDAwEAAAAB8gMBAAAAAfMDAQAAAAH0AyAAAAAB9QMCAAAAAfYDAgAAAAH3AwIAAAABATAAAPQCACAOlgMBAAAAAZcDAQAAAAGeAwAAAPkDAqIDQAAAAAGjA0AAAAABsgMBAAAAAb4DAgAAAAHDAwEAAAAB8gMBAAAAAfMDAQAAAAH0AyAAAAAB9QMCAAAAAfYDAgAAAAH3AwIAAAABATAAAPYCADABMAAA9gIAMAEAAAAcACABAAAADQAgEwsAAP8GACAMAACABwAgEgAA4QcAIBQAAIEHACAVAACCBwAglgMBAKIGACGXAwEAogYAIZ4DAAD9BvkDIqIDQACnBgAhowNAAKcGACGyAwEApgYAIb4DAgCjBgAhwwMBAKIGACHyAwEApgYAIfMDAQCmBgAh9AMgAPsGACH1AwIAowYAIfYDAgCjBgAh9wMCAPwGACECAAAAGgAgMAAA-wIAIA6WAwEAogYAIZcDAQCiBgAhngMAAP0G-QMiogNAAKcGACGjA0AApwYAIbIDAQCmBgAhvgMCAKMGACHDAwEAogYAIfIDAQCmBgAh8wMBAKYGACH0AyAA-wYAIfUDAgCjBgAh9gMCAKMGACH3AwIA_AYAIQIAAAAYACAwAAD9AgAgAgAAABgAIDAAAP0CACABAAAAHAAgAQAAAA0AIAMAAAAaACA3AAD0AgAgOAAA-wIAIAEAAAAaACABAAAAGAAgCRAAANwHACA9AADfBwAgPgAA3gcAIH8AAN0HACCAAQAA4AcAILIDAACcBgAg8gMAAJwGACDzAwAAnAYAIPcDAACcBgAgEZMDAAC6BQAwlAMAAIYDABCVAwAAugUAMJYDAQDzBAAhlwMBAPMEACGeAwAAvAX5AyKiA0AA-AQAIaMDQAD4BAAhsgMBAPYEACG-AwIA9AQAIcMDAQDzBAAh8gMBAPYEACHzAwEA9gQAIfQDIACzBQAh9QMCAPQEACH2AwIA9AQAIfcDAgC7BQAhAwAAABgAIAEAAIUDADA8AACGAwAgAwAAABgAIAEAABkAMAIAABoAIAEAAAAyACABAAAAMgAgAwAAADAAIAEAADEAMAIAADIAIAMAAAAwACABAAAxADACAAAyACADAAAAMAAgAQAAMQAwAgAAMgAgCBMAANsHACCWAwEAAAAB5gMBAAAAAe0DAQAAAAHuAwAAnwcAIO8DAgAAAAHwAwEAAAAB8QMCAAAAAQEwAACOAwAgB5YDAQAAAAHmAwEAAAAB7QMBAAAAAe4DAACfBwAg7wMCAAAAAfADAQAAAAHxAwIAAAABATAAAJADADABMAAAkAMAMAgTAADaBwAglgMBAKIGACHmAwEAogYAIe0DAQCiBgAh7gMAAJwHACDvAwIAowYAIfADAQCmBgAh8QMCAKMGACECAAAAMgAgMAAAkwMAIAeWAwEAogYAIeYDAQCiBgAh7QMBAKIGACHuAwAAnAcAIO8DAgCjBgAh8AMBAKYGACHxAwIAowYAIQIAAAAwACAwAACVAwAgAgAAADAAIDAAAJUDACADAAAAMgAgNwAAjgMAIDgAAJMDACABAAAAMgAgAQAAADAAIAYQAADVBwAgPQAA2AcAID4AANcHACB_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-AAC_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-gQAID0AAPoEACA-AAD6BAAgfwAAhAUAIIABAAD6BAAgpAMCAAAAAaUDAgAAAASmAwIAAAAEpwMCAAAAAagDAgAAAAGpAwIAAAABqgMCAAAAAasDAgCDBQAhBxAAAPoEACA9AACCBQAgPgAAggUAIKQDAAAAngMCpQMAAACeAwimAwAAAJ4DCKsDAACBBZ4DIg4QAAD9BAAgPQAAgAUAID4AAIAFACCkAwEAAAABpQMBAAAABaYDAQAAAAWnAwEAAAABqAMBAAAAAakDAQAAAAGqAwEAAAABqwMBAP8EACGsAwEAAAABrQMBAAAAAa4DAQAAAAELEAAA_QQAID0AAP4EACA-AAD-BAAgpANAAAAAAaUDQAAAAAWmA0AAAAAFpwNAAAAAAagDQAAAAAGpA0AAAAABqgNAAAAAAasDQAD8BAAhCxAAAPoEACA9AAD7BAAgPgAA-wQAIKQDQAAAAAGlA0AAAAAEpgNAAAAABKcDQAAAAAGoA0AAAAABqQNAAAAAAaoDQAAAAAGrA0AA-QQAIQsQAAD6BAAgPQAA-wQAID4AAPsEACCkA0AAAAABpQNAAAAABKYDQAAAAASnA0AAAAABqANAAAAAAakDQAAAAAGqA0AAAAABqwNAAPkEACEIpAMCAAAAAaUDAgAAAASmAwIAAAAEpwMCAAAAAagDAgAAAAGpAwIAAAABqgMCAAAAAasDAgD6BAAhCKQDQAAAAAGlA0AAAAAEpgNAAAAABKcDQAAAAAGoA0AAAAABqQNAAAAAAaoDQAAAAAGrA0AA-wQAIQsQAAD9BAAgPQAA_gQAID4AAP4EACCkA0AAAAABpQNAAAAABaYDQAAAAAWnA0AAAAABqANAAAAAAakDQAAAAAGqA0AAAAABqwNAAPwEACEIpAMCAAAAAaUDAgAAAAWmAwIAAAAFpwMCAAAAAagDAgAAAAGpAwIAAAABqgMCAAAAAasDAgD9BAAhCKQDQAAAAAGlA0AAAAAFpgNAAAAABacDQAAAAAGoA0AAAAABqQNAAAAAAaoDQAAAAAGrA0AA_gQAIQ4QAAD9BAAgPQAAgAUAID4AAIAFACCkAwEAAAABpQMBAAAABaYDAQAAAAWnAwEAAAABqAMBAAAAAakDAQAAAAGqAwEAAAABqwMBAP8EACGsAwEAAAABrQMBAAAAAa4DAQAAAAELpAMBAAAAAaUDAQAAAAWmAwEAAAAFpwMBAAAAAagDAQAAAAGpAwEAAAABqgMBAAAAAasDAQCABQAhrAMBAAAAAa0DAQAAAAGuAwEAAAABBxAAAPoEACA9AACCBQAgPgAAggUAIKQDAAAAngMCpQMAAACeAwimAwAAAJ4DCKsDAACBBZ4DIgSkAwAAAJ4DAqUDAAAAngMIpgMAAACeAwirAwAAggWeAyINEAAA-gQAID0AAPoEACA-AAD6BAAgfwAAhAUAIIABAAD6BAAgpAMCAAAAAaUDAgAAAASmAwIAAAAEpwMCAAAAAagDAgAAAAGpAwIAAAABqgMCAAAAAasDAgCDBQAhCKQDCAAAAAGlAwgAAAAEpgMIAAAABKcDCAAAAAGoAwgAAAABqQMIAAAAAaoDCAAAAAGrAwgAhAUAIQ4QAAD6BAAgPQAAhgUAID4AAIYFACCkAwEAAAABpQMBAAAABKYDAQAAAASnAwEAAAABqAMBAAAAAakDAQAAAAGqAwEAAAABqwMBAIUFACGsAwEAAAABrQMBAAAAAa4DAQAAAAELpAMBAAAAAaUDAQAAAASmAwEAAAAEpwMBAAAAAagDAQAAAAGpAwEAAAABqgMBAAAAAasDAQCGBQAhrAMBAAAAAa0DAQAAAAGuAwEAAAABCpMDAACHBQAwlAMAANcEABCVAwAAhwUAMJYDAQDzBAAhmAMBAPMEACGiA0AA-AQAIa8DAgD0BAAhsQMAAIgFsQMisgMBAPMEACGzAwEA9gQAIQcQAAD6BAAgPQAAigUAID4AAIoFACCkAwAAALEDAqUDAAAAsQMIpgMAAACxAwirAwAAiQWxAyIHEAAA-gQAID0AAIoFACA-AACKBQAgpAMAAACxAwKlAwAAALEDCKYDAAAAsQMIqwMAAIkFsQMiBKQDAAAAsQMCpQMAAACxAwimAwAAALEDCKsDAACKBbEDIgqTAwAAiwUAMJQDAADBBAAQlQMAAIsFADCWAwEA8wQAIaIDQAD4BAAhowNAAPgEACG0AwEA8wQAIbUDAgD0BAAhtgMCAPQEACG3AwIA9AQAIQ0DAACPBQAgHQAAkAUAIB8AAJEFACCTAwAAjAUAMJQDAABDABCVAwAAjAUAMJYDAQCeBQAhogNAAI4FACGjA0AAjgUAIbQDAQCeBQAhtQMCAI0FACG2AwIAjQUAIbcDAgCNBQAhCKQDAgAAAAGlAwIAAAAEpgMCAAAABKcDAgAAAAGoAwIAAAABqQMCAAAAAaoDAgAAAAGrAwIA-gQAIQikA0AAAAABpQNAAAAABKYDQAAAAASnA0AAAAABqANAAAAAAakDQAAAAAGqA0AAAAABqwNAAPsEACEgBAAAjgYAIAUAAI8GACAGAACQBgAgFgAAkQYAIBcAAJEGACAYAACRBgAgGQAAkgYAIBoAAPIFACAbAACBBgAgHAAAkwYAIB8AAJEFACAgAACUBgAgJQAAlQYAICYAAJUGACAnAACWBgAgKAAA9AUAICkAAIkGACAqAACRBQAgkwMAAI0GADCUAwAAEQAQlQMAAI0GADCWAwEAngUAIaIDQACOBQAhowNAAI4FACGuBAEAngUAIa8EAQCeBQAhsAQgAPcFACGxBAEArgUAIbIEAQCeBQAhswQgAPcFACG2BAAAEQAgtwQAABEAIAO4AwAARQAguQMAAEUAILoDAABFACADuAMAAEkAILkDAABJACC6AwAASQAgDZMDAACSBQAwlAMAAKkEABCVAwAAkgUAMJYDAQDzBAAhngMAAJMFwQMiogNAAPgEACGjA0AA-AQAIbsDAQDzBAAhvAMCAPQEACG9A0AA9wQAIb4DAgD0BAAhvwMCAPQEACHBAwEA9gQAIQcQAAD6BAAgPQAAlQUAID4AAJUFACCkAwAAAMEDAqUDAAAAwQMIpgMAAADBAwirAwAAlAXBAyIHEAAA-gQAID0AAJUFACA-AACVBQAgpAMAAADBAwKlAwAAAMEDCKYDAAAAwQMIqwMAAJQFwQMiBKQDAAAAwQMCpQMAAADBAwimAwAAAMEDCKsDAACVBcEDIhKTAwAAlgUAMJQDAACTBAAQlQMAAJYFADCWAwEA8wQAIZ4DAACZBckDIqIDQAD4BAAhowNAAPgEACGyAwEA8wQAIcIDAQDzBAAhwwMBAPMEACHEAwAAlwUAIMUDQAD4BAAhxgMCAPQEACHHAwAAmAUAIMkDAQD2BAAhygNAAPcEACHLAwEA9gQAIcwDQAD3BAAhBKQDAQAAAAXNAwEAAAABzgMBAAAABM8DAQAAAAQEpAMCAAAABc0DAgAAAAHOAwIAAAAEzwMCAAAABAcQAAD6BAAgPQAAmwUAID4AAJsFACCkAwAAAMkDAqUDAAAAyQMIpgMAAADJAwirAwAAmgXJAyIHEAAA-gQAID0AAJsFACA-AACbBQAgpAMAAADJAwKlAwAAAMkDCKYDAAAAyQMIqwMAAJoFyQMiBKQDAAAAyQMCpQMAAADJAwimAwAAAMkDCKsDAACbBckDIgeTAwAAnAUAMJQDAAD5AwAQlQMAAJwFADCWAwEA8wQAIaMDQAD4BAAh0AMCAPQEACHRAwIA9AQAIQeTAwAAnQUAMJQDAADmAwAQlQMAAJ0FADCWAwEAngUAIaMDQACOBQAh0AMCAI0FACHRAwIAjQUAIQukAwEAAAABpQMBAAAABKYDAQAAAASnAwEAAAABqAMBAAAAAakDAQAAAAGqAwEAAAABqwMBAIYFACGsAwEAAAABrQMBAAAAAa4DAQAAAAENkwMAAJ8FADCUAwAA4AMAEJUDAACfBQAwlgMBAPMEACGeAwAAoAXWAyKiA0AA-AQAIaMDQAD4BAAhrwMCAPQEACG0AwEA8wQAIdIDAQDzBAAh0wMBAPYEACHUAwEA9gQAIdYDAAChBQAgBxAAAPoEACA9AACkBQAgPgAApAUAIKQDAAAA1gMCpQMAAADWAwimAwAAANYDCKsDAACjBdYDIg8QAAD9BAAgPQAAogUAID4AAKIFACCkA4AAAAABpwOAAAAAAagDgAAAAAGpA4AAAAABqgOAAAAAAasDgAAAAAHXAwEAAAAB2AMBAAAAAdkDAQAAAAHaA4AAAAAB2wOAAAAAAdwDgAAAAAEMpAOAAAAAAacDgAAAAAGoA4AAAAABqQOAAAAAAaoDgAAAAAGrA4AAAAAB1wMBAAAAAdgDAQAAAAHZAwEAAAAB2gOAAAAAAdsDgAAAAAHcA4AAAAABBxAAAPoEACA9AACkBQAgPgAApAUAIKQDAAAA1gMCpQMAAADWAwimAwAAANYDCKsDAACjBdYDIgSkAwAAANYDAqUDAAAA1gMIpgMAAADWAwirAwAApAXWAyIPkwMAAKUFADCUAwAAygMAEJUDAAClBQAwlgMBAPMEACGiA0AA-AQAIaMDQAD4BAAhtAMBAPMEACHEAwAAlwUAIN0DAQDzBAAh3wMAAKYF3wMi4AMBAPYEACHhAwEA9gQAIeMDAACnBeMDIuQDAQD2BAAh5QNAAPcEACEHEAAA-gQAID0AAKsFACA-AACrBQAgpAMAAADfAwKlAwAAAN8DCKYDAAAA3wMIqwMAAKoF3wMiBxAAAPoEACA9AACpBQAgPgAAqQUAIKQDAAAA4wMCpQMAAADjAwimAwAAAOMDCKsDAACoBeMDIgcQAAD6BAAgPQAAqQUAID4AAKkFACCkAwAAAOMDAqUDAAAA4wMIpgMAAADjAwirAwAAqAXjAyIEpAMAAADjAwKlAwAAAOMDCKYDAAAA4wMIqwMAAKkF4wMiBxAAAPoEACA9AACrBQAgPgAAqwUAIKQDAAAA3wMCpQMAAADfAwimAwAAAN8DCKsDAACqBd8DIgSkAwAAAN8DAqUDAAAA3wMIpgMAAADfAwirAwAAqwXfAyIQAwAAjwUAIJMDAACsBQAwlAMAAAsAEJUDAACsBQAwlgMBAJ4FACGiA0AAjgUAIaMDQACOBQAhtAMBAJ4FACHEAwAAlwUAIN0DAQCeBQAh3wMAAK0F3wMi4AMBAK4FACHhAwEArgUAIeMDAACvBeMDIuQDAQCuBQAh5QNAALAFACEEpAMAAADfAwKlAwAAAN8DCKYDAAAA3wMIqwMAAKsF3wMiC6QDAQAAAAGlAwEAAAAFpgMBAAAABacDAQAAAAGoAwEAAAABqQMBAAAAAaoDAQAAAAGrAwEAgAUAIawDAQAAAAGtAwEAAAABrgMBAAAAAQSkAwAAAOMDAqUDAAAA4wMIpgMAAADjAwirAwAAqQXjAyIIpANAAAAAAaUDQAAAAAWmA0AAAAAFpwNAAAAAAagDQAAAAAGpA0AAAAABqgNAAAAAAasDQAD-BAAhDJMDAACxBQAwlAMAALIDABCVAwAAsQUAMJYDAQDzBAAhwgMBAPMEACHmAwEA8wQAIecDAgD0BAAh6AMIALIFACHpAyAAswUAIeoDQAD4BAAh6wNAAPcEACHsAwAAtAUAIA0QAAD6BAAgPQAAhAUAID4AAIQFACB_AACEBQAggAEAAIQFACCkAwgAAAABpQMIAAAABKYDCAAAAASnAwgAAAABqAMIAAAAAakDCAAAAAGqAwgAAAABqwMIALgFACEFEAAA-gQAID0AALcFACA-AAC3BQAgpAMgAAAAAasDIAC2BQAhDxAAAPoEACA9AAC1BQAgPgAAtQUAIKQDgAAAAAGnA4AAAAABqAOAAAAAAakDgAAAAAGqA4AAAAABqwOAAAAAAdcDAQAAAAHYAwEAAAAB2QMBAAAAAdoDgAAAAAHbA4AAAAAB3AOAAAAAAQykA4AAAAABpwOAAAAAAagDgAAAAAGpA4AAAAABqgOAAAAAAasDgAAAAAHXAwEAAAAB2AMBAAAAAdkDAQAAAAHaA4AAAAAB2wOAAAAAAdwDgAAAAAEFEAAA-gQAID0AALcFACA-AAC3BQAgpAMgAAAAAasDIAC2BQAhAqQDIAAAAAGrAyAAtwUAIQ0QAAD6BAAgPQAAhAUAID4AAIQFACB_AACEBQAggAEAAIQFACCkAwgAAAABpQMIAAAABKYDCAAAAASnAwgAAAABqAMIAAAAAakDCAAAAAGqAwgAAAABqwMIALgFACEKkwMAALkFADCUAwAAnAMAEJUDAAC5BQAwlgMBAPMEACHmAwEA8wQAIe0DAQDzBAAh7gMAAJcFACDvAwIA9AQAIfADAQD2BAAh8QMCAPQEACERkwMAALoFADCUAwAAhgMAEJUDAAC6BQAwlgMBAPMEACGXAwEA8wQAIZ4DAAC8BfkDIqIDQAD4BAAhowNAAPgEACGyAwEA9gQAIb4DAgD0BAAhwwMBAPMEACHyAwEA9gQAIfMDAQD2BAAh9AMgALMFACH1AwIA9AQAIfYDAgD0BAAh9wMCALsFACENEAAA_QQAID0AAP0EACA-AAD9BAAgfwAAwAUAIIABAAD9BAAgpAMCAAAAAaUDAgAAAAWmAwIAAAAFpwMCAAAAAagDAgAAAAGpAwIAAAABqgMCAAAAAasDAgC_BQAhBxAAAPoEACA9AAC-BQAgPgAAvgUAIKQDAAAA-QMCpQMAAAD5AwimAwAAAPkDCKsDAAC9BfkDIgcQAAD6BAAgPQAAvgUAID4AAL4FACCkAwAAAPkDAqUDAAAA-QMIpgMAAAD5AwirAwAAvQX5AyIEpAMAAAD5AwKlAwAAAPkDCKYDAAAA-QMIqwMAAL4F-QMiDRAAAP0EACA9AAD9BAAgPgAA_QQAIH8AAMAFACCAAQAA_QQAIKQDAgAAAAGlAwIAAAAFpgMCAAAABacDAgAAAAGoAwIAAAABqQMCAAAAAaoDAgAAAAGrAwIAvwUAIQikAwgAAAABpQMIAAAABaYDCAAAAAWnAwgAAAABqAMIAAAAAakDCAAAAAGqAwgAAAABqwMIAMAFACEIkwMAAMEFADCUAwAA7AIAEJUDAADBBQAwlgMBAPMEACHCAwEA8wQAIfkDAQDzBAAh-gMgALMFACH7A0AA-AQAIRCTAwAAwgUAMJQDAADWAgAQlQMAAMIFADCWAwEA8wQAIZ4DAADDBf4DIqIDQAD4BAAhowNAAPgEACG8AwIA9AQAIb0DQAD4BAAhvgMCAPQEACG_AwIA9AQAIcEDAQD2BAAhwwMBAPMEACHyAwEA8wQAIfwDAgD0BAAh_gMAAKEFACAHEAAA-gQAID0AAMUFACA-AADFBQAgpAMAAAD-AwKlAwAAAP4DCKYDAAAA_gMIqwMAAMQF_gMiBxAAAPoEACA9AADFBQAgPgAAxQUAIKQDAAAA_gMCpQMAAAD-AwimAwAAAP4DCKsDAADEBf4DIgSkAwAAAP4DAqUDAAAA_gMIpgMAAAD-AwirAwAAxQX-AyIHkwMAAMYFADCUAwAAwAIAEJUDAADGBQAwlgMBAPMEACHCAwEA8wQAIfIDAQDzBAAh_wNAAPgEACESkwMAAMcFADCUAwAAqgIAEJUDAADHBQAwlgMBAPMEACGXAwEA8wQAIZ4DAADJBYUEIqIDQAD4BAAhowNAAPgEACGyAwEA8wQAIcMDAQDzBAAhxAMAAJcFACDMA0AA9wQAIeMDAADIBYQEIuQDAQD2BAAh5QNAAPcEACGABAIA9AQAIYEEAgD0BAAhggQCAPQEACEHEAAA-gQAID0AAM0FACA-AADNBQAgpAMAAACEBAKlAwAAAIQECKYDAAAAhAQIqwMAAMwFhAQiBxAAAPoEACA9AADLBQAgPgAAywUAIKQDAAAAhQQCpQMAAACFBAimAwAAAIUECKsDAADKBYUEIgcQAAD6BAAgPQAAywUAID4AAMsFACCkAwAAAIUEAqUDAAAAhQQIpgMAAACFBAirAwAAygWFBCIEpAMAAACFBAKlAwAAAIUECKYDAAAAhQQIqwMAAMsFhQQiBxAAAPoEACA9AADNBQAgPgAAzQUAIKQDAAAAhAQCpQMAAACEBAimAwAAAIQECKsDAADMBYQEIgSkAwAAAIQEAqUDAAAAhAQIpgMAAACEBAirAwAAzQWEBCIKkwMAAM4FADCUAwAAlAIAEJUDAADOBQAwlgMBAPMEACGiA0AA-AQAIYUEAQDzBAAhhgQBAPMEACGHBAIA9AQAIYgEAQDzBAAhiQQBAPYEACENkwMAAM8FADCUAwAA_gEAEJUDAADPBQAwlgMBAPMEACGXAwEA8wQAIaIDQAD4BAAhigQBAPMEACGLBAEA8wQAIYwEAQD2BAAhjQQBAPYEACGOBAEA9gQAIY8EAQD2BAAhkAQBAPYEACEYkwMAANAFADCUAwAA6AEAEJUDAADQBQAwlgMBAPMEACGeAwAA0gWbBCKiA0AA-AQAIaMDQAD4BAAhsgMBAPMEACHCAwEA8wQAIcMDAQDzBAAhjwQBAPYEACGQBAEA9gQAIZIEAADRBZIEIpMEAQD2BAAhlAQBAPYEACGVBAEA9gQAIZYEAQD2BAAhlwQBAPYEACGYBAIAuwUAIZkEAgD0BAAhmwQBAPYEACGcBEAA9wQAIZ0EAQD2BAAhngRAAPcEACEHEAAA-gQAID0AANYFACA-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_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-QMBAAAAAQoHAACPBQAgDgAA_QUAIJMDAAD8BQAwlAMAACYAEJUDAAD8BQAwlgMBAJ4FACHCAwEAngUAIfkDAQCeBQAh-gMgAPcFACH7A0AAjgUAIRQMAACABgAgDwAAgQYAIJMDAAD-BQAwlAMAACIAEJUDAAD-BQAwlgMBAJ4FACGeAwAA_wX-AyKiA0AAjgUAIaMDQACOBQAhvAMCAI0FACG9A0AAjgUAIb4DAgCNBQAhvwMCAI0FACHBAwEArgUAIcMDAQCeBQAh8gMBAJ4FACH8AwIAjQUAIf4DAADpBQAgtgQAACIAILcEAAAiACASDAAAgAYAIA8AAIEGACCTAwAA_gUAMJQDAAAiABCVAwAA_gUAMJYDAQCeBQAhngMAAP8F_gMiogNAAI4FACGjA0AAjgUAIbwDAgCNBQAhvQNAAI4FACG-AwIAjQUAIb8DAgCNBQAhwQMBAK4FACHDAwEAngUAIfIDAQCeBQAh_AMCAI0FACH-AwAA6QUAIASkAwAAAP4DAqUDAAAA_gMIpgMAAAD-AwirAwAAxQX-AyIYBAAA8wUAIAsAAI8FACANAADyBQAgEQAA9AUAIJMDAADvBQAwlAMAABwAEJUDAADvBQAwlgMBAJ4FACGXAwEAngUAIZ4DAADxBYUEIqIDQACOBQAhowNAAI4FACGyAwEAngUAIcMDAQCeBQAhxAMAAJcFACDMA0AAsAUAIeMDAADwBYQEIuQDAQCuBQAh5QNAALAFACGABAIAjQUAIYEEAgCNBQAhggQCAI0FACG2BAAAHAAgtwQAABwAIAO4AwAAJgAguQMAACYAILoDAAAmACACwgMBAAAAAfIDAQAAAAEJBwAAjwUAIAwAAIAGACCTAwAAgwYAMJQDAAAeABCVAwAAgwYAMJYDAQCeBQAhwgMBAJ4FACHyAwEAngUAIf8DQACOBQAhFgsAAI8FACAMAACGBgAgEgAAhwYAIBQAAIgGACAVAACJBgAgkwMAAIQGADCUAwAAGAAQlQMAAIQGADCWAwEAngUAIZcDAQCeBQAhngMAAIUG-QMiogNAAI4FACGjA0AAjgUAIbIDAQCuBQAhvgMCAI0FACHDAwEAngUAIfIDAQCuBQAh8wMBAK4FACH0AyAA9wUAIfUDAgCNBQAh9gMCAI0FACH3AwIA4wUAIQSkAwAAAPkDAqUDAAAA-QMIpgMAAAD5AwirAwAAvgX5AyIYBAAA8wUAIAsAAI8FACANAADyBQAgEQAA9AUAIJMDAADvBQAwlAMAABwAEJUDAADvBQAwlgMBAJ4FACGXAwEAngUAIZ4DAADxBYUEIqIDQACOBQAhowNAAI4FACGyAwEAngUAIcMDAQCeBQAhxAMAAJcFACDMA0AAsAUAIeMDAADwBYQEIuQDAQCuBQAh5QNAALAFACGABAIAjQUAIYEEAgCNBQAhggQCAI0FACG2BAAAHAAgtwQAABwAIBkEAACZBgAgBwAAjwUAIAgAAOUFACAJAADlBQAgEQAA9AUAIJMDAACXBgAwlAMAAA0AEJUDAACXBgAwlgMBAJ4FACGeAwAAmAbJAyKiA0AAjgUAIaMDQACOBQAhsgMBAJ4FACHCAwEAngUAIcMDAQCeBQAhxAMAAJcFACDFA0AAjgUAIcYDAgCNBQAhxwMAAJgFACDJAwEArgUAIcoDQACwBQAhywMBAK4FACHMA0AAsAUAIbYEAAANACC3BAAADQAgA7gDAAAwACC5AwAAMAAgugMAADAAIAO4AwAANAAguQMAADQAILoDAAA0ACAOCgAAjAYAIJMDAACKBgAwlAMAABQAEJUDAACKBgAwlgMBAJ4FACGeAwAAiwbBAyKiA0AAjgUAIaMDQACOBQAhuwMBAJ4FACG8AwIAjQUAIb0DQACwBQAhvgMCAI0FACG_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-CwAgOAAAgQwAILgEAAD_CwAguQQAAIAMACC-BAAArAQAIAM3AAD-CwAguAQAAP8LACC-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-BAAAzgYAMAQ3AAC-BgAwuAQAAL8GADC6BAAAwQYAIL4EAADCBgAwEwQAAMoKACAFAADLCgAgBgAAzAoAIBYAAM0KACAXAADNCgAgGAAAzQoAIBkAAM4KACAaAADPCgAgGwAA0AoAIBwAANEKACAfAADbBgAgIAAA0goAICUAANMKACAmAADTCgAgJwAA1AoAICgAANUKACApAADWCgAgKgAA2wYAILEEAACcBgAgAAAAAAAAAAG7BAAAAMEDAgU3AADyCwAgOAAA9QsAILgEAADzCwAguQQAAPQLACC-BAAADwAgAzcAAPILACC4BAAA8wsAIL4EAAAPACAAAAAAAAK7BAEAAAAEwQQBAAAABQK7BAIAAAAEwQQCAAAABQG7BAAAAMkDAgU3AADUCwAgOAAA8AsAILgEAADVCwAguQQAAO8LACC-BAAAAQAgBzcAANILACA4AADtCwAguAQAANMLACC5BAAA7AsAILwEAAARACC9BAAAEQAgvgQAAAEAIAc3AADQCwAgOAAA6gsAILgEAADRCwAguQQAAOkLACC8BAAAEQAgvQQAABEAIL4EAAABACALNwAApQcAMDgAAKoHADC4BAAApgcAMLkEAACnBwAwugQAAKgHACC7BAAAqQcAMLwEAACpBwAwvQQAAKkHADC-BAAAqQcAML8EAACrBwAwwAQAAKwHADALNwAA8QYAMDgAAPYGADC4BAAA8gYAMLkEAADzBgAwugQAAPQGACC7BAAA9QYAMLwEAAD1BgAwvQQAAPUGADC-BAAA9QYAML8EAAD3BgAwwAQAAPgGADARCwAAoQcAIAwAAKIHACAUAACjBwAgFQAApAcAIJYDAQAAAAGXAwEAAAABngMAAAD5AwKiA0AAAAABowNAAAAAAbIDAQAAAAG-AwIAAAABwwMBAAAAAfIDAQAAAAH0AyAAAAAB9QMCAAAAAfYDAgAAAAH3AwIAAAABAgAAABoAIDcAAKAHACADAAAAGgAgNwAAoAcAIDgAAP4GACABMAAA6AsAMBYLAACPBQAgDAAAhgYAIBIAAIcGACAUAACIBgAgFQAAiQYAIJMDAACEBgAwlAMAABgAEJUDAACEBgAwlgMBAAAAAZcDAQCeBQAhngMAAIUG-QMiogNAAI4FACGjA0AAjgUAIbIDAQCuBQAhvgMCAI0FACHDAwEAngUAIfIDAQCuBQAh8wMBAK4FACH0AyAA9wUAIfUDAgCNBQAh9gMCAI0FACH3AwIA4wUAIQIAAAAaACAwAAD-BgAgAgAAAPkGACAwAAD6BgAgEZMDAAD4BgAwlAMAAPkGABCVAwAA-AYAMJYDAQCeBQAhlwMBAJ4FACGeAwAAhQb5AyKiA0AAjgUAIaMDQACOBQAhsgMBAK4FACG-AwIAjQUAIcMDAQCeBQAh8gMBAK4FACHzAwEArgUAIfQDIAD3BQAh9QMCAI0FACH2AwIAjQUAIfcDAgDjBQAhEZMDAAD4BgAwlAMAAPkGABCVAwAA-AYAMJYDAQCeBQAhlwMBAJ4FACGeAwAAhQb5AyKiA0AAjgUAIaMDQACOBQAhsgMBAK4FACG-AwIAjQUAIcMDAQCeBQAh8gMBAK4FACHzAwEArgUAIfQDIAD3BQAh9QMCAI0FACH2AwIAjQUAIfcDAgDjBQAhDZYDAQCiBgAhlwMBAKIGACGeAwAA_Qb5AyKiA0AApwYAIaMDQACnBgAhsgMBAKYGACG-AwIAowYAIcMDAQCiBgAh8gMBAKYGACH0AyAA-wYAIfUDAgCjBgAh9gMCAKMGACH3AwIA_AYAIQG7BCAAAAABBbsEAgAAAAHCBAIAAAABwwQCAAAAAcQEAgAAAAHFBAIAAAABAbsEAAAA-QMCEQsAAP8GACAMAACABwAgFAAAgQcAIBUAAIIHACCWAwEAogYAIZcDAQCiBgAhngMAAP0G-QMiogNAAKcGACGjA0AApwYAIbIDAQCmBgAhvgMCAKMGACHDAwEAogYAIfIDAQCmBgAh9AMgAPsGACH1AwIAowYAIfYDAgCjBgAh9wMCAPwGACEFNwAA2QsAIDgAAOYLACC4BAAA2gsAILkEAADlCwAgvgQAAAEAIAc3AADXCwAgOAAA4wsAILgEAADYCwAguQQAAOILACC8BAAAHAAgvQQAABwAIL4EAAA_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-BAAAAQAgAzcAANcLACC4BAAA2AsAIL4EAAA_ACAENwAAkgcAMLgEAACTBwAwugQAAJUHACC-BAAAlgcAMAQ3AACDBwAwuAQAAIQHADC6BAAAhgcAIL4EAACHBwAwCZYDAQAAAAGeAwAAAMEDAqIDQAAAAAGjA0AAAAABvAMCAAAAAb0DQAAAAAG-AwIAAAABvwMCAAAAAcEDAQAAAAECAAAAFgAgNwAAsAcAIAMAAAAWACA3AACwBwAgOAAArwcAIAEwAADWCwAwDgoAAIwGACCTAwAAigYAMJQDAAAUABCVAwAAigYAMJYDAQAAAAGeAwAAiwbBAyKiA0AAjgUAIaMDQACOBQAhuwMBAJ4FACG8AwIAjQUAIb0DQACwBQAhvgMCAI0FACG_AwIAjQUAIcEDAQCuBQAhAgAAABYAIDAAAK8HACACAAAArQcAIDAAAK4HACANkwMAAKwHADCUAwAArQcAEJUDAACsBwAwlgMBAJ4FACGeAwAAiwbBAyKiA0AAjgUAIaMDQACOBQAhuwMBAJ4FACG8AwIAjQUAIb0DQACwBQAhvgMCAI0FACG_AwIAjQUAIcEDAQCuBQAhDZMDAACsBwAwlAMAAK0HABCVAwAArAcAMJYDAQCeBQAhngMAAIsGwQMiogNAAI4FACGjA0AAjgUAIbsDAQCeBQAhvAMCAI0FACG9A0AAsAUAIb4DAgCNBQAhvwMCAI0FACHBAwEArgUAIQmWAwEAogYAIZ4DAADhBsEDIqIDQACnBgAhowNAAKcGACG8AwIAowYAIb0DQAClBgAhvgMCAKMGACG_AwIAowYAIcEDAQCmBgAhCZYDAQCiBgAhngMAAOEGwQMiogNAAKcGACGjA0AApwYAIbwDAgCjBgAhvQNAAKUGACG-AwIAowYAIb8DAgCjBgAhwQMBAKYGACEJlgMBAAAAAZ4DAAAAwQMCogNAAAAAAaMDQAAAAAG8AwIAAAABvQNAAAAAAb4DAgAAAAG_AwIAAAABwQMBAAAAAQG7BAEAAAAEAbsEAgAAAAQDNwAA1AsAILgEAADVCwAgvgQAAAEAIAM3AADSCwAguAQAANMLACC-BAAAAQAgAzcAANALACC4BAAA0QsAIL4EAAABACAENwAApQcAMLgEAACmBwAwugQAAKgHACC-BAAAqQcAMAQ3AADxBgAwuAQAAPIGADC6BAAA9AYAIL4EAAD1BgAwAAAAAAAAAAAAAAG7BAAAANYDAgU3AADLCwAgOAAAzgsAILgEAADMCwAguQQAAM0LACC-BAAAAQAgAzcAAMsLACC4BAAAzAsAIL4EAAABACAAAAACuwQBAAAABMEEAQAAAAUBuwQAAADfAwIBuwQAAADjAwIFNwAAxgsAIDgAAMkLACC4BAAAxwsAILkEAADICwAgvgQAAAEAIAG7BAEAAAAEAzcAAMYLACC4BAAAxwsAIL4EAAABACAAAAAAAAU3AADBCwAgOAAAxAsAILgEAADCCwAguQQAAMMLACC-BAAAGgAgAzcAAMELACC4BAAAwgsAIL4EAAAaACAAAAAAAAU3AAC8CwAgOAAAvwsAILgEAAC9CwAguQQAAL4LACC-BAAAGgAgAzcAALwLACC4BAAAvQsAIL4EAAAaACAAAAAAAAc3AAC3CwAgOAAAugsAILgEAAC4CwAguQQAALkLACC8BAAADQAgvQQAAA0AIL4EAAAPACADNwAAtwsAILgEAAC4CwAgvgQAAA8AIAAAAAU3AACvCwAgOAAAtQsAILgEAACwCwAguQQAALQLACC-BAAAJAAgBTcAAK0LACA4AACyCwAguAQAAK4LACC5BAAAsQsAIL4EAAABACADNwAArwsAILgEAACwCwAgvgQAACQAIAM3AACtCwAguAQAAK4LACC-BAAAAQAgAAAAAAABuwQAAAD-AwIFNwAApwsAIDgAAKsLACC4BAAAqAsAILkEAACqCwAgvgQAAD8AIAs3AADyBwAwOAAA9wcAMLgEAADzBwAwuQQAAPQHADC6BAAA9QcAILsEAAD2BwAwvAQAAPYHADC9BAAA9gcAML4EAAD2BwAwvwQAAPgHADDABAAA-QcAMAUHAADpBwAglgMBAAAAAcIDAQAAAAH6AyAAAAAB-wNAAAAAAQIAAAAoACA3AAD9BwAgAwAAACgAIDcAAP0HACA4AAD8BwAgATAAAKkLADALBwAAjwUAIA4AAP0FACCTAwAA_AUAMJQDAAAmABCVAwAA_AUAMJYDAQAAAAHCAwEAngUAIfkDAQCeBQAh-gMgAPcFACH7A0AAjgUAIbQEAAD7BQAgAgAAACgAIDAAAPwHACACAAAA-gcAIDAAAPsHACAIkwMAAPkHADCUAwAA-gcAEJUDAAD5BwAwlgMBAJ4FACHCAwEAngUAIfkDAQCeBQAh-gMgAPcFACH7A0AAjgUAIQiTAwAA-QcAMJQDAAD6BwAQlQMAAPkHADCWAwEAngUAIcIDAQCeBQAh-QMBAJ4FACH6AyAA9wUAIfsDQACOBQAhBJYDAQCiBgAhwgMBAKIGACH6AyAA-wYAIfsDQACnBgAhBQcAAOcHACCWAwEAogYAIcIDAQCiBgAh-gMgAPsGACH7A0AApwYAIQUHAADpBwAglgMBAAAAAcIDAQAAAAH6AyAAAAAB-wNAAAAAAQM3AACnCwAguAQAAKgLACC-BAAAPwAgBDcAAPIHADC4BAAA8wcAMLoEAAD1BwAgvgQAAPYHADAAAAAFNwAAnwsAIDgAAKULACC4BAAAoAsAILkEAACkCwAgvgQAAD8AIAU3AACdCwAgOAAAogsAILgEAACeCwAguQQAAKELACC-BAAAAQAgAzcAAJ8LACC4BAAAoAsAIL4EAAA_ACADNwAAnQsAILgEAACeCwAgvgQAAAEAIAAAAAAAArsEAQAAAATBBAEAAAAFAbsEAAAAhAQCAbsEAAAAhQQCBTcAAJULACA4AACbCwAguAQAAJYLACC5BAAAmgsAIL4EAAABACALNwAAqAgAMDgAAK0IADC4BAAAqQgAMLkEAACqCAAwugQAAKsIACC7BAAArAgAMLwEAACsCAAwvQQAAKwIADC-BAAArAgAML8EAACuCAAwwAQAAK8IADALNwAAnAgAMDgAAKEIADC4BAAAnQgAMLkEAACeCAAwugQAAJ8IACC7BAAAoAgAMLwEAACgCAAwvQQAAKAIADC-BAAAoAgAML8EAACiCAAwwAQAAKMIADALNwAAkwgAMDgAAJcIADC4BAAAlAgAMLkEAACVCAAwugQAAJYIACC7BAAA9QYAMLwEAAD1BgAwvQQAAPUGADC-BAAA9QYAML8EAACYCAAwwAQAAPgGADARCwAAoQcAIBIAAOIHACAUAACjBwAgFQAApAcAIJYDAQAAAAGXAwEAAAABngMAAAD5AwKiA0AAAAABowNAAAAAAbIDAQAAAAG-AwIAAAABwwMBAAAAAfMDAQAAAAH0AyAAAAAB9QMCAAAAAfYDAgAAAAH3AwIAAAABAgAAABoAIDcAAJsIACADAAAAGgAgNwAAmwgAIDgAAJoIACABMAAAmQsAMAIAAAAaACAwAACaCAAgAgAAAPkGACAwAACZCAAgDZYDAQCiBgAhlwMBAKIGACGeAwAA_Qb5AyKiA0AApwYAIaMDQACnBgAhsgMBAKYGACG-AwIAowYAIcMDAQCiBgAh8wMBAKYGACH0AyAA-wYAIfUDAgCjBgAh9gMCAKMGACH3AwIA_AYAIRELAAD_BgAgEgAA4QcAIBQAAIEHACAVAACCBwAglgMBAKIGACGXAwEAogYAIZ4DAAD9BvkDIqIDQACnBgAhowNAAKcGACGyAwEApgYAIb4DAgCjBgAhwwMBAKIGACHzAwEApgYAIfQDIAD7BgAh9QMCAKMGACH2AwIAowYAIfcDAgD8BgAhEQsAAKEHACASAADiBwAgFAAAowcAIBUAAKQHACCWAwEAAAABlwMBAAAAAZ4DAAAA-QMCogNAAAAAAaMDQAAAAAGyAwEAAAABvgMCAAAAAcMDAQAAAAHzAwEAAAAB9AMgAAAAAfUDAgAAAAH2AwIAAAAB9wMCAAAAAQ0PAAD_BwAglgMBAAAAAZ4DAAAA_gMCogNAAAAAAaMDQAAAAAG8AwIAAAABvQNAAAAAAb4DAgAAAAG_AwIAAAABwQMBAAAAAcMDAQAAAAH8AwIAAAAB_gOAAAAAAQIAAAAkACA3AACnCAAgAwAAACQAIDcAAKcIACA4AACmCAAgATAAAJgLADASDAAAgAYAIA8AAIEGACCTAwAA_gUAMJQDAAAiABCVAwAA_gUAMJYDAQAAAAGeAwAA_wX-AyKiA0AAjgUAIaMDQACOBQAhvAMCAI0FACG9A0AAjgUAIb4DAgCNBQAhvwMCAI0FACHBAwEArgUAIcMDAQCeBQAh8gMBAJ4FACH8AwIAjQUAIf4DAADpBQAgAgAAACQAIDAAAKYIACACAAAApAgAIDAAAKUIACAQkwMAAKMIADCUAwAApAgAEJUDAACjCAAwlgMBAJ4FACGeAwAA_wX-AyKiA0AAjgUAIaMDQACOBQAhvAMCAI0FACG9A0AAjgUAIb4DAgCNBQAhvwMCAI0FACHBAwEArgUAIcMDAQCeBQAh8gMBAJ4FACH8AwIAjQUAIf4DAADpBQAgEJMDAACjCAAwlAMAAKQIABCVAwAAowgAMJYDAQCeBQAhngMAAP8F_gMiogNAAI4FACGjA0AAjgUAIbwDAgCNBQAhvQNAAI4FACG-AwIAjQUAIb8DAgCNBQAhwQMBAK4FACHDAwEAngUAIfIDAQCeBQAh_AMCAI0FACH-AwAA6QUAIAyWAwEAogYAIZ4DAADvB_4DIqIDQACnBgAhowNAAKcGACG8AwIAowYAIb0DQACnBgAhvgMCAKMGACG_AwIAowYAIcEDAQCmBgAhwwMBAKIGACH8AwIAowYAIf4DgAAAAAENDwAA8QcAIJYDAQCiBgAhngMAAO8H_gMiogNAAKcGACGjA0AApwYAIbwDAgCjBgAhvQNAAKcGACG-AwIAowYAIb8DAgCjBgAhwQMBAKYGACHDAwEAogYAIfwDAgCjBgAh_gOAAAAAAQ0PAAD_BwAglgMBAAAAAZ4DAAAA_gMCogNAAAAAAaMDQAAAAAG8AwIAAAABvQNAAAAAAb4DAgAAAAG_AwIAAAABwQMBAAAAAcMDAQAAAAH8AwIAAAAB_gOAAAAAAQQHAACGCAAglgMBAAAAAcIDAQAAAAH_A0AAAAABAgAAACAAIDcAALMIACADAAAAIAAgNwAAswgAIDgAALIIACABMAAAlwsAMAoHAACPBQAgDAAAgAYAIJMDAACDBgAwlAMAAB4AEJUDAACDBgAwlgMBAAAAAcIDAQCeBQAh8gMBAJ4FACH_A0AAjgUAIbUEAACCBgAgAgAAACAAIDAAALIIACACAAAAsAgAIDAAALEIACAHkwMAAK8IADCUAwAAsAgAEJUDAACvCAAwlgMBAJ4FACHCAwEAngUAIfIDAQCeBQAh_wNAAI4FACEHkwMAAK8IADCUAwAAsAgAEJUDAACvCAAwlgMBAJ4FACHCAwEAngUAIfIDAQCeBQAh_wNAAI4FACEDlgMBAKIGACHCAwEAogYAIf8DQACnBgAhBAcAAIQIACCWAwEAogYAIcIDAQCiBgAh_wNAAKcGACEEBwAAhggAIJYDAQAAAAHCAwEAAAAB_wNAAAAAAQG7BAEAAAAEAzcAAJULACC4BAAAlgsAIL4EAAABACAENwAAqAgAMLgEAACpCAAwugQAAKsIACC-BAAArAgAMAQ3AACcCAAwuAQAAJ0IADC6BAAAnwgAIL4EAACgCAAwBDcAAJMIADC4BAAAlAgAMLoEAACWCAAgvgQAAPUGADAAAAAAAAU3AACQCwAgOAAAkwsAILgEAACRCwAguQQAAJILACC-BAAAYgAgAzcAAJALACC4BAAAkQsAIL4EAABiACAAAAAFNwAAhwsAIDgAAI4LACC4BAAAiAsAILkEAACNCwAgvgQAAFYAIAU3AACFCwAgOAAAiwsAILgEAACGCwAguQQAAIoLACC-BAAAAQAgCzcAAMYIADA4AADLCAAwuAQAAMcIADC5BAAAyAgAMLoEAADJCAAguwQAAMoIADC8BAAAyggAML0EAADKCAAwvgQAAMoIADC_BAAAzAgAMMAEAADNCAAwBpYDAQAAAAGiA0AAAAABhgQBAAAAAYcEAgAAAAGIBAEAAAABiQQBAAAAAQIAAABdACA3AADRCAAgAwAAAF0AIDcAANEIACA4AADQCAAgATAAAIkLADALIwAA4AUAIJMDAADfBQAwlAMAAFsAEJUDAADfBQAwlgMBAAAAAaIDQACOBQAhhQQBAJ4FACGGBAEAngUAIYcEAgCNBQAhiAQBAJ4FACGJBAEArgUAIQIAAABdACAwAADQCAAgAgAAAM4IACAwAADPCAAgCpMDAADNCAAwlAMAAM4IABCVAwAAzQgAMJYDAQCeBQAhogNAAI4FACGFBAEAngUAIYYEAQCeBQAhhwQCAI0FACGIBAEAngUAIYkEAQCuBQAhCpMDAADNCAAwlAMAAM4IABCVAwAAzQgAMJYDAQCeBQAhogNAAI4FACGFBAEAngUAIYYEAQCeBQAhhwQCAI0FACGIBAEAngUAIYkEAQCuBQAhBpYDAQCiBgAhogNAAKcGACGGBAEAogYAIYcEAgCjBgAhiAQBAKIGACGJBAEApgYAIQaWAwEAogYAIaIDQACnBgAhhgQBAKIGACGHBAIAowYAIYgEAQCiBgAhiQQBAKYGACEGlgMBAAAAAaIDQAAAAAGGBAEAAAABhwQCAAAAAYgEAQAAAAGJBAEAAAABAzcAAIcLACC4BAAAiAsAIL4EAABWACADNwAAhQsAILgEAACGCwAgvgQAAAEAIAQ3AADGCAAwuAQAAMcIADC6BAAAyQgAIL4EAADKCAAwAAAAAAABuwQAAACSBAIBuwQAAACbBAIFNwAA_QoAIDgAAIMLACC4BAAA_goAILkEAACCCwAgvgQAAAEAIAc3AAD7CgAgOAAAgAsAILgEAAD8CgAguQQAAP8KACC8BAAAEQAgvQQAABEAIL4EAAABACAHNwAA3wgAIDgAAOIIACC4BAAA4AgAILkEAADhCAAgvAQAAFkAIL0EAABZACC-BAAAYgAgCwsAANMIACAkAADUCAAglgMBAAAAAZcDAQAAAAGiA0AAAAABiwQBAAAAAYwEAQAAAAGNBAEAAAABjgQBAAAAAY8EAQAAAAGQBAEAAAABAgAAAGIAIDcAAN8IACADAAAAWQAgNwAA3wgAIDgAAOMIACANAAAAWQAgCwAAxAgAICQAAMUIACAwAADjCAAglgMBAKIGACGXAwEAogYAIaIDQACnBgAhiwQBAKIGACGMBAEApgYAIY0EAQCmBgAhjgQBAKYGACGPBAEApgYAIZAEAQCmBgAhCwsAAMQIACAkAADFCAAglgMBAKIGACGXAwEAogYAIaIDQACnBgAhiwQBAKIGACGMBAEApgYAIY0EAQCmBgAhjgQBAKYGACGPBAEApgYAIZAEAQCmBgAhAzcAAP0KACC4BAAA_goAIL4EAAABACADNwAA-woAILgEAAD8CgAgvgQAAAEAIAM3AADfCAAguAQAAOAIACC-BAAAYgAgAAAAAAAABTcAAPYKACA4AAD5CgAguAQAAPcKACC5BAAA-AoAIL4EAAABACADNwAA9goAILgEAAD3CgAgvgQAAAEAIAAAAAU3AADxCgAgOAAA9AoAILgEAADyCgAguQQAAPMKACC-BAAAAQAgAzcAAPEKACC4BAAA8goAIL4EAAABACAAAAALNwAArAoAMDgAALEKADC4BAAArQoAMLkEAACuCgAwugQAAK8KACC7BAAAsAoAMLwEAACwCgAwvQQAALAKADC-BAAAsAoAML8EAACyCgAwwAQAALMKADALNwAAoAoAMDgAAKUKADC4BAAAoQoAMLkEAACiCgAwugQAAKMKACC7BAAApAoAMLwEAACkCgAwvQQAAKQKADC-BAAApAoAML8EAACmCgAwwAQAAKcKADAHNwAAmwoAIDgAAJ4KACC4BAAAnAoAILkEAACdCgAgvAQAAAsAIL0EAAALACC-BAAAtQMAIAs3AACSCgAwOAAAlgoAMLgEAACTCgAwuQQAAJQKADC6BAAAlQoAILsEAACBCgAwvAQAAIEKADC9BAAAgQoAML4EAACBCgAwvwQAAJcKADDABAAAhAoAMAs3AACJCgAwOAAAjQoAMLgEAACKCgAwuQQAAIsKADC6BAAAjAoAILsEAACBCgAwvAQAAIEKADC9BAAAgQoAML4EAACBCgAwvwQAAI4KADDABAAAhAoAMAs3AAD9CQAwOAAAggoAMLgEAAD-CQAwuQQAAP8JADC6BAAAgAoAILsEAACBCgAwvAQAAIEKADC9BAAAgQoAML4EAACBCgAwvwQAAIMKADDABAAAhAoAMAs3AADxCQAwOAAA9gkAMLgEAADyCQAwuQQAAPMJADC6BAAA9AkAILsEAAD1CQAwvAQAAPUJADC9BAAA9QkAML4EAAD1CQAwvwQAAPcJADDABAAA-AkAMAs3AADoCQAwOAAA7AkAMLgEAADpCQAwuQQAAOoJADC6BAAA6wkAILsEAACsCAAwvAQAAKwIADC9BAAArAgAML4EAACsCAAwvwQAAO0JADDABAAArwgAMAs3AADfCQAwOAAA4wkAMLgEAADgCQAwuQQAAOEJADC6BAAA4gkAILsEAAD2BwAwvAQAAPYHADC9BAAA9gcAML4EAAD2BwAwvwQAAOQJADDABAAA-QcAMAc3AADaCQAgOAAA3QkAILgEAADbCQAguQQAANwJACC8BAAAQwAgvQQAAEMAIL4EAACsBAAgCzcAAM4JADA4AADTCQAwuAQAAM8JADC5BAAA0AkAMLoEAADRCQAguwQAANIJADC8BAAA0gkAML0EAADSCQAwvgQAANIJADC_BAAA1AkAMMAEAADVCQAwCzcAAMUJADA4AADJCQAwuAQAAMYJADC5BAAAxwkAMLoEAADICQAguwQAAL0JADC8BAAAvQkAML0EAAC9CQAwvgQAAL0JADC_BAAAygkAMMAEAADACQAwCzcAALkJADA4AAC-CQAwuAQAALoJADC5BAAAuwkAMLoEAAC8CQAguwQAAL0JADC8BAAAvQkAML0EAAC9CQAwvgQAAL0JADC_BAAAvwkAMMAEAADACQAwCzcAAK0JADA4AACyCQAwuAQAAK4JADC5BAAArwkAMLoEAACwCQAguwQAALEJADC8BAAAsQkAML0EAACxCQAwvgQAALEJADC_BAAAswkAMMAEAAC0CQAwCzcAAKQJADA4AACoCQAwuAQAAKUJADC5BAAApgkAMLoEAACnCQAguwQAAPUGADC8BAAA9QYAML0EAAD1BgAwvgQAAPUGADC_BAAAqQkAMMAEAAD4BgAwCzcAAJsJADA4AACfCQAwuAQAAJwJADC5BAAAnQkAMLoEAACeCQAguwQAAIcHADC8BAAAhwcAML0EAACHBwAwvgQAAIcHADC_BAAAoAkAMMAEAACKBwAwCzcAAJIJADA4AACWCQAwuAQAAJMJADC5BAAAlAkAMLoEAACVCQAguwQAAMIGADC8BAAAwgYAML0EAADCBgAwvgQAAMIGADC_BAAAlwkAMMAEAADFBgAwCzcAAIkJADA4AACNCQAwuAQAAIoJADC5BAAAiwkAMLoEAACMCQAguwQAAMIGADC8BAAAwgYAML0EAADCBgAwvgQAAMIGADC_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-wYAIfUDAgCjBgAh9gMCAKMGACH3AwIA_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_AYAIZkEAgCjBgAhmwQBAKYGACGcBEAApQYAIZ4EQAClBgAhFgcAANwIACAjAADeCAAglgMBAKIGACGeAwAA2wibBCKiA0AApwYAIaMDQACnBgAhsgMBAKIGACHCAwEAogYAIcMDAQCiBgAhjwQBAKYGACGQBAEApgYAIZIEAADaCJIEIpMEAQCmBgAhlAQBAKYGACGVBAEApgYAIZYEAQCmBgAhlwQBAKYGACGYBAIA_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-wNAAKcGACEFDgAA6AcAIJYDAQAAAAH5AwEAAAAB-gMgAAAAAfsDQAAAAAEEDAAAhQgAIJYDAQAAAAHyAwEAAAAB_wNAAAAAAQIAAAAgACA3AADwCQAgAwAAACAAIDcAAPAJACA4AADvCQAgATAAAOcKADACAAAAIAAgMAAA7wkAIAIAAACwCAAgMAAA7gkAIAOWAwEAogYAIfIDAQCiBgAh_wNAAKcGACEEDAAAgwgAIJYDAQCiBgAh8gMBAKIGACH_A0AApwYAIQQMAACFCAAglgMBAAAAAfIDAQAAAAH_A0AAAAABEQQAALcIACANAAC2CAAgEQAAuAgAIJYDAQAAAAGeAwAAAIUEAqIDQAAAAAGjA0AAAAABsgMBAAAAAcMDAQAAAAHEAwAAtAgAIMwDQAAAAAHjAwAAAIQEAuQDAQAAAAHlA0AAAAABgAQCAAAAAYEEAgAAAAGCBAIAAAABAgAAAD8AIDcAAPwJACADAAAAPwAgNwAA_AkAIDgAAPsJACABMAAA5goAMBYEAADzBQAgCwAAjwUAIA0AAPIFACARAAD0BQAgkwMAAO8FADCUAwAAHAAQlQMAAO8FADCWAwEAAAABlwMBAJ4FACGeAwAA8QWFBCKiA0AAjgUAIaMDQACOBQAhsgMBAJ4FACHDAwEAngUAIcQDAACXBQAgzANAALAFACHjAwAA8AWEBCLkAwEArgUAIeUDQACwBQAhgAQCAI0FACGBBAIAjQUAIYIEAgCNBQAhAgAAAD8AIDAAAPsJACACAAAA-QkAIDAAAPoJACASkwMAAPgJADCUAwAA-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-BAAApAoAMAM3AACbCgAguAQAAJwKACC-BAAAtQMAIAQ3AACSCgAwuAQAAJMKADC6BAAAlQoAIL4EAACBCgAwBDcAAIkKADC4BAAAigoAMLoEAACMCgAgvgQAAIEKADAENwAA_QkAMLgEAAD-CQAwugQAAIAKACC-BAAAgQoAMAQ3AADxCQAwuAQAAPIJADC6BAAA9AkAIL4EAAD1CQAwBDcAAOgJADC4BAAA6QkAMLoEAADrCQAgvgQAAKwIADAENwAA3wkAMLgEAADgCQAwugQAAOIJACC-BAAA9gcAMAM3AADaCQAguAQAANsJACC-BAAArAQAIAQ3AADOCQAwuAQAAM8JADC6BAAA0QkAIL4EAADSCQAwBDcAAMUJADC4BAAAxgkAMLoEAADICQAgvgQAAL0JADAENwAAuQkAMLgEAAC6CQAwugQAALwJACC-BAAAvQkAMAQ3AACtCQAwuAQAAK4JADC6BAAAsAkAIL4EAACxCQAwBDcAAKQJADC4BAAApQkAMLoEAACnCQAgvgQAAPUGADAENwAAmwkAMLgEAACcCQAwugQAAJ4JACC-BAAAhwcAMAQ3AACSCQAwuAQAAJMJADC6BAAAlQkAIL4EAADCBgAwBDcAAIkJADC4BAAAigkAMLoEAACMCQAgvgQAAMIGADAAAAUDAADZBgAg4AMAAJwGACDhAwAAnAYAIOQDAACcBgAg5QMAAJwGACAAAAAAAwMAANkGACAdAADaBgAgHwAA2wYAIAAAAAAADwcAANkGACAhAADZBgAgIwAA2QoAII8EAACcBgAgkAQAAJwGACCTBAAAnAYAIJQEAACcBgAglQQAAJwGACCWBAAAnAYAIJcEAACcBgAgmAQAAJwGACCbBAAAnAYAIJwEAACcBgAgnQQAAJwGACCeBAAAnAYAIAAICwAA2QYAICIAANcKACAkAADYCgAgjAQAAJwGACCNBAAAnAYAII4EAACcBgAgjwQAAJwGACCQBAAAnAYAIAAJCwAA2QYAIAwAAN0KACASAADeCgAgFAAA3woAIBUAANYKACCyAwAAnAYAIPIDAACcBgAg8wMAAJwGACD3AwAAnAYAIAQMAADdCgAgDwAA0AoAIMEDAACcBgAg_gMAAJwGACAHBAAA2goAIAsAANkGACANAADPCgAgEQAA1QoAIMwDAACcBgAg5AMAAJwGACDlAwAAnAYAIAkEAADgCgAgBwAA2QYAIAgAANkGACAJAADZBgAgEQAA1QoAIMkDAACcBgAgygMAAJwGACDLAwAAnAYAIMwDAACcBgAgAAAHlgMBAAAAAaIDQAAAAAGjA0AAAAABoQRAAAAAAasEAQAAAAGsBAEAAAABrQQBAAAAAQyWAwEAAAABogNAAAAAAaMDQAAAAAGiBAEAAAABowQBAAAAAaQEAQAAAAGlBAEAAAABpgQBAAAAAacEQAAAAAGoBEAAAAABqQQBAAAAAaoEAQAAAAEOlgMBAAAAAZ4DAAAAyQMCogNAAAAAAaMDQAAAAAGyAwEAAAABwwMBAAAAAcQDAACxBwAgxQNAAAAAAcYDAgAAAAHHAwAAsgcAIMkDAQAAAAHKA0AAAAABywMBAAAAAcwDQAAAAAEOlgMBAAAAAZ4DAAAAyQMCogNAAAAAAaMDQAAAAAGyAwEAAAABwgMBAAAAAcMDAQAAAAHEAwAAsQcAIMUDQAAAAAHGAwIAAAABxwMAALIHACDKA0AAAAABywMBAAAAAcwDQAAAAAEOlgMBAAAAAZ4DAAAAyQMCogNAAAAAAaMDQAAAAAGyAwEAAAABwgMBAAAAAcMDAQAAAAHEAwAAsQcAIMUDQAAAAAHGAwIAAAABxwMAALIHACDJAwEAAAABygNAAAAAAcwDQAAAAAEOlgMBAAAAAZ4DAAAAhQQCogNAAAAAAaMDQAAAAAGyAwEAAAABwwMBAAAAAcQDAAC0CAAgzANAAAAAAeMDAAAAhAQC5AMBAAAAAeUDQAAAAAGABAIAAAABgQQCAAAAAYIEAgAAAAEDlgMBAAAAAfIDAQAAAAH_A0AAAAABBJYDAQAAAAH5AwEAAAAB-gMgAAAAAfsDQAAAAAEJlgMBAAAAAZ4DAAAA1gMCogNAAAAAAaMDQAAAAAGvAwIAAAAB0gMBAAAAAdMDAQAAAAHUAwEAAAAB1gOAAAAAARSWAwEAAAABngMAAACbBAKiA0AAAAABowNAAAAAAbIDAQAAAAHDAwEAAAABjwQBAAAAAZAEAQAAAAGSBAAAAJIEApMEAQAAAAGUBAEAAAABlQQBAAAAAZYEAQAAAAGXBAEAAAABmAQCAAAAAZkEAgAAAAGbBAEAAAABnARAAAAAAZ0EAQAAAAGeBEAAAAABFJYDAQAAAAGeAwAAAJsEAqIDQAAAAAGjA0AAAAABsgMBAAAAAcIDAQAAAAHDAwEAAAABjwQBAAAAAZAEAQAAAAGSBAAAAJIEApMEAQAAAAGUBAEAAAABlQQBAAAAAZYEAQAAAAGXBAEAAAABmAQCAAAAAZkEAgAAAAGbBAEAAAABnARAAAAAAZ4EQAAAAAEJlgMBAAAAAaIDQAAAAAGKBAEAAAABiwQBAAAAAYwEAQAAAAGNBAEAAAABjgQBAAAAAY8EAQAAAAGQBAEAAAABDZYDAQAAAAGeAwAAAPkDAqIDQAAAAAGjA0AAAAABsgMBAAAAAb4DAgAAAAHDAwEAAAAB8gMBAAAAAfMDAQAAAAH0AyAAAAAB9QMCAAAAAfYDAgAAAAH3AwIAAAABCJYDAQAAAAHmAwEAAAAB5wMCAAAAAegDCAAAAAHpAyAAAAAB6gNAAAAAAesDQAAAAAHsA4AAAAABDJYDAQAAAAGYAwEAAAABmQMCAAAAAZoDAgAAAAGbAwEAAAABnAMBAAAAAZ4DAAAAngMCnwMBAAAAAaADQAAAAAGhAwEAAAABogNAAAAAAaMDQAAAAAEMlgMBAAAAAZcDAQAAAAGYAwEAAAABmQMCAAAAAZoDAgAAAAGbAwEAAAABnAMBAAAAAZ4DAAAAngMCoANAAAAAAaEDAQAAAAGiA0AAAAABowNAAAAAARoFAAC5CgAgBgAAugoAIBYAALsKACAXAAC8CgAgGAAAvQoAIBkAAL4KACAaAAC_CgAgGwAAwAoAIBwAAMEKACAfAADICgAgIAAAwgoAICUAAMMKACAmAADECgAgJwAAxQoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQIAAAABACA3AADxCgAgAwAAABEAIDcAAPEKACA4AAD1CgAgHAAAABEAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAgMAAA9QoAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAC4CgAgBgAAugoAIBYAALsKACAXAAC8CgAgGAAAvQoAIBkAAL4KACAaAAC_CgAgGwAAwAoAIBwAAMEKACAfAADICgAgIAAAwgoAICUAAMMKACAmAADECgAgJwAAxQoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQIAAAABACA3AAD2CgAgAwAAABEAIDcAAPYKACA4AAD6CgAgHAAAABEAIAQAAPcIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAgMAAA-goAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAD3CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAC4CgAgBQAAuQoAIAYAALoKACAWAAC7CgAgFwAAvAoAIBgAAL0KACAZAAC-CgAgGgAAvwoAIBsAAMAKACAcAADBCgAgHwAAyAoAICAAAMIKACAlAADDCgAgJwAAxQoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQIAAAABACA3AAD7CgAgGgQAALgKACAFAAC5CgAgBgAAugoAIBYAALsKACAXAAC8CgAgGAAAvQoAIBkAAL4KACAaAAC_CgAgGwAAwAoAIBwAAMEKACAfAADICgAgIAAAwgoAICYAAMQKACAnAADFCgAgKAAAxgoAICkAAMcKACAqAADJCgAglgMBAAAAAaIDQAAAAAGjA0AAAAABrgQBAAAAAa8EAQAAAAGwBCAAAAABsQQBAAAAAbIEAQAAAAGzBCAAAAABAgAAAAEAIDcAAP0KACADAAAAEQAgNwAA-woAIDgAAIELACAcAAAAEQAgBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICcAAIQJACAoAACFCQAgKQAAhgkAICoAAIgJACAwAACBCwAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhGgQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhAwAAABEAIDcAAP0KACA4AACECwAgHAAAABEAIAQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAgMAAAhAsAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGgAA_ggAIBsAAP8IACAcAACACQAgHwAAhwkAICAAAIEJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAC4CgAgBQAAuQoAIAYAALoKACAWAAC7CgAgFwAAvAoAIBgAAL0KACAZAAC-CgAgGgAAvwoAIBsAAMAKACAcAADBCgAgHwAAyAoAICAAAMIKACAlAADDCgAgJgAAxAoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQIAAAABACA3AACFCwAgFwcAAOQIACAhAADlCAAglgMBAAAAAZ4DAAAAmwQCogNAAAAAAaMDQAAAAAGyAwEAAAABwgMBAAAAAcMDAQAAAAGPBAEAAAABkAQBAAAAAZIEAAAAkgQCkwQBAAAAAZQEAQAAAAGVBAEAAAABlgQBAAAAAZcEAQAAAAGYBAIAAAABmQQCAAAAAZsEAQAAAAGcBEAAAAABnQQBAAAAAZ4EQAAAAAECAAAAVgAgNwAAhwsAIAaWAwEAAAABogNAAAAAAYYEAQAAAAGHBAIAAAABiAQBAAAAAYkEAQAAAAEDAAAAEQAgNwAAhQsAIDgAAIwLACAcAAAAEQAgBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAoAACFCQAgKQAAhgkAICoAAIgJACAwAACMCwAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhGgQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgKAAAhQkAICkAAIYJACAqAACICQAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhAwAAAFQAIDcAAIcLACA4AACPCwAgGQAAAFQAIAcAANwIACAhAADdCAAgMAAAjwsAIJYDAQCiBgAhngMAANsImwQiogNAAKcGACGjA0AApwYAIbIDAQCiBgAhwgMBAKIGACHDAwEAogYAIY8EAQCmBgAhkAQBAKYGACGSBAAA2giSBCKTBAEApgYAIZQEAQCmBgAhlQQBAKYGACGWBAEApgYAIZcEAQCmBgAhmAQCAPwGACGZBAIAowYAIZsEAQCmBgAhnARAAKUGACGdBAEApgYAIZ4EQAClBgAhFwcAANwIACAhAADdCAAglgMBAKIGACGeAwAA2wibBCKiA0AApwYAIaMDQACnBgAhsgMBAKIGACHCAwEAogYAIcMDAQCiBgAhjwQBAKYGACGQBAEApgYAIZIEAADaCJIEIpMEAQCmBgAhlAQBAKYGACGVBAEApgYAIZYEAQCmBgAhlwQBAKYGACGYBAIA_AYAIZkEAgCjBgAhmwQBAKYGACGcBEAApQYAIZ0EAQCmBgAhngRAAKUGACEMCwAA0wgAICIAANIIACCWAwEAAAABlwMBAAAAAaIDQAAAAAGKBAEAAAABiwQBAAAAAYwEAQAAAAGNBAEAAAABjgQBAAAAAY8EAQAAAAGQBAEAAAABAgAAAGIAIDcAAJALACADAAAAWQAgNwAAkAsAIDgAAJQLACAOAAAAWQAgCwAAxAgAICIAAMMIACAwAACUCwAglgMBAKIGACGXAwEAogYAIaIDQACnBgAhigQBAKIGACGLBAEAogYAIYwEAQCmBgAhjQQBAKYGACGOBAEApgYAIY8EAQCmBgAhkAQBAKYGACEMCwAAxAgAICIAAMMIACCWAwEAogYAIZcDAQCiBgAhogNAAKcGACGKBAEAogYAIYsEAQCiBgAhjAQBAKYGACGNBAEApgYAIY4EAQCmBgAhjwQBAKYGACGQBAEApgYAIRoEAAC4CgAgBQAAuQoAIAYAALoKACAWAAC7CgAgFwAAvAoAIBgAAL0KACAaAAC_CgAgGwAAwAoAIBwAAMEKACAfAADICgAgIAAAwgoAICUAAMMKACAmAADECgAgJwAAxQoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQIAAAABACA3AACVCwAgA5YDAQAAAAHCAwEAAAAB_wNAAAAAAQyWAwEAAAABngMAAAD-AwKiA0AAAAABowNAAAAAAbwDAgAAAAG9A0AAAAABvgMCAAAAAb8DAgAAAAHBAwEAAAABwwMBAAAAAfwDAgAAAAH-A4AAAAABDZYDAQAAAAGXAwEAAAABngMAAAD5AwKiA0AAAAABowNAAAAAAbIDAQAAAAG-AwIAAAABwwMBAAAAAfMDAQAAAAH0AyAAAAAB9QMCAAAAAfYDAgAAAAH3AwIAAAABAwAAABEAIDcAAJULACA4AACcCwAgHAAAABEAIAQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAgMAAAnAsAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAC4CgAgBQAAuQoAIAYAALoKACAWAAC7CgAgFwAAvAoAIBgAAL0KACAZAAC-CgAgGwAAwAoAIBwAAMEKACAfAADICgAgIAAAwgoAICUAAMMKACAmAADECgAgJwAAxQoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQIAAAABACA3AACdCwAgEgQAALcIACALAAC1CAAgEQAAuAgAIJYDAQAAAAGXAwEAAAABngMAAACFBAKiA0AAAAABowNAAAAAAbIDAQAAAAHDAwEAAAABxAMAALQIACDMA0AAAAAB4wMAAACEBALkAwEAAAAB5QNAAAAAAYAEAgAAAAGBBAIAAAABggQCAAAAAQIAAAA_ACA3AACfCwAgAwAAABEAIDcAAJ0LACA4AACjCwAgHAAAABEAIAQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAgMAAAowsAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIQMAAAAcACA3AACfCwAgOAAApgsAIBQAAAAcACAEAACRCAAgCwAAjwgAIBEAAJIIACAwAACmCwAglgMBAKIGACGXAwEAogYAIZ4DAACOCIUEIqIDQACnBgAhowNAAKcGACGyAwEAogYAIcMDAQCiBgAhxAMAAIwIACDMA0AApQYAIeMDAACNCIQEIuQDAQCmBgAh5QNAAKUGACGABAIAowYAIYEEAgCjBgAhggQCAKMGACESBAAAkQgAIAsAAI8IACARAACSCAAglgMBAKIGACGXAwEAogYAIZ4DAACOCIUEIqIDQACnBgAhowNAAKcGACGyAwEAogYAIcMDAQCiBgAhxAMAAIwIACDMA0AApQYAIeMDAACNCIQEIuQDAQCmBgAh5QNAAKUGACGABAIAowYAIYEEAgCjBgAhggQCAKMGACESCwAAtQgAIA0AALYIACARAAC4CAAglgMBAAAAAZcDAQAAAAGeAwAAAIUEAqIDQAAAAAGjA0AAAAABsgMBAAAAAcMDAQAAAAHEAwAAtAgAIMwDQAAAAAHjAwAAAIQEAuQDAQAAAAHlA0AAAAABgAQCAAAAAYEEAgAAAAGCBAIAAAABAgAAAD8AIDcAAKcLACAElgMBAAAAAcIDAQAAAAH6AyAAAAAB-wNAAAAAAQMAAAAcACA3AACnCwAgOAAArAsAIBQAAAAcACALAACPCAAgDQAAkAgAIBEAAJIIACAwAACsCwAglgMBAKIGACGXAwEAogYAIZ4DAACOCIUEIqIDQACnBgAhowNAAKcGACGyAwEAogYAIcMDAQCiBgAhxAMAAIwIACDMA0AApQYAIeMDAACNCIQEIuQDAQCmBgAh5QNAAKUGACGABAIAowYAIYEEAgCjBgAhggQCAKMGACESCwAAjwgAIA0AAJAIACARAACSCAAglgMBAKIGACGXAwEAogYAIZ4DAACOCIUEIqIDQACnBgAhowNAAKcGACGyAwEAogYAIcMDAQCiBgAhxAMAAIwIACDMA0AApQYAIeMDAACNCIQEIuQDAQCmBgAh5QNAAKUGACGABAIAowYAIYEEAgCjBgAhggQCAKMGACEaBAAAuAoAIAUAALkKACAGAAC6CgAgFgAAuwoAIBcAALwKACAYAAC9CgAgGQAAvgoAIBoAAL8KACAcAADBCgAgHwAAyAoAICAAAMIKACAlAADDCgAgJgAAxAoAICcAAMUKACAoAADGCgAgKQAAxwoAICoAAMkKACCWAwEAAAABogNAAAAAAaMDQAAAAAGuBAEAAAABrwQBAAAAAbAEIAAAAAGxBAEAAAABsgQBAAAAAbMEIAAAAAECAAAAAQAgNwAArQsAIA4MAAD-BwAglgMBAAAAAZ4DAAAA_gMCogNAAAAAAaMDQAAAAAG8AwIAAAABvQNAAAAAAb4DAgAAAAG_AwIAAAABwQMBAAAAAcMDAQAAAAHyAwEAAAAB_AMCAAAAAf4DgAAAAAECAAAAJAAgNwAArwsAIAMAAAARACA3AACtCwAgOAAAswsAIBwAAAARACAEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGgAA_ggAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIDAAALMLACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEaBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAcAACACQAgHwAAhwkAICAAAIEJACAlAACCCQAgJgAAgwkAICcAAIQJACAoAACFCQAgKQAAhgkAICoAAIgJACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEDAAAAIgAgNwAArwsAIDgAALYLACAQAAAAIgAgDAAA8AcAIDAAALYLACCWAwEAogYAIZ4DAADvB_4DIqIDQACnBgAhowNAAKcGACG8AwIAowYAIb0DQACnBgAhvgMCAKMGACG_AwIAowYAIcEDAQCmBgAhwwMBAKIGACHyAwEAogYAIfwDAgCjBgAh_gOAAAAAAQ4MAADwBwAglgMBAKIGACGeAwAA7wf-AyKiA0AApwYAIaMDQACnBgAhvAMCAKMGACG9A0AApwYAIb4DAgCjBgAhvwMCAKMGACHBAwEApgYAIcMDAQCiBgAh8gMBAKIGACH8AwIAowYAIf4DgAAAAAETBAAAtgcAIAcAALMHACAIAAC0BwAgCQAAtQcAIJYDAQAAAAGeAwAAAMkDAqIDQAAAAAGjA0AAAAABsgMBAAAAAcIDAQAAAAHDAwEAAAABxAMAALEHACDFA0AAAAABxgMCAAAAAccDAACyBwAgyQMBAAAAAcoDQAAAAAHLAwEAAAABzANAAAAAAQIAAAAPACA3AAC3CwAgAwAAAA0AIDcAALcLACA4AAC7CwAgFQAAAA0AIAQAAO8GACAHAADsBgAgCAAA7QYAIAkAAO4GACAwAAC7CwAglgMBAKIGACGeAwAA6wbJAyKiA0AApwYAIaMDQACnBgAhsgMBAKIGACHCAwEAogYAIcMDAQCiBgAhxAMAAOkGACDFA0AApwYAIcYDAgCjBgAhxwMAAOoGACDJAwEApgYAIcoDQAClBgAhywMBAKYGACHMA0AApQYAIRMEAADvBgAgBwAA7AYAIAgAAO0GACAJAADuBgAglgMBAKIGACGeAwAA6wbJAyKiA0AApwYAIaMDQACnBgAhsgMBAKIGACHCAwEAogYAIcMDAQCiBgAhxAMAAOkGACDFA0AApwYAIcYDAgCjBgAhxwMAAOoGACDJAwEApgYAIcoDQAClBgAhywMBAKYGACHMA0AApQYAIRILAAChBwAgDAAAogcAIBIAAOIHACAVAACkBwAglgMBAAAAAZcDAQAAAAGeAwAAAPkDAqIDQAAAAAGjA0AAAAABsgMBAAAAAb4DAgAAAAHDAwEAAAAB8gMBAAAAAfMDAQAAAAH0AyAAAAAB9QMCAAAAAfYDAgAAAAH3AwIAAAABAgAAABoAIDcAALwLACADAAAAGAAgNwAAvAsAIDgAAMALACAUAAAAGAAgCwAA_wYAIAwAAIAHACASAADhBwAgFQAAggcAIDAAAMALACCWAwEAogYAIZcDAQCiBgAhngMAAP0G-QMiogNAAKcGACGjA0AApwYAIbIDAQCmBgAhvgMCAKMGACHDAwEAogYAIfIDAQCmBgAh8wMBAKYGACH0AyAA-wYAIfUDAgCjBgAh9gMCAKMGACH3AwIA_AYAIRILAAD_BgAgDAAAgAcAIBIAAOEHACAVAACCBwAglgMBAKIGACGXAwEAogYAIZ4DAAD9BvkDIqIDQACnBgAhowNAAKcGACGyAwEApgYAIb4DAgCjBgAhwwMBAKIGACHyAwEApgYAIfMDAQCmBgAh9AMgAPsGACH1AwIAowYAIfYDAgCjBgAh9wMCAPwGACESCwAAoQcAIAwAAKIHACASAADiBwAgFAAAowcAIJYDAQAAAAGXAwEAAAABngMAAAD5AwKiA0AAAAABowNAAAAAAbIDAQAAAAG-AwIAAAABwwMBAAAAAfIDAQAAAAHzAwEAAAAB9AMgAAAAAfUDAgAAAAH2AwIAAAAB9wMCAAAAAQIAAAAaACA3AADBCwAgAwAAABgAIDcAAMELACA4AADFCwAgFAAAABgAIAsAAP8GACAMAACABwAgEgAA4QcAIBQAAIEHACAwAADFCwAglgMBAKIGACGXAwEAogYAIZ4DAAD9BvkDIqIDQACnBgAhowNAAKcGACGyAwEApgYAIb4DAgCjBgAhwwMBAKIGACHyAwEApgYAIfMDAQCmBgAh9AMgAPsGACH1AwIAowYAIfYDAgCjBgAh9wMCAPwGACESCwAA_wYAIAwAAIAHACASAADhBwAgFAAAgQcAIJYDAQCiBgAhlwMBAKIGACGeAwAA_Qb5AyKiA0AApwYAIaMDQACnBgAhsgMBAKYGACG-AwIAowYAIcMDAQCiBgAh8gMBAKYGACHzAwEApgYAIfQDIAD7BgAh9QMCAKMGACH2AwIAowYAIfcDAgD8BgAhGgQAALgKACAFAAC5CgAgFgAAuwoAIBcAALwKACAYAAC9CgAgGQAAvgoAIBoAAL8KACAbAADACgAgHAAAwQoAIB8AAMgKACAgAADCCgAgJQAAwwoAICYAAMQKACAnAADFCgAgKAAAxgoAICkAAMcKACAqAADJCgAglgMBAAAAAaIDQAAAAAGjA0AAAAABrgQBAAAAAa8EAQAAAAGwBCAAAAABsQQBAAAAAbIEAQAAAAGzBCAAAAABAgAAAAEAIDcAAMYLACADAAAAEQAgNwAAxgsAIDgAAMoLACAcAAAAEQAgBAAA9wgAIAUAAPgIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGgAA_ggAIBsAAP8IACAcAACACQAgHwAAhwkAICAAAIEJACAlAACCCQAgJgAAgwkAICcAAIQJACAoAACFCQAgKQAAhgkAICoAAIgJACAwAADKCwAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhGgQAAPcIACAFAAD4CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhGgQAALgKACAFAAC5CgAgBgAAugoAIBYAALsKACAXAAC8CgAgGAAAvQoAIBkAAL4KACAaAAC_CgAgGwAAwAoAIBwAAMEKACAfAADICgAgJQAAwwoAICYAAMQKACAnAADFCgAgKAAAxgoAICkAAMcKACAqAADJCgAglgMBAAAAAaIDQAAAAAGjA0AAAAABrgQBAAAAAa8EAQAAAAGwBCAAAAABsQQBAAAAAbIEAQAAAAGzBCAAAAABAgAAAAEAIDcAAMsLACADAAAAEQAgNwAAywsAIDgAAM8LACAcAAAAEQAgBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAlAACCCQAgJgAAgwkAICcAAIQJACAoAACFCQAgKQAAhgkAICoAAIgJACAwAADPCwAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhGgQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhGgQAALgKACAFAAC5CgAgBgAAugoAIBYAALsKACAXAAC8CgAgGQAAvgoAIBoAAL8KACAbAADACgAgHAAAwQoAIB8AAMgKACAgAADCCgAgJQAAwwoAICYAAMQKACAnAADFCgAgKAAAxgoAICkAAMcKACAqAADJCgAglgMBAAAAAaIDQAAAAAGjA0AAAAABrgQBAAAAAa8EAQAAAAGwBCAAAAABsQQBAAAAAbIEAQAAAAGzBCAAAAABAgAAAAEAIDcAANALACAaBAAAuAoAIAUAALkKACAGAAC6CgAgFgAAuwoAIBgAAL0KACAZAAC-CgAgGgAAvwoAIBsAAMAKACAcAADBCgAgHwAAyAoAICAAAMIKACAlAADDCgAgJgAAxAoAICcAAMUKACAoAADGCgAgKQAAxwoAICoAAMkKACCWAwEAAAABogNAAAAAAaMDQAAAAAGuBAEAAAABrwQBAAAAAbAEIAAAAAGxBAEAAAABsgQBAAAAAbMEIAAAAAECAAAAAQAgNwAA0gsAIBoEAAC4CgAgBQAAuQoAIAYAALoKACAXAAC8CgAgGAAAvQoAIBkAAL4KACAaAAC_CgAgGwAAwAoAIBwAAMEKACAfAADICgAgIAAAwgoAICUAAMMKACAmAADECgAgJwAAxQoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQIAAAABACA3AADUCwAgCZYDAQAAAAGeAwAAAMEDAqIDQAAAAAGjA0AAAAABvAMCAAAAAb0DQAAAAAG-AwIAAAABvwMCAAAAAcEDAQAAAAESBAAAtwgAIAsAALUIACANAAC2CAAglgMBAAAAAZcDAQAAAAGeAwAAAIUEAqIDQAAAAAGjA0AAAAABsgMBAAAAAcMDAQAAAAHEAwAAtAgAIMwDQAAAAAHjAwAAAIQEAuQDAQAAAAHlA0AAAAABgAQCAAAAAYEEAgAAAAGCBAIAAAABAgAAAD8AIDcAANcLACAaBAAAuAoAIAUAALkKACAGAAC6CgAgFgAAuwoAIBcAALwKACAYAAC9CgAgGQAAvgoAIBoAAL8KACAbAADACgAgHAAAwQoAIB8AAMgKACAgAADCCgAgJQAAwwoAICYAAMQKACAnAADFCgAgKQAAxwoAICoAAMkKACCWAwEAAAABogNAAAAAAaMDQAAAAAGuBAEAAAABrwQBAAAAAbAEIAAAAAGxBAEAAAABsgQBAAAAAbMEIAAAAAECAAAAAQAgNwAA2QsAIAaWAwEAAAAB7QMBAAAAAe4DAACfBwAg7wMCAAAAAfADAQAAAAHxAwIAAAABGgQAALgKACAFAAC5CgAgBgAAugoAIBYAALsKACAXAAC8CgAgGAAAvQoAIBkAAL4KACAaAAC_CgAgGwAAwAoAIBwAAMEKACAfAADICgAgIAAAwgoAICUAAMMKACAmAADECgAgJwAAxQoAICgAAMYKACAqAADJCgAglgMBAAAAAaIDQAAAAAGjA0AAAAABrgQBAAAAAa8EAQAAAAGwBCAAAAABsQQBAAAAAbIEAQAAAAGzBCAAAAABAgAAAAEAIDcAANwLACADAAAAEQAgNwAA3AsAIDgAAOALACAcAAAAEQAgBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICoAAIgJACAwAADgCwAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhGgQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACAqAACICQAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhCJYDAQAAAAHCAwEAAAAB5wMCAAAAAegDCAAAAAHpAyAAAAAB6gNAAAAAAesDQAAAAAHsA4AAAAABAwAAABwAIDcAANcLACA4AADkCwAgFAAAABwAIAQAAJEIACALAACPCAAgDQAAkAgAIDAAAOQLACCWAwEAogYAIZcDAQCiBgAhngMAAI4IhQQiogNAAKcGACGjA0AApwYAIbIDAQCiBgAhwwMBAKIGACHEAwAAjAgAIMwDQAClBgAh4wMAAI0IhAQi5AMBAKYGACHlA0AApQYAIYAEAgCjBgAhgQQCAKMGACGCBAIAowYAIRIEAACRCAAgCwAAjwgAIA0AAJAIACCWAwEAogYAIZcDAQCiBgAhngMAAI4IhQQiogNAAKcGACGjA0AApwYAIbIDAQCiBgAhwwMBAKIGACHEAwAAjAgAIMwDQAClBgAh4wMAAI0IhAQi5AMBAKYGACHlA0AApQYAIYAEAgCjBgAhgQQCAKMGACGCBAIAowYAIQMAAAARACA3AADZCwAgOAAA5wsAIBwAAAARACAEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGgAA_ggAIBsAAP8IACAcAACACQAgHwAAhwkAICAAAIEJACAlAACCCQAgJgAAgwkAICcAAIQJACApAACGCQAgKgAAiAkAIDAAAOcLACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEaBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKQAAhgkAICoAAIgJACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACENlgMBAAAAAZcDAQAAAAGeAwAAAPkDAqIDQAAAAAGjA0AAAAABsgMBAAAAAb4DAgAAAAHDAwEAAAAB8gMBAAAAAfQDIAAAAAH1AwIAAAAB9gMCAAAAAfcDAgAAAAEDAAAAEQAgNwAA0AsAIDgAAOsLACAcAAAAEQAgBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAZAAD9CAAgGgAA_ggAIBsAAP8IACAcAACACQAgHwAAhwkAICAAAIEJACAlAACCCQAgJgAAgwkAICcAAIQJACAoAACFCQAgKQAAhgkAICoAAIgJACAwAADrCwAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhGgQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAXAAD7CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhrgQBAKIGACGvBAEAogYAIbAEIAD7BgAhsQQBAKYGACGyBAEAogYAIbMEIAD7BgAhAwAAABEAIDcAANILACA4AADuCwAgHAAAABEAIAQAAPcIACAFAAD4CAAgBgAA-QgAIBYAAPoIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACAqAACICQAgMAAA7gsAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIRoEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIa4EAQCiBgAhrwQBAKIGACGwBCAA-wYAIbEEAQCmBgAhsgQBAKIGACGzBCAA-wYAIQMAAAARACA3AADUCwAgOAAA8QsAIBwAAAARACAEAAD3CAAgBQAA-AgAIAYAAPkIACAXAAD7CAAgGAAA_AgAIBkAAP0IACAaAAD-CAAgGwAA_wgAIBwAAIAJACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIDAAAPELACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEaBAAA9wgAIAUAAPgIACAGAAD5CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGgAA_ggAIBsAAP8IACAcAACACQAgHwAAhwkAICAAAIEJACAlAACCCQAgJgAAgwkAICcAAIQJACAoAACFCQAgKQAAhgkAICoAAIgJACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACETBwAAswcAIAgAALQHACAJAAC1BwAgEQAAtwcAIJYDAQAAAAGeAwAAAMkDAqIDQAAAAAGjA0AAAAABsgMBAAAAAcIDAQAAAAHDAwEAAAABxAMAALEHACDFA0AAAAABxgMCAAAAAccDAACyBwAgyQMBAAAAAcoDQAAAAAHLAwEAAAABzANAAAAAAQIAAAAPACA3AADyCwAgAwAAAA0AIDcAAPILACA4AAD2CwAgFQAAAA0AIAcAAOwGACAIAADtBgAgCQAA7gYAIBEAAPAGACAwAAD2CwAglgMBAKIGACGeAwAA6wbJAyKiA0AApwYAIaMDQACnBgAhsgMBAKIGACHCAwEAogYAIcMDAQCiBgAhxAMAAOkGACDFA0AApwYAIcYDAgCjBgAhxwMAAOoGACDJAwEApgYAIcoDQAClBgAhywMBAKYGACHMA0AApQYAIRMHAADsBgAgCAAA7QYAIAkAAO4GACARAADwBgAglgMBAKIGACGeAwAA6wbJAyKiA0AApwYAIaMDQACnBgAhsgMBAKIGACHCAwEAogYAIcMDAQCiBgAhxAMAAOkGACDFA0AApwYAIcYDAgCjBgAhxwMAAOoGACDJAwEApgYAIcoDQAClBgAhywMBAKYGACHMA0AApQYAIRoEAAC4CgAgBQAAuQoAIAYAALoKACAWAAC7CgAgFwAAvAoAIBgAAL0KACAZAAC-CgAgGgAAvwoAIBsAAMAKACAfAADICgAgIAAAwgoAICUAAMMKACAmAADECgAgJwAAxQoAICgAAMYKACApAADHCgAgKgAAyQoAIJYDAQAAAAGiA0AAAAABowNAAAAAAa4EAQAAAAGvBAEAAAABsAQgAAAAAbEEAQAAAAGyBAEAAAABswQgAAAAAQIAAAABACA3AAD3CwAgBpYDAQAAAAGiA0AAAAABrwMCAAAAAbEDAAAAsQMCsgMBAAAAAbMDAQAAAAEMlgMBAAAAAZcDAQAAAAGZAwIAAAABmgMCAAAAAZsDAQAAAAGcAwEAAAABngMAAACeAwKfAwEAAAABoANAAAAAAaEDAQAAAAGiA0AAAAABowNAAAAAAQMAAAARACA3AAD3CwAgOAAA_QsAIBwAAAARACAEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGgAA_ggAIBsAAP8IACAfAACHCQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIDAAAP0LACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEaBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHwAAhwkAICAAAIEJACAlAACCCQAgJgAAgwkAICcAAIQJACAoAACFCQAgKQAAhgkAICoAAIgJACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEJAwAA1gYAIB8AANgGACCWAwEAAAABogNAAAAAAaMDQAAAAAG0AwEAAAABtQMCAAAAAbYDAgAAAAG3AwIAAAABAgAAAKwEACA3AAD-CwAgAwAAAEMAIDcAAP4LACA4AACCDAAgCwAAAEMAIAMAALsGACAfAAC9BgAgMAAAggwAIJYDAQCiBgAhogNAAKcGACGjA0AApwYAIbQDAQCiBgAhtQMCAKMGACG2AwIAowYAIbcDAgCjBgAhCQMAALsGACAfAAC9BgAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhtAMBAKIGACG1AwIAowYAIbYDAgCjBgAhtwMCAKMGACEaBAAAuAoAIAUAALkKACAGAAC6CgAgFgAAuwoAIBcAALwKACAYAAC9CgAgGQAAvgoAIBoAAL8KACAbAADACgAgHAAAwQoAIB8AAMgKACAgAADCCgAgJQAAwwoAICYAAMQKACAnAADFCgAgKAAAxgoAICkAAMcKACCWAwEAAAABogNAAAAAAaMDQAAAAAGuBAEAAAABrwQBAAAAAbAEIAAAAAGxBAEAAAABsgQBAAAAAbMEIAAAAAECAAAAAQAgNwAAgwwAIAkDAADWBgAgHQAA1wYAIJYDAQAAAAGiA0AAAAABowNAAAAAAbQDAQAAAAG1AwIAAAABtgMCAAAAAbcDAgAAAAECAAAArAQAIDcAAIUMACAaBAAAuAoAIAUAALkKACAGAAC6CgAgFgAAuwoAIBcAALwKACAYAAC9CgAgGQAAvgoAIBoAAL8KACAbAADACgAgHAAAwQoAICAAAMIKACAlAADDCgAgJgAAxAoAICcAAMUKACAoAADGCgAgKQAAxwoAICoAAMkKACCWAwEAAAABogNAAAAAAaMDQAAAAAGuBAEAAAABrwQBAAAAAbAEIAAAAAGxBAEAAAABsgQBAAAAAbMEIAAAAAECAAAAAQAgNwAAhwwAIAMAAAARACA3AACDDAAgOAAAiwwAIBwAAAARACAEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGgAA_ggAIBsAAP8IACAcAACACQAgHwAAhwkAICAAAIEJACAlAACCCQAgJgAAgwkAICcAAIQJACAoAACFCQAgKQAAhgkAIDAAAIsMACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEaBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAIB8AAIcJACAgAACBCQAgJQAAggkAICYAAIMJACAnAACECQAgKAAAhQkAICkAAIYJACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEDAAAAQwAgNwAAhQwAIDgAAI4MACALAAAAQwAgAwAAuwYAIB0AALwGACAwAACODAAglgMBAKIGACGiA0AApwYAIaMDQACnBgAhtAMBAKIGACG1AwIAowYAIbYDAgCjBgAhtwMCAKMGACEJAwAAuwYAIB0AALwGACCWAwEAogYAIaIDQACnBgAhowNAAKcGACG0AwEAogYAIbUDAgCjBgAhtgMCAKMGACG3AwIAowYAIQMAAAARACA3AACHDAAgOAAAkQwAIBwAAAARACAEAAD3CAAgBQAA-AgAIAYAAPkIACAWAAD6CAAgFwAA-wgAIBgAAPwIACAZAAD9CAAgGgAA_ggAIBsAAP8IACAcAACACQAgIAAAgQkAICUAAIIJACAmAACDCQAgJwAAhAkAICgAAIUJACApAACGCQAgKgAAiAkAIDAAAJEMACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACEaBAAA9wgAIAUAAPgIACAGAAD5CAAgFgAA-ggAIBcAAPsIACAYAAD8CAAgGQAA_QgAIBoAAP4IACAbAAD_CAAgHAAAgAkAICAAAIEJACAlAACCCQAgJgAAgwkAICcAAIQJACAoAACFCQAgKQAAhgkAICoAAIgJACCWAwEAogYAIaIDQACnBgAhowNAAKcGACGuBAEAogYAIa8EAQCiBgAhsAQgAPsGACGxBAEApgYAIbIEAQCiBgAhswQgAPsGACETBAYCBQoDBgwEEAAbFhAFFzwFGD0FGUAIGkEJG0ILHEQSH2YUIFMWJVcXJmAXJ2MYKGQHKWUPKmcUAQMAAQEDAAEBAwABBgQXBgcAAQgSAQkTARAAEREbBwEKAAUGCwABDB0IEAAQEi8FFDMOFTcPBQQlCgsAAQ0hCRAADRErBwIHAAEMAAgDDAAIDykLEAAMAgcAAQ4ACgEPKgADBC0ADSwAES4AARMABwIHAAETAAcCFDgAFTkAAgQ6ABE7AAQDAAEQABUdSBMfTBQBHAASAwsAARwAEh5NAQIdTgAfTwABAwABAwcAASFYASNaGAQLAAEQABoiABckXhkBIwAYASRfABAEaAAFaQAWagAXawAYbAAZbQAabgAbbwAfdgAgcAAlcQAmcgAncwAodAApdQAqdwAAAAADEAAgPQAhPgAiAAAAAxAAID0AIT4AIgEDAAEBAwABAxAAJz0AKD4AKQAAAAMQACc9ACg-ACkBAwABAQMAAQMQAC49AC8-ADAAAAADEAAuPQAvPgAwAAAAAxAANj0ANz4AOAAAAAMQADY9ADc-ADgCBwABId0BAQIHAAEh4wEBBRAAPT0AQD4AQX8APoABAD8AAAAAAAUQAD09AEA-AEF_AD6AAQA_AgsAASIAFwILAAEiABcDEABGPQBHPgBIAAAAAxAARj0ARz4ASAEjABgBIwAYBRAATT0AUD4AUX8AToABAE8AAAAAAAUQAE09AFA-AFF_AE6AAQBPAQsAAQELAAEFEABWPQBZPgBafwBXgAEAWAAAAAAABRAAVj0AWT4AWn8AV4ABAFgCBwABDAAIAgcAAQwACAMQAF89AGA-AGEAAAADEABfPQBgPgBhAQwACAEMAAgFEABmPQBpPgBqfwBngAEAaAAAAAAABRAAZj0AaT4Aan8AZ4ABAGgCBwABDgAKAgcAAQ4ACgMQAG89AHA-AHEAAAADEABvPQBwPgBxAwsAAQz5AggS-gIFAwsAAQyAAwgSgQMFBRAAdj0AeT4Aen8Ad4ABAHgAAAAAAAUQAHY9AHk-AHp_AHeAAQB4ARMABwETAAcFEAB_PQCCAT4AgwF_AIABgAEAgQEAAAAAAAUQAH89AIIBPgCDAX8AgAGAAQCBAQIHAAETAAcCBwABEwAHBRAAiAE9AIsBPgCMAX8AiQGAAQCKAQAAAAAABRAAiAE9AIsBPgCMAX8AiQGAAQCKAQEDAAEBAwABAxAAkQE9AJIBPgCTAQAAAAMQAJEBPQCSAT4AkwEBAwABAQMAAQUQAJgBPQCbAT4AnAF_AJkBgAEAmgEAAAAAAAUQAJgBPQCbAT4AnAF_AJkBgAEAmgEAAAAFEACiAT0ApQE-AKYBfwCjAYABAKQBAAAAAAAFEACiAT0ApQE-AKYBfwCjAYABAKQBAwcAAQiGBAEJhwQBAwcAAQiNBAEJjgQBBRAAqwE9AK4BPgCvAX8ArAGAAQCtAQAAAAAABRAAqwE9AK4BPgCvAX8ArAGAAQCtAQEKAAUBCgAFBRAAtAE9ALcBPgC4AX8AtQGAAQC2AQAAAAAABRAAtAE9ALcBPgC4AX8AtQGAAQC2AQEDAAEBAwABBRAAvQE9AMABPgDBAX8AvgGAAQC_AQAAAAAABRAAvQE9AMABPgDBAX8AvgGAAQC_AQEcABIBHAASBRAAxgE9AMkBPgDKAX8AxwGAAQDIAQAAAAAABRAAxgE9AMkBPgDKAX8AxwGAAQDIAQMLAAEcABIe5AQBAwsAARwAEh7qBAEFEADPAT0A0gE-ANMBfwDQAYABANEBAAAAAAAFEADPAT0A0gE-ANMBfwDQAYABANEBKwIBLHgBLXoBLnsBL3wBMX4BMoABHDOBAR00gwEBNYUBHDaGAR45hwEBOogBATuJARw_jAEfQI0BI0GOAQJCjwECQ5ABAkSRAQJFkgECRpQBAkeWARxIlwEkSZkBAkqbARxLnAElTJ0BAk2eAQJOnwEcT6IBJlCjASpRpAEDUqUBA1OmAQNUpwEDVagBA1aqAQNXrAEcWK0BK1mvAQNasQEcW7IBLFyzAQNdtAEDXrUBHF-4AS1guQExYbsBMmK8ATJjvwEyZMABMmXBATJmwwEyZ8UBHGjGATNpyAEyasoBHGvLATRszAEybc0BMm7OARxv0QE1cNIBOXHTARdy1AEXc9UBF3TWARd11wEXdtkBF3fbARx43AE6ed8BF3rhARx74gE7fOQBF33lARd-5gEcgQHpATyCAeoBQoMB6wEYhAHsARiFAe0BGIYB7gEYhwHvARiIAfEBGIkB8wEcigH0AUOLAfYBGIwB-AEcjQH5AUSOAfoBGI8B-wEYkAH8ARyRAf8BRZIBgAJJkwGBAhmUAYICGZUBgwIZlgGEAhmXAYUCGZgBhwIZmQGJAhyaAYoCSpsBjAIZnAGOAhydAY8CS54BkAIZnwGRAhmgAZICHKEBlQJMogGWAlKjAZcCCKQBmAIIpQGZAgimAZoCCKcBmwIIqAGdAgipAZ8CHKoBoAJTqwGiAgisAaQCHK0BpQJUrgGmAgivAacCCLABqAIcsQGrAlWyAawCW7MBrQIJtAGuAgm1Aa8CCbYBsAIJtwGxAgm4AbMCCbkBtQIcugG2Aly7AbgCCbwBugIcvQG7Al2-AbwCCb8BvQIJwAG-AhzBAcECXsIBwgJiwwHDAgrEAcQCCsUBxQIKxgHGAgrHAccCCsgByQIKyQHLAhzKAcwCY8sBzgIKzAHQAhzNAdECZM4B0gIKzwHTAgrQAdQCHNEB1wJl0gHYAmvTAdkCC9QB2gIL1QHbAgvWAdwCC9cB3QIL2AHfAgvZAeECHNoB4gJs2wHkAgvcAeYCHN0B5wJt3gHoAgvfAekCC-AB6gIc4QHtAm7iAe4CcuMB7wIH5AHwAgflAfECB-YB8gIH5wHzAgfoAfUCB-kB9wIc6gH4AnPrAfwCB-wB_gIc7QH_AnTuAYIDB-8BgwMH8AGEAxzxAYcDdfIBiAN78wGJAw70AYoDDvUBiwMO9gGMAw73AY0DDvgBjwMO-QGRAxz6AZIDfPsBlAMO_AGWAxz9AZcDff4BmAMO_wGZAw6AApoDHIECnQN-ggKeA4QBgwKfAw-EAqADD4UCoQMPhgKiAw-HAqMDD4gCpQMPiQKnAxyKAqgDhQGLAqoDD4wCrAMcjQKtA4YBjgKuAw-PAq8DD5ACsAMckQKzA4cBkgK0A40BkwK2AwSUArcDBJUCuQMElgK6AwSXArsDBJgCvQMEmQK_AxyaAsADjgGbAsIDBJwCxAMcnQLFA48BngLGAwSfAscDBKACyAMcoQLLA5ABogLMA5QBowLNAxakAs4DFqUCzwMWpgLQAxanAtEDFqgC0wMWqQLVAxyqAtYDlQGrAtgDFqwC2gMcrQLbA5YBrgLcAxavAt0DFrAC3gMcsQLhA5cBsgLiA50BswLkA54BtALlA54BtQLoA54BtgLpA54BtwLqA54BuALsA54BuQLuAxy6Au8DnwG7AvEDngG8AvMDHL0C9AOgAb4C9QOeAb8C9gOeAcAC9wMcwQL6A6EBwgL7A6cBwwL8AwXEAv0DBcUC_gMFxgL_AwXHAoAEBcgCggQFyQKEBBzKAoUEqAHLAokEBcwCiwQczQKMBKkBzgKPBAXPApAEBdACkQQc0QKUBKoB0gKVBLAB0wKWBAbUApcEBtUCmAQG1gKZBAbXApoEBtgCnAQG2QKeBBzaAp8EsQHbAqEEBtwCowQc3QKkBLIB3gKlBAbfAqYEBuACpwQc4QKqBLMB4gKrBLkB4wKtBBLkAq4EEuUCsAQS5gKxBBLnArIEEugCtAQS6QK2BBzqArcEugHrArkEEuwCuwQc7QK8BLsB7gK9BBLvAr4EEvACvwQc8QLCBLwB8gLDBMIB8wLEBBP0AsUEE_UCxgQT9gLHBBP3AsgEE_gCygQT-QLMBBz6As0EwwH7As8EE_wC0QQc_QLSBMQB_gLTBBP_AtQEE4AD1QQcgQPYBMUBggPZBMsBgwPaBBSEA9sEFIUD3AQUhgPdBBSHA94EFIgD4AQUiQPiBByKA-MEzAGLA-YEFIwD6AQcjQPpBM0BjgPrBBSPA-wEFJAD7QQckQPwBM4BkgPxBNQB"
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

// src/lib/redis.ts
import { Redis } from "@upstash/redis";
var redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN
});

// src/lib/email.ts
import nodemailer from "nodemailer";
var transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER && env.SMTP_PASS ? {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  } : void 0
});
var sendOTPEmail = async (input) => {
  const { toEmail, subject, title, otp, description } = input;
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.log(`
========================================
\u{1F4E7} [DEV OTP LOG] ${title}
To: ${toEmail}
OTP Code: ${otp}
Subject: ${subject}
========================================
`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: toEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #4f46e5; margin-top: 0; text-align: center;">${title}</h2>
          <p style="color: #374151; font-size: 14px; line-height: 1.5;">${description}</p>
          <div style="background-color: #f3f4f6; padding: 18px; border-radius: 8px; margin: 24px 0; text-align: center; letter-spacing: 6px;">
            <span style="font-size: 32px; font-weight: bold; color: #111827;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #6b7280; text-align: center;">This code will expire in 5 minutes. Please do not share it with anyone.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center;">DevMentor Platform \u2022 Credit-Based Mentorship & Learning</p>
        </div>
      `
    });
    return true;
  } catch (err) {
    console.error("\u274C Failed to send OTP email via Nodemailer:", err);
    return false;
  }
};
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
    console.error("Failed to send receipt email via Nodemailer:", err);
    return false;
  }
};

// src/lib/auth.ts
var auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secondaryStorage: {
    get: async (key) => {
      const value = await redis.get(key);
      return value ? typeof value === "string" ? value : JSON.stringify(value) : null;
    },
    set: async (key, value, ttl) => {
      if (ttl) {
        await redis.set(key, value, { ex: ttl });
      } else {
        await redis.set(key, value);
      }
    },
    delete: async (key) => {
      await redis.del(key);
    },
    getAndDelete: async (key) => {
      const value = await redis.get(key);
      if (value !== null && value !== void 0) {
        await redis.del(key);
        return typeof value === "string" ? value : JSON.stringify(value);
      }
      return null;
    },
    increment: async (key, amount = 1) => {
      const count = await redis.incrby(key, amount);
      if (count === amount) {
        await redis.expire(key, 60);
      }
      return count;
    }
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",
  rateLimit: {
    enabled: false
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
        required: false
      }
    }
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true
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
            subject: "Reset Your DevMentor Password \u{1F511}",
            title: "Password Reset OTP",
            otp,
            description: "You requested to reset your DevMentor account password. Use the 6-digit code below to set a new password. If you didn't request this, please ignore this email."
          });
        } else {
          await sendOTPEmail({
            toEmail: email,
            subject: "Verify Your DevMentor Account \u{1F510}",
            title: "Email Verification OTP",
            otp,
            description: "Use the 6-digit code below to complete your registration on DevMentor. This code is valid for 5 minutes."
          });
        }
      }
    })
  ],
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
import { Redis as Redis2 } from "@upstash/redis";
var redis2 = new Redis2({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN
});
var BKASH_TOKEN_KEY = "bkash:id_token";
var bkashTokenCache = {
  get: async () => {
    try {
      return await redis2.get(BKASH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: async (token) => {
    try {
      await redis2.set(BKASH_TOKEN_KEY, token, { ex: 3540 });
    } catch (err) {
      console.warn("Upstash Redis token set warning:", err);
    }
  },
  clear: async () => {
    try {
      await redis2.del(BKASH_TOKEN_KEY);
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
  const CREDIT_RATE2 = 4;
  const creditsEarned = Math.floor(payment.amount / CREDIT_RATE2);
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
  const CREDIT_RATE2 = 4;
  const creditsRequired = Math.ceil(amount / CREDIT_RATE2);
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
  const status = (req.query.status || req.body?.status || "").toLowerCase();
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
  const clientBase = (env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
  const useTestClient = req.query.testClient === "true" || env.NODE_ENV === "development" && env.CLIENT_URL.includes("5500");
  if (useTestClient) {
    const redirectUrl2 = `http://localhost:5500/test-client/index.html?paymentID=${paymentID || ""}&status=${status || "unknown"}`;
    return res.redirect(redirectUrl2);
  }
  const trxID = executionResult?.payment?.trxID || req.query.trxID || req.query.trxId || "";
  let redirectUrl;
  if (status === "success" && !executionError) {
    const params = new URLSearchParams();
    if (paymentID) params.set("paymentID", paymentID);
    if (trxID) params.set("trxID", trxID);
    redirectUrl = `${clientBase}/payment/success${params.toString() ? `?${params.toString()}` : ""}`;
  } else if (status === "cancel") {
    const params = new URLSearchParams();
    if (paymentID) params.set("paymentID", paymentID);
    redirectUrl = `${clientBase}/payment/cancel${params.toString() ? `?${params.toString()}` : ""}`;
  } else {
    const params = new URLSearchParams();
    if (paymentID) params.set("paymentID", paymentID);
    if (executionError) params.set("error", executionError);
    redirectUrl = `${clientBase}/payment/fail${params.toString() ? `?${params.toString()}` : ""}`;
  }
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
import { Router as Router14 } from "express";

// src/middlewares/auth.middleware.ts
var requireAuth = async (req, res, next) => {
  try {
    const cleanHeaders = { ...req.headers };
    if (cleanHeaders.authorization) {
      delete cleanHeaders.cookie;
    }
    const session = await auth.api.getSession({
      headers: cleanHeaders
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
    const userRole = (req.user.role || "").toLowerCase();
    const allowedRoles = roles.map((r) => r.toLowerCase());
    if (roles.length && !allowedRoles.includes(userRole)) {
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
  selectedDays: z2.array(z2.number().int().positive()),
  targetMentorId: z2.string().optional()
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
  const { title, description, techStackTags, startDate, durationDays, selectedDays, targetMentorId } = payload;
  let finalTargetMentorId = null;
  if (targetMentorId) {
    if (targetMentorId === studentId) {
      throw new AppError("You cannot target a sprint request to yourself.", 400);
    }
    let targetedMentor = await prisma.user.findUnique({
      where: { id: targetMentorId },
      include: { mentorProfile: true }
    });
    if (!targetedMentor) {
      const profile = await prisma.mentorProfile.findUnique({
        where: { id: targetMentorId },
        include: { user: true }
      });
      if (profile) {
        targetedMentor = {
          ...profile.user,
          mentorProfile: profile
        };
      }
    }
    if (!targetedMentor || targetedMentor.role !== "mentor") {
      throw new AppError("Target mentor does not exist or is not a registered mentor.", 404);
    }
    if (targetedMentor.isBlocked) {
      throw new AppError("Targeted mentor account is currently suspended.", 400);
    }
    if (targetedMentor.mentorProfile?.approvalStatus !== "APPROVED") {
      throw new AppError("Targeted mentor is not yet approved by platform administrators.", 400);
    }
    finalTargetMentorId = targetedMentor.id;
  }
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
      targetMentorId: finalTargetMentorId,
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
      targetMentor: {
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
  return sprint;
};
var getOpenSprintPool = async (filters, requestingMentorId) => {
  const { search, tag, scope } = filters;
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;
  const where = {
    deletedAt: null,
    status: "PENDING_CLAIM"
  };
  if (requestingMentorId) {
    if (scope === "direct") {
      where.targetMentorId = requestingMentorId;
    } else if (scope === "broadcast") {
      where.targetMentorId = null;
    } else {
      where.AND = [
        {
          OR: [
            { targetMentorId: null },
            { targetMentorId: requestingMentorId }
          ]
        }
      ];
    }
  } else {
    where.targetMentorId = null;
  }
  if (tag) {
    where.techStackTags = {
      has: tag
    };
  }
  if (search) {
    const searchConditions = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
    ];
    if (where.AND) {
      where.AND.push({ OR: searchConditions });
    } else {
      where.OR = searchConditions;
    }
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
        targetMentor: {
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
  if (existingSprint.targetMentorId && existingSprint.targetMentorId !== mentorId) {
    throw new AppError("This sprint was directly targeted to another specific mentor", 403);
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
      targetMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true
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
      targetMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true
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
  const isStudentOwner = userId === sprint.studentId;
  const isClaimedMentor = userId === sprint.claimedByMentorId;
  const isTargetedMentor = userId === sprint.targetMentorId;
  const isOpenPoolSprint = sprint.status === "PENDING_CLAIM" && (!sprint.targetMentorId || sprint.targetMentorId === userId);
  if (!isStudentOwner && !isClaimedMentor && !isTargetedMentor && !isOpenPoolSprint) {
    throw new AppError("You cannot access this sprint details", 403);
  }
  return sprint;
};
var getUserSprints = async (userId, role) => {
  const where = {
    deletedAt: null
  };
  if (role === "mentor") {
    where.OR = [
      { claimedByMentorId: userId },
      { targetMentorId: userId }
    ];
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
      targetMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true
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
  const mentorId = req.user?.id;
  const result = await sprintService.getOpenSprintPool(req.query, mentorId);
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
  proposedTime: z3.string().datetime().optional(),
  scheduledAt: z3.string().datetime().optional(),
  joinLink: z3.string().url().optional(),
  durationMinutes: z3.number().int().positive().optional()
}).transform((data) => ({
  scheduledAt: data.scheduledAt || data.proposedTime,
  joinLink: data.joinLink,
  durationMinutes: data.durationMinutes
})).refine((data) => !!data.scheduledAt, {
  message: "proposedTime or scheduledAt is required (ISO 8601 datetime string)",
  path: ["proposedTime"]
});

// src/modules/payout/payout.service.ts
var CREDIT_RATE = 4;
var getTreasuryWallet = async (tx) => {
  const db = tx || prisma;
  const admin = await db.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" }
  });
  if (!admin) {
    throw new AppError("System admin user account is required for platform treasury.", 500);
  }
  const treasuryWallet = await db.wallet.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0
    },
    update: {}
  });
  return treasuryWallet;
};
var getPlatformCommissionPercent = async (tx) => {
  const db = tx || prisma;
  const settings = await db.platformSetting.findFirst();
  return settings?.sessionCommissionPercent ?? 15;
};
var createPayoutRequest = async (mentorId, payload) => {
  const { amountBdt, method = "BKASH", accountNumber } = payload;
  const creditsRequired = Math.ceil(amountBdt / CREDIT_RATE);
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { wallet: true }
  });
  if (!mentor || mentor.role !== "mentor" && mentor.role !== "admin") {
    throw new AppError("Only verified mentors and administrators can request payouts.", 403);
  }
  const wallet = mentor.wallet;
  if (!wallet || wallet.balance < creditsRequired) {
    throw new AppError(
      `Insufficient credit balance. You need ${creditsRequired} Credits (\u09F3${amountBdt.toLocaleString()}) to request this payout, but you only have ${wallet?.balance || 0} Credits available.`,
      400
    );
  }
  const existingPending = await prisma.payoutRequest.findFirst({
    where: {
      mentorId,
      status: "PENDING"
    }
  });
  if (existingPending) {
    throw new AppError(
      `You already have a pending payout request of \u09F3${existingPending.amountBdt.toLocaleString()} undergoing review. Please wait for it to be processed before submitting another.`,
      400
    );
  }
  const { payoutRequest, updatedWallet } = await prisma.$transaction(async (tx) => {
    const currentWallet = await tx.wallet.findUnique({
      where: { id: wallet.id }
    });
    if (!currentWallet || currentWallet.balance < creditsRequired) {
      throw new AppError(
        `Insufficient credit balance. Required: ${creditsRequired} Credits, Available: ${currentWallet?.balance || 0} Credits.`,
        400
      );
    }
    const updatedWallet2 = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: creditsRequired }
      }
    });
    const payoutRequest2 = await tx.payoutRequest.create({
      data: {
        mentorId,
        walletId: wallet.id,
        amountCredits: creditsRequired,
        amountBdt,
        method,
        accountNumber,
        status: "PENDING"
      },
      include: {
        mentor: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    });
    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -creditsRequired,
        type: "WITHDRAWAL",
        description: `Payout request created: \u09F3${amountBdt.toLocaleString()} (${creditsRequired} Credits) to ${method} ${accountNumber}`,
        referenceId: payoutRequest2.id
      }
    });
    return { payoutRequest: payoutRequest2, updatedWallet: updatedWallet2 };
  });
  return {
    message: `Payout request of \u09F3${amountBdt.toLocaleString()} (${creditsRequired} Credits) submitted successfully! It is now pending administrator review.`,
    payoutRequest,
    wallet: updatedWallet
  };
};
var getMyPayoutRequests = async (mentorId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [payouts, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { mentorId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        admin: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.payoutRequest.count({ where: { mentorId } })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    },
    data: payouts
  };
};
var getAdminPayouts = async (filters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 20;
  const skip = (page - 1) * limit;
  const where = {};
  if (filters.status) {
    where.status = filters.status;
  }
  const [payouts, total, statusCounts, totalPendingBdt] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        mentor: {
          select: { id: true, name: true, email: true, image: true }
        },
        wallet: true,
        admin: {
          select: { id: true, name: true, email: true }
        }
      }
    }),
    prisma.payoutRequest.count({ where }),
    prisma.payoutRequest.groupBy({
      by: ["status"],
      _count: true
    }),
    prisma.payoutRequest.aggregate({
      where: { status: "PENDING" },
      _sum: { amountBdt: true, amountCredits: true }
    })
  ]);
  const summary = {
    pendingCount: statusCounts.find((s) => s.status === "PENDING")?._count || 0,
    processedCount: statusCounts.find((s) => s.status === "PROCESSED")?._count || 0,
    rejectedCount: statusCounts.find((s) => s.status === "REJECTED")?._count || 0,
    totalPendingBdt: totalPendingBdt._sum.amountBdt || 0,
    totalPendingCredits: totalPendingBdt._sum.amountCredits || 0
  };
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    },
    summary,
    data: payouts
  };
};
var processPayoutRequest = async (adminId, payoutRequestId, payload) => {
  const payoutRequest = await prisma.payoutRequest.findUnique({
    where: { id: payoutRequestId },
    include: {
      wallet: true,
      mentor: { select: { id: true, name: true, email: true } }
    }
  });
  if (!payoutRequest) {
    throw new AppError("Payout request not found", 404);
  }
  if (payoutRequest.status !== "PENDING") {
    throw new AppError(
      `This payout request has already been ${payoutRequest.status.toLowerCase()} on ${payoutRequest.processedAt?.toISOString()} and cannot be modified again.`,
      400
    );
  }
  const { status, rejectionReason } = payload;
  const result = await prisma.$transaction(async (tx) => {
    if (status === "PROCESSED") {
      const updated = await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: "PROCESSED",
          processedBy: adminId,
          processedAt: /* @__PURE__ */ new Date()
        },
        include: {
          mentor: { select: { id: true, name: true, email: true, image: true } },
          admin: { select: { id: true, name: true, email: true } }
        }
      });
      await tx.wallet.update({
        where: { id: payoutRequest.walletId },
        data: {
          totalWithdrawn: { increment: payoutRequest.amountBdt }
        }
      });
      return {
        message: `Payout request of \u09F3${payoutRequest.amountBdt.toLocaleString()} approved and marked as PROCESSED.`,
        payoutRequest: updated
      };
    } else {
      const updated = await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: "REJECTED",
          processedBy: adminId,
          processedAt: /* @__PURE__ */ new Date(),
          rejectionReason: rejectionReason || "Declined by administrator"
        },
        include: {
          mentor: { select: { id: true, name: true, email: true, image: true } },
          admin: { select: { id: true, name: true, email: true } }
        }
      });
      await tx.wallet.update({
        where: { id: payoutRequest.walletId },
        data: {
          balance: { increment: payoutRequest.amountCredits }
        }
      });
      await tx.creditTransaction.create({
        data: {
          walletId: payoutRequest.walletId,
          amount: payoutRequest.amountCredits,
          type: "WITHDRAWAL_REFUND",
          description: `Payout refund: +${payoutRequest.amountCredits} Credits returned. Reason: ${rejectionReason || "Admin declined"}`,
          referenceId: payoutRequest.id
        }
      });
      return {
        message: `Payout request rejected and ${payoutRequest.amountCredits} Credits successfully refunded to mentor's wallet.`,
        payoutRequest: updated
      };
    }
  });
  return result;
};
var payoutService = {
  getTreasuryWallet,
  getPlatformCommissionPercent,
  createPayoutRequest,
  getMyPayoutRequests,
  getAdminPayouts,
  processPayoutRequest
};

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
  const platformSetting = await prisma.platformSetting.findFirst();
  const sprintCreditCost = platformSetting?.sprintCreditPerSession || 50;
  const studentWallet = await prisma.wallet.findUnique({
    where: { userId: studentId }
  });
  if (!studentWallet || studentWallet.balance < sprintCreditCost) {
    throw new AppError(
      `Insufficient wallet balance. You need at least ${sprintCreditCost} credits to confirm this session (your available balance: ${studentWallet?.balance || 0} credits). Please top up your wallet via bKash.`,
      400
    );
  }
  const confirmedSession = await prisma.$transaction(async (tx) => {
    const updatedStudentWallet = await tx.wallet.update({
      where: { userId: studentId },
      data: {
        balance: { decrement: sprintCreditCost }
      }
    });
    await tx.creditTransaction.create({
      data: {
        walletId: updatedStudentWallet.id,
        amount: -sprintCreditCost,
        type: "SPRINT_ESCROW",
        description: `Escrow hold for Day ${session.dayNumber} sprint session: ${session.sprintRequest.title}`,
        referenceId: session.id
      }
    });
    return await tx.sprintSession.update({
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
  if (!claimedByMentorId) {
    throw new AppError("No mentor is assigned to this sprint session", 400);
  }
  const sessionCost = session.creditCost || 50;
  const platformSetting = await prisma.platformSetting.findFirst();
  const commissionPercent = platformSetting?.sessionCommissionPercent ?? 15;
  const platformFeeRate = commissionPercent / 100;
  const platformCommissionAmount = Math.round(sessionCost * platformFeeRate);
  const mentorNetEarnings = sessionCost - platformCommissionAmount;
  const completedSession = await prisma.$transaction(async (tx) => {
    if (mentorNetEarnings > 0) {
      const mentorWallet = await tx.wallet.upsert({
        where: { userId: claimedByMentorId },
        create: {
          userId: claimedByMentorId,
          balance: mentorNetEarnings,
          totalEarned: mentorNetEarnings,
          totalWithdrawn: 0
        },
        update: {
          balance: { increment: mentorNetEarnings },
          totalEarned: { increment: mentorNetEarnings }
        }
      });
      await tx.creditTransaction.create({
        data: {
          walletId: mentorWallet.id,
          amount: mentorNetEarnings,
          type: "SPRINT_RELEASE",
          description: `Payment released for completed sprint session (Day ${session.dayNumber}): ${session.sprintRequest.title} (Net after ${commissionPercent}% platform cut)`,
          referenceId: session.id
        }
      });
    }
    if (platformCommissionAmount > 0) {
      try {
        const treasuryWallet = await getTreasuryWallet(tx);
        await tx.wallet.update({
          where: { id: treasuryWallet.id },
          data: {
            balance: { increment: platformCommissionAmount },
            totalEarned: { increment: platformCommissionAmount }
          }
        });
        await tx.creditTransaction.create({
          data: {
            walletId: treasuryWallet.id,
            amount: platformCommissionAmount,
            type: "PLATFORM_COMMISSION",
            description: `Platform fee (${commissionPercent}%) earned from completed sprint session (Day ${session.dayNumber}): ${session.sprintRequest.title}`,
            referenceId: session.id
          }
        });
      } catch (err) {
        console.error("Warning: Failed to credit platform treasury wallet:", err);
      }
    }
    return await tx.sprintSession.update({
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
  });
  return {
    message: `Session marked as completed. Released ${mentorNetEarnings} credits to mentor (Platform cut: ${platformCommissionAmount} credits).`,
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
  const refundAmount = session.creditCost || 50;
  const cancelledSession = await prisma.$transaction(async (tx) => {
    if (session.status === "CONFIRMED" && isEligibleForRefund) {
      const studentWallet = await tx.wallet.findUnique({
        where: { userId: studentId }
      });
      if (studentWallet) {
        await tx.wallet.update({
          where: { id: studentWallet.id },
          data: {
            balance: { increment: refundAmount }
          }
        });
        await tx.creditTransaction.create({
          data: {
            walletId: studentWallet.id,
            amount: refundAmount,
            type: "SPRINT_REFUND",
            description: `Full refund for cancelled sprint session (Day ${session.dayNumber}): ${session.sprintRequest.title}`,
            referenceId: session.id
          }
        });
      }
    }
    return await tx.sprintSession.update({
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
  });
  return {
    message: isEligibleForRefund ? `Session cancelled successfully. Full refund of ${refundAmount} credits issued to student.` : "Session cancelled within 1 hour of scheduled time. No credit refund issued.",
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
var getCohortEnrollments = async (cohortId, userId, userRole) => {
  const cohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null }
  });
  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }
  if (cohort.mentorId !== userId) {
    throw new AppError("You are not authorized to view enrollments for this cohort program", 403);
  }
  const enrollments = await prisma.cohortEnrollment.findMany({
    where: { cohortId },
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      cohortId: true,
      studentId: true,
      enrolledAt: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      }
    }
  });
  return enrollments;
};
var cohortService = {
  createCohort,
  getAllPublishedCohorts,
  getCohortById,
  getMyCreatedCohorts,
  updateCohort,
  deleteCohort,
  registerCohort,
  getCohortEnrollments
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
var getCohortEnrollments2 = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { id } = req.params;
  const result = await cohortService.getCohortEnrollments(id, userId, userRole);
  sendSuccess(res, "Cohort enrolled students fetched successfully", result);
});
var cohortController = {
  createCohort: createCohort2,
  getAllPublishedCohorts: getAllPublishedCohorts2,
  getCohortById: getCohortById2,
  getMyCreatedCohorts: getMyCreatedCohorts2,
  updateCohort: updateCohort2,
  deleteCohort: deleteCohort2,
  registerCohort: registerCohort2,
  getCohortEnrollments: getCohortEnrollments2
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
router3.get(
  "/:id/enrollments",
  requireAuth,
  requireRole("mentor"),
  cohortController.getCohortEnrollments
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
  const existingCount = await prisma.cohortSession.count({ where: { cohortId } });
  const nextNumber = existingCount + 1;
  const {
    sessionNumber = nextNumber,
    dayNumber = nextNumber,
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
      creditCost: creditCost ?? 0,
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
  const platformSetting = await prisma.platformSetting.findFirst();
  const commissionPercent = platformSetting?.sessionCommissionPercent ?? 15;
  const platformFeeRate = commissionPercent / 100;
  const platformCommissionAmount = Math.round(totalEscrowCollected * platformFeeRate);
  const mentorNetEarnings = totalEscrowCollected - platformCommissionAmount;
  const updatedSession = await prisma.$transaction(async (tx) => {
    if (mentorNetEarnings > 0) {
      const mentorWallet = await tx.wallet.upsert({
        where: { userId: mentorId },
        create: {
          userId: mentorId,
          balance: mentorNetEarnings,
          totalEarned: mentorNetEarnings,
          totalWithdrawn: 0
        },
        update: {
          balance: { increment: mentorNetEarnings },
          totalEarned: { increment: mentorNetEarnings }
        }
      });
      await tx.creditTransaction.create({
        data: {
          walletId: mentorWallet.id,
          amount: mentorNetEarnings,
          type: "COHORT_RELEASE",
          description: `Escrow release for completed cohort session (${totalPaidParticipants} participants): ${session.title} (Net after ${commissionPercent}% platform cut)`,
          referenceId: session.id
        }
      });
    }
    if (platformCommissionAmount > 0) {
      try {
        const treasuryWallet = await getTreasuryWallet(tx);
        await tx.wallet.update({
          where: { id: treasuryWallet.id },
          data: {
            balance: { increment: platformCommissionAmount },
            totalEarned: { increment: platformCommissionAmount }
          }
        });
        await tx.creditTransaction.create({
          data: {
            walletId: treasuryWallet.id,
            amount: platformCommissionAmount,
            type: "PLATFORM_COMMISSION",
            description: `Platform fee (${commissionPercent}%) earned from completed cohort session: ${session.title}`,
            referenceId: session.id
          }
        });
      } catch (err) {
        console.error("Warning: Failed to credit platform treasury wallet:", err);
      }
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
var cohortSessionBaseSchema = z5.object({
  sessionNumber: z5.number().int().positive().optional(),
  dayNumber: z5.number().int().positive().optional(),
  title: z5.string().min(3, "Title must be at least 3 characters").max(100).optional(),
  scheduledAt: z5.string().datetime("Scheduled time must be a valid ISO 8601 date string").optional(),
  durationMinutes: z5.number().int().positive().optional().default(60),
  creditCost: z5.number().int().nonnegative().optional(),
  creditPrice: z5.number().int().nonnegative().optional(),
  joinLink: z5.string().url("Invalid join link URL").optional().nullable(),
  resources: z5.array(resourceItemSchema).optional()
});
var normalizeCreditCost = (data) => ({
  ...data,
  creditCost: data.creditCost ?? data.creditPrice ?? 0
});
var createCohortSessionSchema = cohortSessionBaseSchema.required({ title: true, scheduledAt: true }).transform(normalizeCreditCost);
var updateCohortSessionSchema = cohortSessionBaseSchema.transform(normalizeCreditCost);
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
  const { name, image, bio, techStackTags, githubUrl, resumeUrl } = payload;
  const userDataToUpdate = {};
  if (name !== void 0) userDataToUpdate.name = name;
  if (image !== void 0) userDataToUpdate.image = image === "" ? null : image;
  if (Object.keys(userDataToUpdate).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: userDataToUpdate
    });
  }
  if (user.mentorProfile) {
    const mentorDataToUpdate = {};
    if (bio !== void 0) mentorDataToUpdate.bio = bio;
    if (techStackTags !== void 0) mentorDataToUpdate.techStackTags = techStackTags;
    if (githubUrl !== void 0) mentorDataToUpdate.githubUrl = githubUrl === "" ? null : githubUrl;
    if (resumeUrl !== void 0) mentorDataToUpdate.resumeUrl = resumeUrl === "" ? null : resumeUrl;
    if (Object.keys(mentorDataToUpdate).length > 0) {
      await prisma.mentorProfile.update({
        where: { userId },
        data: mentorDataToUpdate
      });
    }
  } else if (user.role === "mentor") {
    await prisma.mentorProfile.create({
      data: {
        userId,
        bio: bio ?? "Experienced software engineering mentor.",
        techStackTags: techStackTags ?? [],
        githubUrl: githubUrl === "" ? null : githubUrl ?? null,
        resumeUrl: resumeUrl === "" ? null : resumeUrl ?? null
      }
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
    const [createdCohorts, claimedSprints, directSprintRequests] = await Promise.all([
      prisma.cohortProgram.findMany({
        where: { mentorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" }
      }),
      prisma.sprintRequest.findMany({
        where: { claimedByMentorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          student: {
            select: { id: true, name: true, email: true, image: true }
          },
          sessions: {
            orderBy: { dayNumber: "asc" }
          }
        }
      }),
      prisma.sprintRequest.findMany({
        where: {
          targetMentorId: userId,
          status: "PENDING_CLAIM",
          deletedAt: null
        },
        orderBy: { createdAt: "desc" },
        include: {
          student: {
            select: { id: true, name: true, email: true, image: true }
          },
          sessions: {
            orderBy: { dayNumber: "asc" }
          }
        }
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
        totalDirectSprints: directSprintRequests.length,
        createdCohorts,
        claimedSprints,
        directSprintRequests
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
  image: z7.union([z7.string().url("Invalid image URL"), z7.literal("")]).optional().nullable(),
  bio: z7.string().min(10, "Bio must be at least 10 characters long").max(1e3).optional(),
  techStackTags: z7.array(z7.string().min(1)).optional(),
  githubUrl: z7.union([z7.string().url("Invalid GitHub URL"), z7.literal("")]).optional().nullable(),
  resumeUrl: z7.union([z7.string().url("Invalid Resume URL"), z7.literal("")]).optional().nullable()
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
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "text/plain",
      "text/x-patch",
      "text/x-diff",
      "text/javascript",
      "text/typescript",
      "application/json"
    ];
    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".pdf",
      ".doc",
      ".docx",
      ".diff",
      ".patch",
      ".txt",
      ".md",
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".go",
      ".rs",
      ".json",
      ".zip"
    ];
    const fileName = (file.originalname || "").toLowerCase();
    const isExtensionMatch = allowedExtensions.some((ext) => fileName.endsWith(ext));
    const isMimeMatch = allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith("text/");
    if (isMimeMatch || isExtensionMatch) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `Invalid file format '${file.mimetype}'. Only images, documents, git diff/patches (.diff, .patch), source code files, and archives are allowed.`,
          400
        ),
        false
      );
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
  if (Array.isArray(req.files) && req.files.length > 1) {
    const results = await uploadService.uploadMultipleFilesToCloudinary(req.files);
    sendSuccess(res, `${results.length} file(s) uploaded to Cloudinary successfully`, results, 201);
    return;
  }
  const singleFile = req.file || (Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : void 0);
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
var getAdminCohorts = async (filters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;
  const where = {
    deletedAt: null
  };
  if (filters.approvalStatus) {
    const mappedStatus = filters.approvalStatus === "PENDING" ? "PENDING_APPROVAL" : filters.approvalStatus;
    where.approvalStatus = mappedStatus;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { mentor: { name: { contains: filters.search, mode: "insensitive" } } },
      { mentor: { email: { contains: filters.search, mode: "insensitive" } } }
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
            mentorProfile: {
              select: {
                id: true,
                bio: true,
                techStackTags: true,
                experienceLevel: true,
                githubUrl: true
              }
            }
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
var getPlatformStats = async () => {
  const [
    totalUsers,
    totalStudents,
    totalMentors,
    pendingMentorApplications,
    totalCohorts,
    pendingCohorts,
    pendingPayouts,
    paymentAgg,
    walletAgg,
    platformSetting
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "student" } }),
    prisma.user.count({ where: { role: "mentor" } }),
    prisma.mentorProfile.count({ where: { approvalStatus: "PENDING" } }),
    prisma.cohortProgram.count({ where: { deletedAt: null } }),
    prisma.cohortProgram.count({
      where: {
        approvalStatus: "PENDING_APPROVAL",
        deletedAt: null
      }
    }),
    prisma.payoutRequest.count({
      where: {
        status: "PENDING"
      }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" }
    }),
    prisma.wallet.aggregate({
      _sum: { balance: true }
    }),
    prisma.platformSetting.findFirst()
  ]);
  const totalRevenueBdt = paymentAgg._sum.amount ?? 0;
  const commissionPercent = platformSetting?.sessionCommissionPercent ?? 15;
  const platformCommissionEarnedBdt = Math.round(totalRevenueBdt * commissionPercent / 100);
  const totalCreditsCirculating = walletAgg._sum.balance ?? 0;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = /* @__PURE__ */ new Date();
  const monthlyDataPromises = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthLabel = monthNames[d.getMonth()];
    monthlyDataPromises.push(
      Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: "COMPLETED",
            createdAt: { gte: monthStart, lte: monthEnd }
          }
        }),
        prisma.creditTransaction.aggregate({
          _sum: { amount: true },
          where: {
            type: "WITHDRAWAL",
            createdAt: { gte: monthStart, lte: monthEnd }
          }
        })
      ]).then(([pAgg, wAgg]) => {
        const gross = pAgg._sum.amount ?? 0;
        const commission = Math.round(gross * commissionPercent / 100);
        const withdrawalsBdt = (wAgg._sum.amount ?? 0) * 4;
        return {
          month: monthLabel,
          grossRevenue: gross,
          platformCommission: commission,
          mentorPayouts: withdrawalsBdt
        };
      })
    );
  }
  const monthlyRevenue = await Promise.all(monthlyDataPromises);
  return {
    totalUsers,
    totalStudents,
    totalMentors,
    pendingMentorApplications,
    totalCohorts,
    pendingCohorts,
    pendingPayouts,
    totalRevenueBdt,
    platformCommissionEarnedBdt,
    totalCreditsCirculating,
    monthlyRevenue
  };
};
var getPlatformSettings = async () => {
  let settings = await prisma.platformSetting.findFirst();
  if (!settings) {
    settings = await prisma.platformSetting.create({
      data: {
        sprintCreditPerSession: 50,
        sessionCommissionPercent: 15
      }
    });
  }
  return settings;
};
var updatePlatformSettings = async (payload) => {
  let settings = await prisma.platformSetting.findFirst();
  if (!settings) {
    settings = await prisma.platformSetting.create({
      data: {
        sprintCreditPerSession: payload.sprintCreditPerSession ?? 50,
        sessionCommissionPercent: payload.sessionCommissionPercent ?? 15
      }
    });
  } else {
    const updateData = {};
    if (payload.sprintCreditPerSession !== void 0) {
      updateData.sprintCreditPerSession = payload.sprintCreditPerSession;
    }
    if (payload.sessionCommissionPercent !== void 0) {
      updateData.sessionCommissionPercent = payload.sessionCommissionPercent;
    }
    settings = await prisma.platformSetting.update({
      where: { id: settings.id },
      data: updateData
    });
  }
  return settings;
};
var adminService = {
  approveOrRejectMentor,
  toggleUserBlock,
  getAllUsers,
  approveOrRejectCohort,
  getAdminCohorts,
  getPlatformStats,
  getPlatformSettings,
  updatePlatformSettings
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
var getAllCohorts = catchAsync(async (req, res) => {
  const result = await adminService.getAdminCohorts(req.query);
  sendSuccess(res, "Admin cohorts fetched successfully", result);
});
var getPlatformStats2 = catchAsync(async (req, res) => {
  const result = await adminService.getPlatformStats();
  sendSuccess(res, "Platform overview statistics fetched successfully", result);
});
var getPlatformSettings2 = catchAsync(async (req, res) => {
  const result = await adminService.getPlatformSettings();
  sendSuccess(res, "Platform settings fetched successfully", result);
});
var updatePlatformSettings2 = catchAsync(async (req, res) => {
  const result = await adminService.updatePlatformSettings(req.body);
  sendSuccess(res, "Platform settings updated successfully", result);
});
var adminController = {
  approveOrRejectMentor: approveOrRejectMentor2,
  toggleUserBlock: toggleUserBlock2,
  getAllUsers: getAllUsers2,
  approveOrRejectCohort: approveOrRejectCohort2,
  getAllCohorts,
  getPlatformStats: getPlatformStats2,
  getPlatformSettings: getPlatformSettings2,
  updatePlatformSettings: updatePlatformSettings2
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
var updatePlatformSettingSchema = z8.object({
  sprintCreditPerSession: z8.number({ error: "sprintCreditPerSession must be a number" }).int("sprintCreditPerSession must be an integer").min(1, "sprintCreditPerSession must be at least 1").max(5e3, "sprintCreditPerSession cannot exceed 5000").optional(),
  sessionCommissionPercent: z8.number({ error: "sessionCommissionPercent must be a number" }).int("sessionCommissionPercent must be an integer").min(0, "sessionCommissionPercent must be at least 0%").max(100, "sessionCommissionPercent cannot exceed 100%").optional()
});

// src/modules/payout/payout.controller.ts
var createPayoutRequestHandler = catchAsync(
  async (req, res) => {
    const mentorId = req.user.id;
    const result = await payoutService.createPayoutRequest(mentorId, req.body);
    sendSuccess(res, result.message, result, 201);
  }
);
var getMyPayoutRequestsHandler = catchAsync(
  async (req, res) => {
    const mentorId = req.user.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await payoutService.getMyPayoutRequests(
      mentorId,
      page,
      limit
    );
    sendSuccess(res, "Payout requests fetched successfully", result);
  }
);
var getAdminPayoutsHandler = catchAsync(
  async (req, res) => {
    const status = req.query.status;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await payoutService.getAdminPayouts({ status, page, limit });
    sendSuccess(res, "Admin payouts queue fetched successfully", result);
  }
);
var processPayoutRequestHandler = catchAsync(
  async (req, res) => {
    const adminId = req.user.id;
    const { id } = req.params;
    const result = await payoutService.processPayoutRequest(
      adminId,
      id,
      req.body
    );
    sendSuccess(res, result.message, result);
  }
);
var payoutController = {
  createPayoutRequestHandler,
  getMyPayoutRequestsHandler,
  getAdminPayoutsHandler,
  processPayoutRequestHandler
};

// src/modules/payout/payout.validation.ts
import { z as z9 } from "zod";
var createPayoutRequestSchema = z9.object({
  amountBdt: z9.number().min(200, "Minimum withdrawal threshold is 200 BDT (50 Credits)").max(1e5, "Maximum single withdrawal limit is 100,000 BDT"),
  method: z9.enum(["BKASH", "NAGAD", "BANK"]).optional().default("BKASH"),
  accountNumber: z9.string().min(10, "Account/mobile number must be at least 10 characters").max(50, "Account/mobile number cannot exceed 50 characters")
});
var processPayoutSchema = z9.object({
  status: z9.enum(["PROCESSED", "REJECTED"]),
  rejectionReason: z9.string().optional()
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
router9.get("/cohorts", adminController.getAllCohorts);
router9.get("/stats", adminController.getPlatformStats);
router9.get("/settings", adminController.getPlatformSettings);
router9.patch(
  "/settings",
  validate(updatePlatformSettingSchema),
  adminController.updatePlatformSettings
);
router9.get("/payouts", payoutController.getAdminPayoutsHandler);
router9.patch(
  "/payouts/:id/process",
  validate(processPayoutSchema),
  payoutController.processPayoutRequestHandler
);
var admin_routes_default = router9;

// src/modules/payment/payment.routes.ts
import { Router as Router10 } from "express";

// src/modules/payment/payment.validation.ts
import { z as z10 } from "zod";
var initiateTopUpSchema = z10.object({
  amount: z10.number().min(10, "Minimum top-up amount is 10 BDT").max(5e4, "Maximum single top-up limit is 50,000 BDT")
});
var requestWithdrawalSchema = z10.object({
  amount: z10.number().min(1e3, "Minimum withdrawal threshold is 1,000 BDT (250 Credits)").max(1e5, "Maximum single withdrawal limit is 100,000 BDT"),
  bkashNumber: z10.string().regex(/^01[3-9]\d{8}$/, "Invalid Bangladeshi bKash mobile number format (e.g. 017XXXXXXXX)")
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
  const {
    tier,
    title,
    description,
    codeSnippet,
    language,
    githubRepoUrl,
    branchName,
    specificFiles,
    attachmentUrl,
    attachmentName,
    attachmentSize
  } = payload;
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
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        attachmentSize: attachmentSize || null,
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
      ...payload.specificFiles !== void 0 && { specificFiles: payload.specificFiles },
      ...payload.attachmentUrl !== void 0 && { attachmentUrl: payload.attachmentUrl },
      ...payload.attachmentName !== void 0 && { attachmentName: payload.attachmentName },
      ...payload.attachmentSize !== void 0 && { attachmentSize: payload.attachmentSize }
    }
  });
  return {
    success: true,
    message: "Code review request updated successfully",
    data: updatedRequest
  };
};
var cleanExpiredPreviewLocks = async () => {
  const now = /* @__PURE__ */ new Date();
  return await prisma.codeReviewRequest.updateMany({
    where: {
      status: "PREVIEW_LOCKED",
      previewExpiresAt: { lt: now }
    },
    data: {
      status: "OPEN",
      previewMentorId: null,
      previewExpiresAt: null
    }
  });
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
  const { summary, reviewedCodeSnippet, videoUrl, pullRequestUrl, attachmentUrl, attachmentName, comments } = payload;
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
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
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
  try {
    await cleanExpiredPreviewLocks();
  } catch (err) {
    console.error("Warning: Lazy preview lock expiration failed:", err);
  }
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
var getMyCodeReviewRequests = async (studentId, query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(query.limit) || 10));
  const skip = (page - 1) * limit;
  const whereConditions = [{ studentId }];
  if (query.status) {
    whereConditions.push({ status: query.status });
  }
  if (query.tier) {
    whereConditions.push({ tier: query.tier });
  }
  if (query.search) {
    whereConditions.push({
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { specificFiles: { contains: query.search, mode: "insensitive" } }
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
        assignedMentor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            mentorProfile: {
              select: {
                bio: true,
                techStackTags: true,
                experienceLevel: true,
                githubUrl: true
              }
            }
          }
        },
        submission: {
          select: {
            id: true,
            summary: true,
            videoUrl: true,
            pullRequestUrl: true,
            createdAt: true,
            _count: {
              select: { comments: true }
            }
          }
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
var getCodeReviewById = async (userId, userRole, requestId) => {
  const reviewRequest = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true
        }
      },
      assignedMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: {
            select: {
              bio: true,
              techStackTags: true,
              experienceLevel: true,
              githubUrl: true
            }
          }
        }
      },
      submission: {
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          comments: {
            orderBy: { lineNumber: "asc" }
          }
        }
      }
    }
  });
  if (!reviewRequest) {
    throw new AppError("Code review request not found", 404);
  }
  if (reviewRequest.status === "PREVIEW_LOCKED" && reviewRequest.previewExpiresAt && new Date(reviewRequest.previewExpiresAt) <= /* @__PURE__ */ new Date()) {
    try {
      await prisma.codeReviewRequest.update({
        where: { id: requestId },
        data: {
          status: "OPEN",
          previewMentorId: null,
          previewExpiresAt: null
        }
      });
      reviewRequest.status = "OPEN";
      reviewRequest.previewMentorId = null;
      reviewRequest.previewExpiresAt = null;
    } catch {
    }
  }
  const isOwner = reviewRequest.studentId === userId;
  const isAssignedMentor = reviewRequest.assignedMentorId === userId;
  const isPreviewMentor = reviewRequest.previewMentorId === userId;
  const isAdmin = userRole === "admin";
  const isMentorViewingPool = userRole === "mentor" && (reviewRequest.status === "OPEN" || reviewRequest.status === "PREVIEW_LOCKED" && reviewRequest.previewExpiresAt && new Date(reviewRequest.previewExpiresAt) <= /* @__PURE__ */ new Date());
  if (!isOwner && !isAssignedMentor && !isPreviewMentor && !isAdmin && !isMentorViewingPool) {
    throw new AppError("You are not authorized to view this code review request", 403);
  }
  return {
    success: true,
    data: reviewRequest
  };
};
var codeReviewService = {
  cleanExpiredPreviewLocks,
  createReviewRequest,
  updateCodeSnippet,
  previewLockReviewRequest,
  claimReviewRequest,
  submitReview,
  approveAndRelease,
  cancelReviewRequest,
  getOpenCodeReviewPool,
  getMyCodeReviewRequests,
  getCodeReviewById
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
var getMyRequestsHandler = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const result = await codeReviewService.getMyCodeReviewRequests(studentId, req.query);
  sendSuccess(res, "My code review requests retrieved successfully", {
    requests: result.data,
    meta: result.meta
  }, 200);
});
var getReviewByIdHandler = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const id = req.params.id;
  const result = await codeReviewService.getCodeReviewById(userId, userRole, id);
  sendSuccess(res, "Code review request details retrieved successfully", result.data, 200);
});
var codeReviewController = {
  createReviewRequestHandler,
  updateCodeSnippetHandler,
  previewLockHandler,
  claimReviewRequestHandler,
  submitReviewHandler,
  approveAndReleaseHandler,
  cancelReviewRequestHandler,
  getOpenPoolHandler,
  getMyRequestsHandler,
  getReviewByIdHandler
};

// src/modules/codeReview/codeReview.validation.ts
import { z as z11 } from "zod";
var createCodeReviewSchema = z11.object({
  tier: z11.enum(["QUICK", "DEEP"]),
  title: z11.string().min(3, "Title must be at least 3 characters").max(150, "Title must not exceed 150 characters"),
  description: z11.string().min(10, "Description must be at least 10 characters"),
  codeSnippet: z11.string().optional(),
  language: z11.string().optional().default("typescript"),
  githubRepoUrl: z11.string().url("Please provide a valid GitHub repository URL").optional().or(z11.literal("")),
  branchName: z11.string().optional().default("main"),
  specificFiles: z11.string().optional(),
  attachmentUrl: z11.string().url("Please provide a valid attachment URL").optional().or(z11.literal("")),
  attachmentName: z11.string().optional(),
  attachmentSize: z11.number().int().nonnegative().optional()
}).refine(
  (data) => data.codeSnippet && data.codeSnippet.trim().length > 0 || data.githubRepoUrl && data.githubRepoUrl.trim().length > 0 || data.attachmentUrl && data.attachmentUrl.trim().length > 0,
  {
    message: "You must provide either a code snippet, a GitHub repository URL, or a file/diff patch attachment for review.",
    path: ["codeSnippet"]
  }
);
var updateCodeSnippetSchema = z11.object({
  title: z11.string().min(3).max(150).optional(),
  description: z11.string().min(10).optional(),
  codeSnippet: z11.string().optional(),
  language: z11.string().optional(),
  githubRepoUrl: z11.string().url("Please provide a valid GitHub repository URL").optional().or(z11.literal("")),
  branchName: z11.string().optional(),
  specificFiles: z11.string().optional(),
  attachmentUrl: z11.string().url("Please provide a valid attachment URL").optional().or(z11.literal("")),
  attachmentName: z11.string().optional(),
  attachmentSize: z11.number().int().nonnegative().optional()
});
var submitCodeReviewSchema = z11.object({
  summary: z11.string().min(10, "Feedback summary must be at least 10 characters"),
  reviewedCodeSnippet: z11.string().optional(),
  videoUrl: z11.string().url("Please provide a valid video feedback URL (e.g. Loom, Cloudinary)").optional().or(z11.literal("")),
  pullRequestUrl: z11.string().url("Please provide a valid Pull Request URL").optional().or(z11.literal("")),
  attachmentUrl: z11.string().url("Please provide a valid attachment URL").optional().or(z11.literal("")),
  attachmentName: z11.string().optional(),
  comments: z11.array(
    z11.object({
      filePath: z11.string().min(1, "File path is required for comment"),
      lineNumber: z11.number().int().positive("Line number must be positive"),
      commentText: z11.string().min(1, "Comment text cannot be empty"),
      severity: z11.enum(["BUG", "SECURITY", "SUGGESTION"]).optional().default("SUGGESTION")
    })
  ).optional()
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
router11.get("/my-requests", requireRole("student", "admin"), codeReviewController.getMyRequestsHandler);
router11.post(
  "/",
  requireRole("student"),
  validate(codeReviewValidation.createCodeReviewSchema),
  codeReviewController.createReviewRequestHandler
);
router11.get("/:id", codeReviewController.getReviewByIdHandler);
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
import { z as z12 } from "zod";
var createExamSchema = z12.object({
  title: z12.string().min(3, "Exam title must be at least 3 characters long").max(150, "Exam title cannot exceed 150 characters"),
  description: z12.string().nullable().optional(),
  durationMinutes: z12.number().min(1, "Exam duration must be at least 1 minute").max(300, "Exam duration cannot exceed 300 minutes (5 hours)").optional(),
  totalMarks: z12.number().min(1, "Total marks must be at least 1").max(1e3, "Total marks cannot exceed 1000").optional(),
  passMark: z12.number().min(1, "Pass mark percentage must be at least 1%").max(100, "Pass mark percentage cannot exceed 100%").optional(),
  isFree: z12.boolean().optional(),
  cohortId: z12.string().optional(),
  sprintId: z12.string().optional()
});
var questionItemSchema = z12.object({
  id: z12.string().nullable().optional(),
  questionText: z12.string().min(5, "Question text must be at least 5 characters long"),
  options: z12.array(z12.string().min(1, "Option text cannot be empty")).min(2, "Each question must have at least 2 options").max(6, "Each question can have at most 6 options"),
  correctOptionIndex: z12.number().min(0, "Correct option index cannot be negative"),
  explanation: z12.string().nullable().optional(),
  marks: z12.number().min(1, "Question marks must be at least 1").optional()
});
var updateExamSchema = createExamSchema.partial().extend({
  description: z12.string().nullable().optional(),
  cohortId: z12.string().nullable().optional(),
  sprintId: z12.string().nullable().optional(),
  passingMarks: z12.number().min(1, "Passing marks percentage must be at least 1%").max(100, "Passing marks percentage cannot exceed 100%").optional(),
  status: z12.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  questions: z12.array(questionItemSchema).optional()
});
var addQuestionsSchema = z12.object({
  questions: z12.array(questionItemSchema).min(1, "At least 1 question must be provided")
});
var submitExamSchema = z12.object({
  answers: z12.array(
    z12.object({
      questionId: z12.string().min(1, "questionId is required"),
      selectedOption: z12.number().min(0, "selectedOption index cannot be negative")
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
    async (tx) => {
      const results = [];
      for (const q of questions) {
        const item = await tx.question.create({
          data: {
            examId,
            questionText: q.questionText,
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
            explanation: q.explanation || null,
            marks: q.marks || 1
          }
        });
        results.push(item);
      }
      return results;
    },
    {
      maxWait: 1e4,
      timeout: 25e3
    }
  );
  const allQuestions = await prisma.question.findMany({
    where: { examId }
  });
  const totalQuestionsCount = allQuestions.length;
  const computedTotalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);
  const updatedExam = await prisma.exam.update({
    where: { id: examId },
    data: {
      totalQuestions: totalQuestionsCount,
      totalMarks: computedTotalMarks,
      durationMinutes: totalQuestionsCount > 0 ? totalQuestionsCount : exam.durationMinutes
    },
    include: {
      questions: true,
      _count: { select: { questions: true } }
    }
  });
  return {
    addedCount: createdQuestions.length,
    totalQuestions: totalQuestionsCount,
    totalMarks: computedTotalMarks,
    durationMinutes: updatedExam.durationMinutes,
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
var updateExam = async (mentorId, examId, payload, userRole) => {
  const existingExam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: true,
      _count: { select: { attempts: true } }
    }
  });
  if (!existingExam) {
    throw new AppError("Exam not found", 404);
  }
  if (existingExam.mentorId !== mentorId && userRole !== "admin") {
    throw new AppError("You do not have permission to modify this exam", 403);
  }
  if (payload.cohortId) {
    const cohort = await prisma.cohortProgram.findUnique({
      where: { id: payload.cohortId }
    });
    if (!cohort) {
      throw new AppError("Target Cohort Program not found", 404);
    }
    if (cohort.mentorId !== mentorId && userRole !== "admin") {
      throw new AppError("You can only attach exams to your own Cohort Programs", 403);
    }
  }
  if (payload.sprintId) {
    const sprint = await prisma.sprintRequest.findUnique({
      where: { id: payload.sprintId }
    });
    if (!sprint) {
      throw new AppError("Target Sprint Request not found", 404);
    }
  }
  if (payload.questions && Array.isArray(payload.questions)) {
    payload.questions.forEach((q, index) => {
      if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
        throw new AppError(
          `Question ${index + 1}: correctOptionIndex (${q.correctOptionIndex}) is out of bounds for ${q.options.length} options`,
          400
        );
      }
    });
    await prisma.$transaction(
      async (tx) => {
        await tx.question.deleteMany({ where: { examId } });
        for (const q of payload.questions) {
          await tx.question.create({
            data: {
              examId,
              questionText: q.questionText,
              options: q.options,
              correctOptionIndex: q.correctOptionIndex,
              explanation: q.explanation || null,
              marks: q.marks || 1
            }
          });
        }
      },
      {
        maxWait: 1e4,
        timeout: 25e3
      }
    );
  }
  const allQuestions = await prisma.question.findMany({
    where: { examId }
  });
  const totalQuestionsCount = allQuestions.length;
  const computedTotalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);
  const passMarkValue = payload.passMark ?? payload.passingMarks ?? existingExam.passMark;
  const updatedExam = await prisma.exam.update({
    where: { id: examId },
    data: {
      ...payload.title !== void 0 && { title: payload.title },
      ...payload.description !== void 0 && { description: payload.description },
      ...payload.isFree !== void 0 && { isFree: payload.isFree },
      ...payload.cohortId !== void 0 && { cohortId: payload.cohortId },
      ...payload.sprintId !== void 0 && { sprintId: payload.sprintId },
      ...payload.status !== void 0 && { status: payload.status },
      passMark: passMarkValue,
      totalQuestions: totalQuestionsCount,
      totalMarks: payload.totalMarks !== void 0 ? payload.totalMarks : computedTotalMarks,
      durationMinutes: payload.durationMinutes !== void 0 ? payload.durationMinutes : totalQuestionsCount > 0 ? totalQuestionsCount : existingExam.durationMinutes
    },
    include: {
      cohort: { select: { id: true, title: true } },
      sprint: { select: { id: true, title: true } },
      questions: true,
      _count: { select: { questions: true, attempts: true } }
    }
  });
  return updatedExam;
};
var deleteExam = async (mentorId, examId, userRole) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      _count: { select: { attempts: true } }
    }
  });
  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  if (exam.mentorId !== mentorId && userRole !== "admin") {
    throw new AppError("You do not have permission to delete this exam", 403);
  }
  if (exam._count.attempts > 0) {
    const archivedExam = await prisma.exam.update({
      where: { id: examId },
      data: { status: "ARCHIVED" }
    });
    return {
      message: "Exam has recorded student attempts; safely archived and unpublished.",
      archived: true,
      exam: archivedExam
    };
  }
  await prisma.exam.delete({
    where: { id: examId }
  });
  return {
    message: "Exam deleted successfully",
    deleted: true
  };
};
var getExamById = async (examId, userId, userRole) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      mentor: { select: { id: true, name: true, email: true, image: true } },
      cohort: { select: { id: true, title: true } },
      sprint: { select: { id: true, title: true } },
      questions: true,
      _count: { select: { questions: true, attempts: true } }
    }
  });
  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  const isOwnerOrAdmin = userId && exam.mentorId === userId || userRole === "admin";
  if (!isOwnerOrAdmin) {
    return {
      ...exam,
      questions: exam.questions.map((q) => ({
        id: q.id,
        examId: q.examId,
        questionText: q.questionText,
        options: q.options,
        correctOptionIndex: -1,
        explanation: null,
        marks: q.marks
      }))
    };
  }
  return exam;
};
var updateQuestion = async (mentorId, examId, questionId, payload, userRole) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId }
  });
  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  if (exam.mentorId !== mentorId && userRole !== "admin") {
    throw new AppError("You do not have permission to modify questions for this exam", 403);
  }
  const question = await prisma.question.findFirst({
    where: { id: questionId, examId }
  });
  if (!question) {
    throw new AppError("Question not found in this exam", 404);
  }
  const finalOptions = payload.options || question.options;
  const finalCorrectIndex = payload.correctOptionIndex !== void 0 ? payload.correctOptionIndex : question.correctOptionIndex;
  if (finalCorrectIndex < 0 || finalCorrectIndex >= finalOptions.length) {
    throw new AppError(
      `correctOptionIndex (${finalCorrectIndex}) is out of bounds for ${finalOptions.length} options`,
      400
    );
  }
  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      ...payload.questionText && { questionText: payload.questionText },
      ...payload.options && { options: payload.options },
      ...payload.correctOptionIndex !== void 0 && {
        correctOptionIndex: payload.correctOptionIndex
      },
      ...payload.explanation !== void 0 && { explanation: payload.explanation },
      ...payload.marks !== void 0 && { marks: payload.marks }
    }
  });
  const allQuestions = await prisma.question.findMany({ where: { examId } });
  const totalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);
  await prisma.exam.update({
    where: { id: examId },
    data: { totalMarks }
  });
  return updatedQuestion;
};
var deleteQuestion = async (mentorId, examId, questionId, userRole) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId }
  });
  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  if (exam.mentorId !== mentorId && userRole !== "admin") {
    throw new AppError("You do not have permission to delete questions from this exam", 403);
  }
  const question = await prisma.question.findFirst({
    where: { id: questionId, examId }
  });
  if (!question) {
    throw new AppError("Question not found in this exam", 404);
  }
  await prisma.question.delete({
    where: { id: questionId }
  });
  const remainingQuestions = await prisma.question.findMany({ where: { examId } });
  const totalQuestions = remainingQuestions.length;
  const totalMarks = remainingQuestions.reduce((sum, q) => sum + q.marks, 0);
  await prisma.exam.update({
    where: { id: examId },
    data: {
      totalQuestions,
      totalMarks,
      durationMinutes: totalQuestions > 0 ? totalQuestions : exam.durationMinutes
    }
  });
  return { message: "Question deleted successfully", totalQuestions, totalMarks };
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
var getAvailableExams = async (studentId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [cohortEnrollments, sprintRequests] = await Promise.all([
    prisma.cohortEnrollment.findMany({
      where: { studentId },
      select: { cohortId: true }
    }),
    prisma.sprintRequest.findMany({
      where: { studentId },
      select: { id: true }
    })
  ]);
  const cohortIds = cohortEnrollments.map((c) => c.cohortId);
  const sprintIds = sprintRequests.map((s) => s.id);
  const whereClause = {
    status: "PUBLISHED",
    OR: [
      { isFree: true },
      { cohortId: { in: cohortIds } },
      { sprintId: { in: sprintIds } }
    ]
  };
  const [exams, total] = await Promise.all([
    prisma.exam.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        mentor: { select: { id: true, name: true, image: true } },
        cohort: { select: { id: true, title: true } },
        sprint: { select: { id: true, title: true } },
        _count: { select: { questions: true } }
      }
    }),
    prisma.exam.count({ where: whereClause })
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
var startExamAttempt = async (studentId, examId) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      mentor: { select: { id: true, name: true } },
      questions: {
        select: {
          id: true,
          questionText: true,
          options: true,
          marks: true
        }
      }
    }
  });
  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  if (exam.status !== "PUBLISHED") {
    throw new AppError("This exam is not currently active or published", 400);
  }
  if (!exam.isFree) {
    let isEligible = false;
    if (exam.cohortId) {
      const enrollment = await prisma.cohortEnrollment.findUnique({
        where: {
          cohortId_studentId: { cohortId: exam.cohortId, studentId }
        }
      });
      if (enrollment) isEligible = true;
    }
    if (exam.sprintId) {
      const sprint = await prisma.sprintRequest.findFirst({
        where: { id: exam.sprintId, studentId }
      });
      if (sprint) isEligible = true;
    }
    if (!isEligible) {
      throw new AppError(
        "You are not enrolled in the Cohort or Sprint required to take this exam",
        403
      );
    }
  }
  const attempt = await prisma.examAttempt.create({
    data: {
      examId,
      studentId,
      startedAt: /* @__PURE__ */ new Date(),
      answers: []
    }
  });
  return {
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      passMark: exam.passMark,
      mentor: exam.mentor,
      questions: exam.questions
    }
  };
};
var submitExamAttempt = async (studentId, examId, submittedAnswers) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: true
    }
  });
  if (!exam) {
    throw new AppError("Exam not found", 404);
  }
  const attempt = await prisma.examAttempt.findFirst({
    where: { examId, studentId, submittedAt: null },
    orderBy: { startedAt: "desc" }
  });
  let totalEarnedScore = 0;
  const answerBreakdown = exam.questions.map((q) => {
    const studentAns = submittedAnswers.find((a) => a.questionId === q.id);
    const selectedOption = studentAns ? studentAns.selectedOption : -1;
    const isCorrect = selectedOption === q.correctOptionIndex;
    if (isCorrect) {
      totalEarnedScore += q.marks;
    }
    return {
      questionId: q.id,
      questionText: q.questionText,
      options: q.options,
      selectedOption,
      correctOptionIndex: q.correctOptionIndex,
      isCorrect,
      marksEarned: isCorrect ? q.marks : 0,
      totalMarks: q.marks,
      explanation: q.explanation
    };
  });
  const passMark = exam.passMark ?? 70;
  const percentage = Math.round(totalEarnedScore / exam.totalMarks * 100 * 100) / 100;
  const isPassed = percentage >= passMark;
  let updatedAttempt;
  if (attempt) {
    updatedAttempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        score: totalEarnedScore,
        percentage,
        isPassed,
        submittedAt: /* @__PURE__ */ new Date(),
        answers: answerBreakdown
      }
    });
  } else {
    updatedAttempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        score: totalEarnedScore,
        percentage,
        isPassed,
        startedAt: /* @__PURE__ */ new Date(),
        submittedAt: /* @__PURE__ */ new Date(),
        answers: answerBreakdown
      }
    });
  }
  return {
    attemptId: updatedAttempt.id,
    score: totalEarnedScore,
    totalMarks: exam.totalMarks,
    percentage,
    passMark: exam.passMark,
    isPassed,
    submittedAt: updatedAttempt.submittedAt,
    breakdown: answerBreakdown
  };
};
var getStudentAttempts = async (studentId, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [attempts, total] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { studentId },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            passMark: true,
            mentor: { select: { name: true } }
          }
        }
      }
    }),
    prisma.examAttempt.count({ where: { studentId } })
  ]);
  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    data: attempts
  };
};
var examService = {
  createExam,
  addQuestionsToExam,
  publishExam,
  updateExam,
  deleteExam,
  getExamById,
  updateQuestion,
  deleteQuestion,
  getMentorExams,
  getAvailableExams,
  startExamAttempt,
  submitExamAttempt,
  getStudentAttempts
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
var getAvailableExamsController = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await examService.getAvailableExams(studentId, page, limit);
  sendSuccess(res, "Available exams fetched successfully", result);
});
var startExamAttemptController = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { examId } = req.params;
  const result = await examService.startExamAttempt(studentId, examId);
  sendSuccess(res, "Exam attempt started successfully. Good luck!", result);
});
var submitExamAttemptController = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const { examId } = req.params;
  const { answers } = req.body;
  const result = await examService.submitExamAttempt(studentId, examId, answers);
  sendSuccess(res, "Exam submitted and evaluated successfully", result);
});
var getStudentAttemptsController = catchAsync(async (req, res) => {
  const studentId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await examService.getStudentAttempts(studentId, page, limit);
  sendSuccess(res, "Student exam attempts fetched successfully", result);
});
var updateExamController = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const userRole = req.user.role;
  const { examId } = req.params;
  const result = await examService.updateExam(mentorId, examId, req.body, userRole);
  sendSuccess(res, "Exam updated successfully", result);
});
var deleteExamController = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const userRole = req.user.role;
  const { examId } = req.params;
  const result = await examService.deleteExam(mentorId, examId, userRole);
  sendSuccess(res, result.message, result);
});
var getExamByIdController = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { examId } = req.params;
  const result = await examService.getExamById(examId, userId, userRole);
  sendSuccess(res, "Exam details fetched successfully", result);
});
var updateQuestionController = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const userRole = req.user.role;
  const { examId, questionId } = req.params;
  const result = await examService.updateQuestion(
    mentorId,
    examId,
    questionId,
    req.body,
    userRole
  );
  sendSuccess(res, "Question updated successfully", result);
});
var deleteQuestionController = catchAsync(async (req, res) => {
  const mentorId = req.user.id;
  const userRole = req.user.role;
  const { examId, questionId } = req.params;
  const result = await examService.deleteQuestion(
    mentorId,
    examId,
    questionId,
    userRole
  );
  sendSuccess(res, result.message, result);
});
var examController = {
  createExamController,
  addQuestionsController,
  publishExamController,
  updateExamController,
  deleteExamController,
  getExamByIdController,
  updateQuestionController,
  deleteQuestionController,
  getMentorExamsController,
  getAvailableExamsController,
  startExamAttemptController,
  submitExamAttemptController,
  getStudentAttemptsController
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
router12.get(
  "/mentor/my-exams",
  requireAuth,
  requireRole("mentor"),
  examController.getMentorExamsController
);
router12.post(
  "/:examId/questions",
  requireAuth,
  requireRole("mentor"),
  validate(addQuestionsSchema),
  examController.addQuestionsController
);
router12.patch(
  "/:examId/questions/:questionId",
  requireAuth,
  requireRole("mentor", "admin"),
  examController.updateQuestionController
);
router12.delete(
  "/:examId/questions/:questionId",
  requireAuth,
  requireRole("mentor", "admin"),
  examController.deleteQuestionController
);
router12.patch(
  "/:examId/publish",
  requireAuth,
  requireRole("mentor"),
  examController.publishExamController
);
router12.patch(
  "/:examId",
  requireAuth,
  requireRole("mentor", "admin"),
  validate(updateExamSchema),
  examController.updateExamController
);
router12.delete(
  "/:examId",
  requireAuth,
  requireRole("mentor", "admin"),
  examController.deleteExamController
);
router12.get(
  "/:examId",
  requireAuth,
  examController.getExamByIdController
);
router12.get(
  "/",
  requireAuth,
  requireRole("student"),
  examController.getAvailableExamsController
);
router12.get(
  "/me/attempts",
  requireAuth,
  requireRole("student"),
  examController.getStudentAttemptsController
);
router12.get(
  "/:examId/start",
  requireAuth,
  requireRole("student"),
  examController.startExamAttemptController
);
router12.post(
  "/:examId/submit",
  requireAuth,
  requireRole("student"),
  validate(submitExamSchema),
  examController.submitExamAttemptController
);
var examRoutes = router12;

// src/modules/payout/payout.routes.ts
import { Router as Router13 } from "express";
var router13 = Router13();
router13.post(
  "/",
  requireAuth,
  requireRole("mentor", "admin"),
  validate(createPayoutRequestSchema),
  payoutController.createPayoutRequestHandler
);
router13.get(
  "/my",
  requireAuth,
  requireRole("mentor", "admin"),
  payoutController.getMyPayoutRequestsHandler
);
router13.get(
  "/admin",
  requireAuth,
  requireRole("admin"),
  payoutController.getAdminPayoutsHandler
);
router13.patch(
  "/admin/:id/process",
  requireAuth,
  requireRole("admin"),
  validate(processPayoutSchema),
  payoutController.processPayoutRequestHandler
);
var payout_routes_default = router13;

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
      console.log(`Cron Job: Auto-expired ${result.count} abandoned payment intent(s).`);
    }
  } catch (err) {
    console.error("Error running expireAbandonedPayments cron job:", err);
  }
};
var expireCodeReviewPreviewLocks = async () => {
  try {
    const result = await cleanExpiredPreviewLocks();
    if (result.count > 0) {
      console.log(`Cron Job: Auto-released ${result.count} expired code review preview lock(s).`);
    }
  } catch (err) {
    console.error("Error running expireCodeReviewPreviewLocks cron job:", err);
  }
};
var initCronJobs = () => {
  cron.schedule("*/1 * * * *", async () => {
    await expireCodeReviewPreviewLocks();
  });
  cron.schedule("*/5 * * * *", async () => {
    await expireAbandonedPayments();
  });
  console.log("Background Cron Worker initialized (Running preview lock checks every 1 min & payment cleanup every 5 min).");
};

// src/routes/v1/index.ts
var v1Router = Router14();
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
v1Router.use("/uploads", upload_routes_default);
v1Router.use("/admin", admin_routes_default);
v1Router.use("/payments", paymentRoutes);
v1Router.use("/code-reviews", codeReview_routes_default);
v1Router.use("/exams", examRoutes);
v1Router.use("/payouts", payout_routes_default);
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
    /^\/api\/v1\/payments\/bkash\/callback(?:\/.*)?$/,
    /^\/api\/v1\/payment\/bkash\/callback(?:\/.*)?$/,
    /^\/api\/v1\/payments?\/callback(?:\/.*)?$/,
    /^\/api\/v1\/payments?\/status(?:\/.*)?$/,
    /^\/payments?\/status(?:\/.*)?$/,
    /^\/payments?\/callback(?:\/.*)?$/
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
  console.log("Database connected successfully");
}
async function disconnectDB() {
  await prisma.$disconnect();
  console.log("Database disconnected");
}

// src/server.ts
async function bootstrap() {
  await connectDB();
  initCronJobs();
  const server = app_default.listen(env.PORT, () => {
    console.log(
      `\u2705  DevMentor Server running in ${env.NODE_ENV} mode on port ${env.PORT}`
    );
    console.log(`\u{1F517}  ${env.BETTER_AUTH_URL}/api/v1/health`);
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