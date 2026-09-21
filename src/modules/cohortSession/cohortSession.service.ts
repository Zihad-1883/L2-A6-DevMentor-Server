/**
 * @file src/modules/cohortSession/cohortSession.service.ts
 * @description Service layer for Cohort Group Sessions & embedded resources.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
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

export const cohortSessionService = {
  addCohortSession,
  getCohortSessions,
  updateCohortSession,
  deleteCohortSession,
};

