/**
 * @file src/modules/sprint/sprint.service.ts
 * @description Domain service functions for Student Sprint operations (1-on-1 mentorship requests).
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
  ICreateSprintInput,
  IUpdateSprintInput,
  ISprintQueryFilters,
} from "./sprint.interface.js";

// 1. Create Sprint Request (Student Initiated)
const createSprint = async (studentId: string, payload: ICreateSprintInput) => {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
  });

  if (!student) {
    throw new AppError("Student user account not found", 404);
  }

  //   To do : Add validation for available credits to start a sprint

  const { title, description, techStackTags, startDate, durationDays, selectedDays } = payload;

  const start = new Date(startDate);

  // Auto-generate session slots for each chosen day number
  const sessionData = selectedDays.map((dayNum) => {
    // Calculate estimated session date based on startDate + dayNum offset
    const sessionDate = new Date(start);
    sessionDate.setDate(sessionDate.getDate() + (dayNum - 1));

    return {
      dayNumber: dayNum,
      scheduledAt: sessionDate,
      status: "PENDING" as const,
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
          data: sessionData,
        },
      },
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      sessions: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });

  return sprint;
};

// 2. Get Open Sprint Pool (Mentors Browse Pending Requests)
const getOpenSprintPool = async (filters: ISprintQueryFilters) => {
  const { search, tag } = filters;
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = {
    deletedAt: null,
    status: "PENDING_CLAIM",
  };

  if (tag) {
    where.techStackTags = {
      has: tag,
    };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
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
            image: true,
          },
        },
        sessions: {
          orderBy: { dayNumber: "asc" },
        },
      },
    }),
    prisma.sprintRequest.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    sprints,
  };
};

// 3. Claim Sprint Request (Approved Mentor Only)
const claimSprint = async (sprintId: string, mentorId: string) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { mentorProfile: true },
  });

  if (!mentor || mentor.role !== "mentor") {
    throw new AppError("Only mentors can claim student sprint requests", 403);
  }

  if (mentor.mentorProfile?.approvalStatus !== "APPROVED") {
    throw new AppError("Your mentor profile must be approved by an Admin before claiming sprints", 403);
  }

  const existingSprint = await prisma.sprintRequest.findFirst({
    where: { id: sprintId, deletedAt: null },
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
      claimedAt: new Date(),
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      claimedByMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true,
        },
      },
      sessions: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });

  return claimedSprint;
};

// 4. Get Single Sprint By ID
const getSprintById = async (sprintId: string, userId: string) => {

  const sprint = await prisma.sprintRequest.findFirst({
    where: {
      id: sprintId,
      deletedAt: null,
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      claimedByMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true,
        },
      },
      sessions: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });

  if (!sprint) {
    throw new AppError("Sprint request not found", 404);
  }

  if (userId !== sprint.studentId && userId !== sprint.claimedByMentorId) {
    throw new AppError("You cannot access this sprint details", 403)
  }

  return sprint;
};

// 5. Get User's Own Sprints (Student requests OR Mentor claimed)
const getUserSprints = async (userId: string, role: string) => {
  const where: any = {
    deletedAt: null,
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
          image: true,
        },
      },
      claimedByMentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      sessions: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });

  return sprints;
};

// 6. Update Sprint Request (Student Only, Pending Claim Only)
const updateSprint = async (
  sprintId: string,
  studentId: string,
  payload: IUpdateSprintInput,
) => {
  const existingSprint = await prisma.sprintRequest.findFirst({
    where: { id: sprintId, deletedAt: null },
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
      startDate: payload.startDate ? new Date(payload.startDate) : undefined,
    },
    include: {
      sessions: {
        orderBy: { dayNumber: "asc" },
      },
    },
  });

  return updatedSprint;
};

// 7. Soft Delete / Cancel Sprint Request
const deleteSprint = async (sprintId: string, studentId: string) => {
  const existingSprint = await prisma.sprintRequest.findFirst({
    where: { id: sprintId, deletedAt: null },
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
      deletedAt: new Date(),
      status: "CANCELLED",
    },
  });

  return { message: "Sprint request cancelled successfully" };
};

// Service Export Object 
export const sprintService = {
  createSprint,
  getOpenSprintPool,
  claimSprint,
  getSprintById,
  getUserSprints,
  updateSprint,
  deleteSprint,
};
