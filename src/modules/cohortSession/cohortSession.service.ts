/**
 * @file src/modules/cohortSession/cohortSession.service.ts
 * @description Service layer for Cohort Group Sessions & embedded resources.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
  ICohortResourceItem,
  ICreateCohortSessionInput,
  IUpdateCohortSessionInput,
} from "./cohortSession.interface.js";

/**
 * 1. Add Cohort Session (Mentor Only)
 * - Verifies mentor ownership of the cohort program.
 * - Creates session with custom creditCost, scheduledAt, and embedded resources.
 */
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

  const {
    sessionNumber,
    dayNumber,
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
      creditCost,
      joinLink: joinLink || null,
      resources: formattedResources,
      status: "PENDING",
    },
  });

  return session;
};

/**
 * 2. Get Cohort Sessions (with Gated Access Protection)
 * - Unpaid/guest users see session titles and schedule, but joinLink & resources are redacted (null).
 * - Cohort Mentor & Paid Participants receive full unredacted data.
 */
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

  // Apply Gated Access Control
  const processedSessions = sessions.map((session: any) => {
    const isPaidParticipant =
      Array.isArray(session.participants) && session.participants.length > 0 && session.participants[0].paid;

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
      updatedAt: session.updatedAt,
    };
  });

  return processedSessions;
};

/**
 * 3. Update Cohort Session (Mentor Only)
 * - Verifies mentor ownership of underlying cohort.
 */
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

/**
 * 4. Delete Cohort Session (Mentor Only)
 */
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

/**
 * 5. Add Single Resource to Cohort Session (Mentor Only)
 * - Appends a Cloudinary PDF, external link, note, or code snippet to existing session.resources.
 */
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

/**
 * 6. Remove Single Resource from Cohort Session (Mentor Only)
 * - Filters out target resource by resourceId from session.resources JSON array.
 */
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

/**
 * 7. Join Cohort Session (Student Only)
 * - Checks enrollment, verifies student credit balance, deducts session creditCost into Escrow.
 * - Does NOT credit mentor yet; credits remain in escrow until session completion.
 */
const joinCohortSession = async (sessionId: string, studentId: string) => {
  const session = await prisma.cohortSession.findUnique({
    where: { id: sessionId },
    include: { cohort: true },
  });

  if (!session || session.cohort.deletedAt !== null) {
    throw new AppError("Cohort session not found", 404);
  }

  // 1. Check student enrollment in cohort program
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

  // 2. Check if student already joined
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

  // 3. Check student wallet credit balance
  const studentWallet = await (prisma as any).wallet?.findUnique({
    where: { userId: studentId },
  });

  if (studentWallet && studentWallet.balance < session.creditCost) {
    throw new AppError(
      `Insufficient credit balance (${studentWallet.balance} credits). Required: ${session.creditCost} credits.`,
      400,
    );
  }

  // 4. Transaction: Deduct student wallet into Escrow & create CohortSessionParticipant record
  const result = await prisma.$transaction(async (tx: any) => {
    let remainingBalance = studentWallet?.balance || 0;

    if (tx.wallet) {
      // Deduct credits from student wallet into Escrow
      const updatedStudentWallet = await tx.wallet.update({
        where: { userId: studentId },
        data: { balance: { decrement: session.creditCost } },
      });
      remainingBalance = updatedStudentWallet.balance;

      // Create student debit transaction record (Escrow Hold)
      await tx.creditTransaction.create({
        data: {
          walletId: updatedStudentWallet.id,
          amount: session.creditCost,
          type: "DEBIT",
          description: `Escrow hold for cohort session: ${session.title}`,
          referenceId: session.id,
        },
      });
    }

    // Create CohortSessionParticipant record
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

/**
 * 8. Complete Cohort Session (Mentor Only)
 * - TIME GUARD: Verifies that current time has passed the scheduled session end time.
 * - ESCROW RELEASE: Transfers accumulated credits (minus 15% platform fee) to mentor's wallet.
 */
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

  // 1. Time Guard Check: Mentor CANNOT mark completed unless session has ended
  const now = new Date();
  const sessionStart = new Date(session.scheduledAt);
  const sessionEnd = new Date(sessionStart.getTime() + session.durationMinutes * 60 * 1000);

  if (now < sessionEnd) {
    throw new AppError(
      `Cannot mark session as completed before it has ended. Scheduled end time is: ${sessionEnd.toISOString()}`,
      400,
    );
  }

  // 2. Escrow Calculation
  const totalPaidParticipants = session.participants.length;
  const totalEscrowCollected = session.creditCost * totalPaidParticipants;
  const platformFeeRate = 0.15; // 15% platform commission
  const mentorNetEarnings = Math.round(totalEscrowCollected * (1 - platformFeeRate));

  // 3. Transaction: Update status to COMPLETED & Release Escrow to Mentor's Wallet
  const updatedSession = await prisma.$transaction(async (tx: any) => {
    if (tx.wallet && mentorNetEarnings > 0) {
      const mentorWallet = await tx.wallet.upsert({
        where: { userId: mentorId },
        create: { userId: mentorId, balance: mentorNetEarnings, totalWithdrawn: 0 },
        update: { balance: { increment: mentorNetEarnings } },
      });

      await tx.creditTransaction.create({
        data: {
          walletId: mentorWallet.id,
          amount: mentorNetEarnings,
          type: "CREDIT",
          description: `Escrow release for completed cohort session (${totalPaidParticipants} participants): ${session.title}`,
          referenceId: session.id,
        },
      });
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

/**
 * 9. Cancel Cohort Session (Mentor Only)
 * - Marks status as CANCELLED and refunds held escrow credits back to all paid participants.
 */
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
    // Mark session as CANCELLED
    await tx.cohortSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED" },
    });

    // Refund each paid participant from Escrow
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
            type: "CREDIT",
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



