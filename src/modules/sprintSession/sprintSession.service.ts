import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type { IScheduleSprintSessionInput } from "./sprintSession.interface.js";

// 1. Propose Session Time Slot (Mentor Only)
const proposeSprintSessionSlot = async (
  sessionId: string,
  mentorId: string,
  payload: IScheduleSprintSessionInput
) => {
  const session = await prisma.sprintSession.findUnique({
    where: { id: sessionId },
    include: { sprintRequest: true },
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
  const proposedEndAt = new Date(proposedScheduledAt.getTime() + durationMinutes * 60 * 1000);

  // Mentor Overlap Conflict Guard
  const conflictingSessions = await prisma.sprintSession.findMany({
    where: {
      id: { not: sessionId },
      status: "CONFIRMED",
      sprintRequest: {
        claimedByMentorId: mentorId,
        deletedAt: null,
      },
      scheduledAt: { not: null },
    },
  });

  const hasConflict = conflictingSessions.some((s) => {
    if (!s.scheduledAt) return false;
    const sStart = new Date(s.scheduledAt);
    const sEnd = new Date(sStart.getTime() + s.durationMinutes * 60 * 1000);
    return proposedScheduledAt < sEnd && proposedEndAt > sStart;
  });

  if (hasConflict) {
    throw new AppError("You already have another confirmed session scheduled at this overlapping time slot", 409);
  }

  const updatedSession = await prisma.sprintSession.update({
    where: { id: sessionId },
    data: {
      scheduledAt: proposedScheduledAt,
      durationMinutes,
      joinLink: payload.joinLink || session.joinLink,
      status: "PENDING", 
    },
    include: {
      sprintRequest: {
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          claimedByMentor: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  return updatedSession;
};

// 2. Student Confirms Session Slot & Deducts Credit (Student Only)
const confirmSprintSession = async (sessionId: string, studentId: string) => {
  const session = await prisma.sprintSession.findUnique({
    where: { id: sessionId },
    include: { sprintRequest: true },
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

  // Credit Deduction logic (wallet integration placeholder & validation)
  // Fetch global sprintCreditPerSession setting (default 50)
  const platformSetting = await (prisma as any).platformSetting?.findFirst();
  const sprintCreditCost = platformSetting?.sprintCreditPerSession || 50;

  // Update session status to CONFIRMED
  const confirmedSession = await prisma.sprintSession.update({
    where: { id: sessionId },
    data: {
      creditCost: sprintCreditCost,
      status: "CONFIRMED",
    },
    include: {
      sprintRequest: {
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          claimedByMentor: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  return {
    message: `Session confirmed successfully. ${sprintCreditCost} credits reserved in escrow.`,
    session: confirmedSession,
  };
};

// 3. Complete Session & Release Credit to Mentor (Mentor or Student)
const completeSprintSession = async (sessionId: string, userId: string) => {
  const session = await prisma.sprintSession.findUnique({
    where: { id: sessionId },
    include: { sprintRequest: true },
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
      status: "COMPLETED",
    },
    include: {
      sprintRequest: {
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          claimedByMentor: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  return {
    message: "Session marked as completed. Credits released to mentor.",
    session: completedSession,
  };
};

// 4. Cancel Session & Apply 1-Hour Refund Rule
const cancelSprintSession = async (sessionId: string, userId: string) => {
  const session = await prisma.sprintSession.findUnique({
    where: { id: sessionId },
    include: { sprintRequest: true },
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
    const now = new Date();
    const timeDiffMs = new Date(session.scheduledAt).getTime() - now.getTime();
    const hoursRemaining = timeDiffMs / (1000 * 60 * 60);

    // Eligible for full credit refund if cancelled > 1 hour before scheduled time
    if (hoursRemaining >= 1) {
      isEligibleForRefund = true;
    }

    // Eligible if mentor cancelled 
    if( userId === claimedByMentorId){
        isEligibleForRefund = true;
    }
  }

  const cancelledSession = await prisma.sprintSession.update({
    where: { id: sessionId },
    data: {
      status: "CANCELLED",
    },
    include: {
      sprintRequest: {
        include: {
          student: { select: { id: true, name: true, email: true, image: true } },
          claimedByMentor: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  return {
    message: isEligibleForRefund
      ? "Session cancelled successfully. Full credit refund issued to student."
      : "Session cancelled within 1 hour of scheduled time. No credit refund issued.",
    refundIssued: isEligibleForRefund,
    session: cancelledSession,
  };
};

// 5. Get Sessions for a Sprint Request
const getSprintSessionsBySprintId = async (sprintRequestId: string) => {
  const sessions = await prisma.sprintSession.findMany({
    where: { sprintRequestId },
    orderBy: { dayNumber: "asc" },
  });

  return sessions;
};

// Export Service Object
export const sprintSessionService = {
  proposeSprintSessionSlot,
  confirmSprintSession,
  completeSprintSession,
  cancelSprintSession,
  getSprintSessionsBySprintId,
};
