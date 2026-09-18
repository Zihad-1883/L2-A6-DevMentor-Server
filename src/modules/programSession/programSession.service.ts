/**
 * @file src/modules/programSession/programSession.service.ts
 * @description Domain service functions for Program Session management and booking.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
  ICreateSessionInput,
  IUpdateSessionInput,
  IBookSessionInput,
} from "./programSession.interface.js";

// ── 1. Add Session to Program ─────────────────────────────────────────────────
const addSessionToProgram = async (
  programId: string,
  mentorId: string,
  payload: ICreateSessionInput,
) => {
  const program = await prisma.program.findFirst({
    where: { id: programId, deletedAt: null },
  });

  if (!program) {
    throw new AppError("Program not found", 404);
  }

  if (program.mentorId !== mentorId) {
    throw new AppError("You are not authorized to add sessions to this program", 403);
  }

  if (!payload.scheduledAt) {
    throw new AppError("Mentor must provide a valid schedule date and time (scheduledAt) for the session", 400);
  }

  const session = await prisma.programSession.create({
    data: {
      programId,
      title: payload.title || `Session ${payload.sessionNumber || 1}`,
      sessionNumber: payload.sessionNumber || 1,
      weekNumber: payload.weekNumber,
      priceInCredits: payload.priceInCredits,
      scheduledAt: new Date(payload.scheduledAt),
      durationMinutes: payload.durationMinutes || 60,
      joinLink: payload.joinLink,
      status: "PENDING",
    },
  });

  return session;
};

// ── 2. Update Session ─────────────────────────────────────────────────────────
const updateSession = async (
  sessionId: string,
  mentorId: string,
  payload: IUpdateSessionInput,
) => {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: { program: true },
  });

  if (!session || session.program.deletedAt) {
    throw new AppError("Session not found", 404);
  }

  if (session.program.mentorId !== mentorId) {
    throw new AppError("You are not authorized to update this session", 403);
  }

  const updatedSession = await prisma.programSession.update({
    where: { id: sessionId },
    data: {
      ...payload,
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
    },
  });

  return updatedSession;
};

// ── 3. Delete Session ─────────────────────────────────────────────────────────
const deleteSession = async (sessionId: string, mentorId: string) => {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: { program: true },
  });

  if (!session || session.program.deletedAt) {
    throw new AppError("Session not found", 404);
  }

  if (session.program.mentorId !== mentorId) {
    throw new AppError("You are not authorized to delete this session", 403);
  }

  await prisma.programSession.delete({
    where: { id: sessionId },
  });

  return { message: "Session removed successfully" };
};

// ── 4. Book / Schedule Session (Student Accepts Mentor Schedule) ─────────────
const bookSession = async (
  sessionId: string,
  userId: string,
  payload: IBookSessionInput,
) => {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: { program: true },
  });

  if (!session || session.program.deletedAt) {
    throw new AppError("Session not found", 404);
  }

  if (session.status === "CONFIRMED") {
    throw new AppError("This session slot has already been booked", 400);
  }

  const targetStart = payload.scheduledAt
    ? new Date(payload.scheduledAt)
    : session.scheduledAt;

  if (!targetStart) {
    throw new AppError("This session slot does not have a scheduled date & time set by the mentor", 400);
  }

  const mentorId = session.program.mentorId;
  const durationMs = (payload.durationMinutes || session.durationMinutes || 60) * 60 * 1000;
  const targetEnd = new Date(targetStart.getTime() + durationMs);

  // ⚠️ CONFLICT DETECTION: Check if mentor already has another confirmed session overlapping this slot!
  const conflictingSession = await prisma.programSession.findFirst({
    where: {
      id: { not: sessionId },
      status: "CONFIRMED",
      program: { mentorId },
      scheduledAt: { not: null },
    },
  });

  if (conflictingSession && conflictingSession.scheduledAt) {
    const existingStart = conflictingSession.scheduledAt;
    const existingEnd = new Date(existingStart.getTime() + conflictingSession.durationMinutes * 60 * 1000);

    if (targetStart < existingEnd && targetEnd > existingStart) {
      throw new AppError(
        "Booking conflict: The mentor already has another confirmed session scheduled during this time slot.",
        409,
      );
    }
  }

  const confirmedSession = await prisma.programSession.update({
    where: { id: sessionId },
    data: {
      scheduledAt: targetStart,
      durationMinutes: payload.durationMinutes || session.durationMinutes,
      joinLink: payload.joinLink || session.joinLink,
      status: "CONFIRMED",
    },
  });

  return confirmedSession;
};

// ── 5. Cancel Session (1-Hour Cutoff Check) ──────────────────────────────────
const cancelSession = async (sessionId: string, userId: string) => {
  const session = await prisma.programSession.findUnique({
    where: { id: sessionId },
    include: { program: true },
  });

  if (!session || session.program.deletedAt) {
    throw new AppError("Session not found", 404);
  }

  const now = new Date();
  let isEligibleForRefund = false;

  if (session.scheduledAt) {
    const cutoffTime = new Date(session.scheduledAt.getTime() - 60 * 60 * 1000);
    if (now <= cutoffTime) {
      isEligibleForRefund = true;
    }
  }

  const cancelledSession = await prisma.programSession.update({
    where: { id: sessionId },
    data: { status: "CANCELLED" },
  });

  return {
    session: cancelledSession,
    isEligibleForRefund,
    message: isEligibleForRefund
      ? "Session cancelled before 1-hour cutoff. Full refund eligible."
      : "Session cancelled within 1 hour of scheduled time. Non-refundable.",
  };
};

// ── Service Export Object ─────────────────────────────────────────────────────
export const programSessionService = {
  addSessionToProgram,
  updateSession,
  deleteSession,
  bookSession,
  cancelSession,
};
