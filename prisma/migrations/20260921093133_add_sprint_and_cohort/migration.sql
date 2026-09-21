-- CreateEnum
CREATE TYPE "CohortApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CohortSessionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PENDING_CLAIM', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SprintSessionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "cohort_program" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "techStackTags" TEXT[],
    "approvalStatus" "CohortApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "status" "CohortStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cohort_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_enrollment" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_session" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "creditCost" INTEGER NOT NULL,
    "status" "CohortSessionStatus" NOT NULL DEFAULT 'PENDING',
    "joinLink" TEXT,
    "resources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohort_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_session_participant" (
    "id" TEXT NOT NULL,
    "cohortSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_session_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_request" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "selectedDays" INTEGER[],
    "status" "SprintStatus" NOT NULL DEFAULT 'PENDING_CLAIM',
    "claimedByMentorId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sprint_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_session" (
    "id" TEXT NOT NULL,
    "sprintRequestId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "creditCost" INTEGER NOT NULL DEFAULT 0,
    "status" "SprintSessionStatus" NOT NULL DEFAULT 'PENDING',
    "joinLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cohort_enrollment_cohortId_studentId_key" ON "cohort_enrollment"("cohortId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_session_participant_cohortSessionId_studentId_key" ON "cohort_session_participant"("cohortSessionId", "studentId");

-- AddForeignKey
ALTER TABLE "cohort_program" ADD CONSTRAINT "cohort_program_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_enrollment" ADD CONSTRAINT "cohort_enrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohort_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_enrollment" ADD CONSTRAINT "cohort_enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_session" ADD CONSTRAINT "cohort_session_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "cohort_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_session_participant" ADD CONSTRAINT "cohort_session_participant_cohortSessionId_fkey" FOREIGN KEY ("cohortSessionId") REFERENCES "cohort_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_session_participant" ADD CONSTRAINT "cohort_session_participant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_request" ADD CONSTRAINT "sprint_request_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_request" ADD CONSTRAINT "sprint_request_claimedByMentorId_fkey" FOREIGN KEY ("claimedByMentorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_session" ADD CONSTRAINT "sprint_session_sprintRequestId_fkey" FOREIGN KEY ("sprintRequestId") REFERENCES "sprint_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
