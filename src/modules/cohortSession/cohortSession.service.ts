import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import { getTreasuryWallet } from "../payout/payout.service.js";
import type {
  ICohortResourceItem,
  ICreateCohortSessionInput,
  IUpdateCohortSessionInput,
} from "./cohortSession.interface.js";

// 1. Add Cohort Session (Mentor Only)
const addCohortSession = async (
  cohortId: string,
  mentorId: string,
  payload: ICreateCohortSessionInput,
) => {
  const cohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null },
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
    resources,
  } = payload;

  const formattedResources = Array.isArray(resources)
    ? resources.map((item, idx) => ({
      id: item.id || `res_${Date.now()}_${idx}`,
      title: item.title,
      type: item.type,
      url: item.url || null,
      publicId: item.publicId || null,
      fileSize: item.fileSize || null,
      fileType: item.fileType || null,
      content: item.content || null,
      createdAt: item.createdAt || new Date().toISOString(),
    }))
    : [];

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
      status: "PENDING",
    },
  });

  return session;
};

// 2. Get Cohort Sessions (with Gated Access Protection)
const getCohortSessions = async (cohortId: string, userId?: string) => {
  const cohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null },
  });

  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }

  const isMentor = userId ? cohort.mentorId === userId : false;

  const sessions = await prisma.cohortSession.findMany({
    where: { cohortId },
    orderBy: { sessionNumber: "asc" },
    include: {
      participants: userId
        ? {
          where: { studentId: userId },
          select: { paid: true, joinedAt: true },
        }
        : false,
    },
  });

  const processedSessions = sessions.map((session: any) => {
    const isPaidParticipant =
      Array.isArray(session.participants) && session.participants.length > 0 && session.participants[0].paid;

    const hasAccess = isMentor || isPaidParticipant || session.creditCost === 0;

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
      recordingUrl: hasAccess ? session.recordingUrl : null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  });

  return processedSessions;
};

// 3. Update Cohort Session (Mentor Only)
const updateCohortSession = async (
  sessionId: string,
  mentorId: string,
  payload: IUpdateCohortSessionInput,
) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true },
  });

  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }

  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to update this cohort session", 403);
  }

  const dataToUpdate: any = { ...payload };

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
      createdAt: item.createdAt || new Date().toISOString(),
    }));
  }

  const updatedSession = await prisma.cohortSession.update({
    where: { id: sessionId },
    data: dataToUpdate,
  });

  return updatedSession;
};

//  4. Delete Cohort Session (Mentor Only)
const deleteCohortSession = async (sessionId: string, mentorId: string) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true },
  });

  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }

  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to delete this cohort session", 403);
  }

  await prisma.cohortSession.delete({
    where: { id: sessionId },
  });

  return { message: "Cohort session deleted successfully" };
};

// 5. Add Single Resource to Cohort Session (Mentor Only)
const addSessionResource = async (
  sessionId: string,
  mentorId: string,
  resource: ICohortResourceItem,
) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true },
  });

  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }

  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to modify resources for this session", 403);
  }

  const existingResources = Array.isArray(session.resources) ? (session.resources as any[]) : [];

  const newResourceItem = {
    id: resource.id || `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: resource.title,
    type: resource.type,
    url: resource.url || null,
    publicId: resource.publicId || null,
    fileSize: resource.fileSize || null,
    fileType: resource.fileType || null,
    content: resource.content || null,
    createdAt: new Date().toISOString(),
  };

  const updatedResources = [...existingResources, newResourceItem];

  const updatedSession = await prisma.cohortSession.update({
    where: { id: sessionId },
    data: {
      resources: updatedResources,
    },
  });

  return updatedSession;
};

// 6. Remove Single Resource from Cohort Session (Mentor Only)
const removeSessionResource = async (
  sessionId: string,
  mentorId: string,
  resourceId: string,
) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true },
  });

  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }

  if (session.cohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to modify resources for this session", 403);
  }

  const existingResources = Array.isArray(session.resources) ? (session.resources as any[]) : [];

  const updatedResources = existingResources.filter((item: any) => item.id !== resourceId);

  const updatedSession = await prisma.cohortSession.update({
    where: { id: sessionId },
    data: {
      resources: updatedResources,
    },
  });

  return { message: "Resource removed successfully", resources: updatedSession.resources };
};

// 7. Join Cohort Session (Student Only)
const joinCohortSession = async (sessionId: string, studentId: string) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true },
  });

  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }

  const enrollment = await prisma.cohortEnrollment.findUnique({
    where: {
      cohortId_studentId: {
        cohortId: session.cohortId,
        studentId,
      },
    },
  });

  if (!enrollment) {
    throw new AppError("You must register/enroll in the cohort program before joining its sessions", 400);
  }

  const existingParticipant = await prisma.cohortSessionParticipant.findUnique({
    where: {
      cohortSessionId_studentId: {
        cohortSessionId: sessionId,
        studentId,
      },
    },
  });

  if (existingParticipant && existingParticipant.paid) {
    throw new AppError("You have already joined and paid for this cohort session", 400);
  }

  const studentWallet = await (prisma as any).wallet?.findUnique({
    where: { userId: studentId },
  });

  if (studentWallet && studentWallet.balance < session.creditCost) {
    throw new AppError(
      `Insufficient credit balance (${studentWallet.balance} credits). Required: ${session.creditCost} credits.`,
      400,
    );
  }

  const result = await prisma.$transaction(async (tx: any) => {
    let remainingBalance = studentWallet?.balance || 0;

    if (tx.wallet) {
      const updatedStudentWallet = await tx.wallet.update({
        where: { userId: studentId },
        data: { balance: { decrement: session.creditCost } },
      });
      remainingBalance = updatedStudentWallet.balance;

      await tx.creditTransaction.create({
        data: {
          walletId: updatedStudentWallet.id,
          amount: -session.creditCost,
          type: "COHORT_FEE",
          description: `Escrow hold for cohort session: ${session.title}`,
          referenceId: session.id,
        },
      });
    }

    const participant = await tx.cohortSessionParticipant.upsert({
      where: {
        cohortSessionId_studentId: {
          cohortSessionId: sessionId,
          studentId,
        },
      },
      create: {
        cohortSessionId: sessionId,
        studentId,
        paid: true,
      },
      update: {
        paid: true,
      },
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
      resources: session.resources,
    },
  };
};

// 8. Complete Cohort Session (Mentor Only)
const completeCohortSession = async (sessionId: string, mentorId: string) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: {
      cohort: true,
      participants: { where: { paid: true } },
    },
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

  const now = new Date();
  const sessionStart = new Date(session.scheduledAt);
  const sessionEnd = new Date(sessionStart.getTime() + session.durationMinutes * 60 * 1000);

  if (now < sessionEnd) {
    throw new AppError(
      `Cannot mark session as completed before it has ended. Scheduled end time is: ${sessionEnd.toISOString()}`,
      400,
    );
  }

  const totalPaidParticipants = session.participants.length;
  const totalEscrowCollected = session.creditCost * totalPaidParticipants;
  const platformSetting = await prisma.platformSetting.findFirst();
  const commissionPercent = platformSetting?.sessionCommissionPercent ?? 15;
  const platformFeeRate = commissionPercent / 100;
  const platformCommissionAmount = Math.round(totalEscrowCollected * platformFeeRate);
  const mentorNetEarnings = totalEscrowCollected - platformCommissionAmount;

  const updatedSession = await prisma.$transaction(async (tx: any) => {
    // 1. Release Net Earnings to Mentor
    if (mentorNetEarnings > 0) {
      const mentorWallet = await tx.wallet.upsert({
        where: { userId: mentorId },
        create: {
          userId: mentorId,
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
          type: "COHORT_RELEASE",
          description: `Escrow release for completed cohort session (${totalPaidParticipants} participants): ${session.title} (Net after ${commissionPercent}% platform cut)`,
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
            description: `Platform fee (${commissionPercent}%) earned from completed cohort session: ${session.title}`,
            referenceId: session.id,
          },
        });
      } catch (err) {
        console.error("Warning: Failed to credit platform treasury wallet:", err);
      }
    }

    return await tx.cohortSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED" },
    });
  });

  return {
    message: `Cohort session completed successfully! Released ${mentorNetEarnings} credits to mentor's wallet.`,
    session: updatedSession,
  };
};

// 9. Cancel Cohort Session (Mentor Only)
const cancelCohortSession = async (sessionId: string, mentorId: string) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: {
      cohort: true,
      participants: { where: { paid: true } },
    },
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

  await prisma.$transaction(async (tx: any) => {
    await tx.cohortSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED" },
    });

    if (tx.wallet) {
      for (const participant of session.participants) {
        const studentWallet = await tx.wallet.update({
          where: { userId: participant.studentId },
          data: { balance: { increment: session.creditCost } },
        });

        await tx.creditTransaction.create({
          data: {
            walletId: studentWallet.id,
            amount: session.creditCost,
            type: "SPRINT_REFUND",
            description: `Escrow refund for cancelled cohort session: ${session.title}`,
            referenceId: session.id,
          },
        });
      }
    }
  });

  return { message: "Cohort session cancelled and escrow credits refunded to all participants successfully" };
};



export const cohortSessionService = {
  addCohortSession,
  getCohortSessions,
  updateCohortSession,
  deleteCohortSession,
  addSessionResource,
  removeSessionResource,
  joinCohortSession,
  completeCohortSession,
  cancelCohortSession,
};



