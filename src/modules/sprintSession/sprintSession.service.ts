import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import { getTreasuryWallet } from "../payout/payout.service.js";
import type { IScheduleSprintSessionInput } from "./sprintSession.interface.js";

// 1. Propose Session Time Slot
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

  const [conflictingSprintSessions, conflictingCohortSessions] = await Promise.all([
    prisma.sprintSession.findMany({
      where: {
        id: { not: sessionId },
        status: { in: ["PENDING", "CONFIRMED"] },
        sprintRequest: {
          claimedByMentorId: mentorId,
          deletedAt: null,
        },
        scheduledAt: { not: null },
      },
    }),
    prisma.cohortSession.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        cohort: {
          mentorId,
          deletedAt: null,
        },
      },
    }),
  ]);

  const hasSprintConflict = conflictingSprintSessions.some((s) => {
    if (!s.scheduledAt) return false;
    const sStart = new Date(s.scheduledAt);
    const sEnd = new Date(sStart.getTime() + s.durationMinutes * 60 * 1000);
    return proposedScheduledAt < sEnd && proposedEndAt > sStart;
  });

  const hasCohortConflict = conflictingCohortSessions.some((s) => {
    if (!s.scheduledAt) return false;
    const sStart = new Date(s.scheduledAt);
    const sEnd = new Date(sStart.getTime() + s.durationMinutes * 60 * 1000);
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

// 2. Student Confirms Session Slot & Deducts Credit
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

  const platformSetting = await prisma.platformSetting.findFirst();
  const sprintCreditCost = platformSetting?.sprintCreditPerSession || 50;

  const studentWallet = await prisma.wallet.findUnique({
    where: { userId: studentId },
  });

  if (!studentWallet || studentWallet.balance < sprintCreditCost) {
    throw new AppError(
      `Insufficient wallet balance. You need at least ${sprintCreditCost} credits to confirm this session (your available balance: ${studentWallet?.balance || 0} credits). Please top up your wallet via bKash.`,
      400
    );
  }

  const confirmedSession = await prisma.$transaction(async (tx) => {
    // 1. Deduct credits from student wallet
    const updatedStudentWallet = await tx.wallet.update({
      where: { userId: studentId },
      data: {
        balance: { decrement: sprintCreditCost },
      },
    });

    // 2. Log SPRINT_ESCROW CreditTransaction
    await tx.creditTransaction.create({
      data: {
        walletId: updatedStudentWallet.id,
        amount: -sprintCreditCost,
        type: "SPRINT_ESCROW",
        description: `Escrow hold for Day ${session.dayNumber} sprint session: ${session.sprintRequest.title}`,
        referenceId: session.id,
      },
    });

    // 3. Update session to CONFIRMED
    return await tx.sprintSession.update({
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
  });

  return {
    message: `Session confirmed successfully. ${sprintCreditCost} credits reserved in escrow.`,
    session: confirmedSession,
  };
};

// 3. Complete Session & Release Credit to Mentor + Platform Commission to Treasury
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
    // 1. Credit Mentor Net Earnings
    if (mentorNetEarnings > 0) {
      const mentorWallet = await tx.wallet.upsert({
        where: { userId: claimedByMentorId },
        create: {
          userId: claimedByMentorId,
          balance: mentorNetEarnings,
          totalEarned: mentorNetEarnings,
          totalWithdrawn: 0,
        },
        update: {
          balance: { increment: mentorNetEarnings },
          totalEarned: { increment: mentorNetEarnings },
        },
      });

      await tx.creditTransaction.create({
        data: {
          walletId: mentorWallet.id,
          amount: mentorNetEarnings,
          type: "SPRINT_RELEASE",
          description: `Payment released for completed sprint session (Day ${session.dayNumber}): ${session.sprintRequest.title} (Net after ${commissionPercent}% platform cut)`,
          referenceId: session.id,
        },
      });
    }

    // 2. Deposit Platform Commission Cut into Treasury Wallet
    if (platformCommissionAmount > 0) {
      try {
        const treasuryWallet = await getTreasuryWallet(tx);
        await tx.wallet.update({
          where: { id: treasuryWallet.id },
          data: {
            balance: { increment: platformCommissionAmount },
            totalEarned: { increment: platformCommissionAmount },
          },
        });

        await tx.creditTransaction.create({
          data: {
            walletId: treasuryWallet.id,
            amount: platformCommissionAmount,
            type: "PLATFORM_COMMISSION",
            description: `Platform fee (${commissionPercent}%) earned from completed sprint session (Day ${session.dayNumber}): ${session.sprintRequest.title}`,
            referenceId: session.id,
          },
        });
      } catch (err) {
        console.error("Warning: Failed to credit platform treasury wallet:", err);
      }
    }

    // 3. Mark session COMPLETED
    return await tx.sprintSession.update({
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
  });

  return {
    message: `Session marked as completed. Released ${mentorNetEarnings} credits to mentor (Platform cut: ${platformCommissionAmount} credits).`,
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

    if (hoursRemaining >= 1) {
      isEligibleForRefund = true;
    }

    if (userId === claimedByMentorId) {
      isEligibleForRefund = true;
    }
  }

  const refundAmount = session.creditCost || 50;

  const cancelledSession = await prisma.$transaction(async (tx) => {
    // If confirmed and eligible for refund, return credits to student wallet
    if (session.status === "CONFIRMED" && isEligibleForRefund) {
      const studentWallet = await tx.wallet.findUnique({
        where: { userId: studentId },
      });

      if (studentWallet) {
        await tx.wallet.update({
          where: { id: studentWallet.id },
          data: {
            balance: { increment: refundAmount },
          },
        });

        await tx.creditTransaction.create({
          data: {
            walletId: studentWallet.id,
            amount: refundAmount,
            type: "SPRINT_REFUND",
            description: `Full refund for cancelled sprint session (Day ${session.dayNumber}): ${session.sprintRequest.title}`,
            referenceId: session.id,
          },
        });
      }
    }

    return await tx.sprintSession.update({
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
  });

  return {
    message: isEligibleForRefund
      ? `Session cancelled successfully. Full refund of ${refundAmount} credits issued to student.`
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

export const sprintSessionService = {
  proposeSprintSessionSlot,
  confirmSprintSession,
  completeSprintSession,
  cancelSprintSession,
  getSprintSessionsBySprintId,
};
