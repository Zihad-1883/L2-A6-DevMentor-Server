/**
 * @file src/modules/cohort/cohort.service.ts
 * @description Domain service functions for Mentor Cohort Program operations.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
  ICreateCohortInput,
  IUpdateCohortInput,
  ICohortQueryFilters,
} from "./cohort.interface.js";

/**
 * 1. Create Cohort Program (Mentor Initiated)
 * - Checks mentor role and approved profile status.
 * - Creates cohort with PENDING_APPROVAL and DRAFT status.
 */
const createCohort = async (mentorId: string, payload: ICreateCohortInput) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { mentorProfile: true },
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

  const { title, description, durationWeeks, capacity, techStackTags } = payload;

  const cohort = await prisma.cohortProgram.create({
    data: {
      mentorId,
      title,
      description,
      durationWeeks,
      capacity,
      techStackTags: techStackTags || [],
      approvalStatus: "PENDING_APPROVAL",
      status: "DRAFT",
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true,
        },
      },
    },
  });

  return cohort;
};

/**
 * 2. Get All Published Cohorts (Public Directory)
 * - Filters for approved and published cohorts.
 * - Supports keyword search, tag filtering, and pagination.
 */
const getAllPublishedCohorts = async (filters: ICohortQueryFilters) => {
  const { search, tag } = filters;
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = {
    deletedAt: null,
    approvalStatus: "APPROVED",
    status: "PUBLISHED",
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
            mentorProfile: true,
          },
        },
        _count: {
          select: {
            enrollments: true,
            sessions: true,
          },
        },
      },
    }),
    prisma.cohortProgram.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    cohorts,
  };
};

/**
 * 3. Get Single Cohort By ID
 * - Retrieves details of a specific cohort.
 * - Includes mentor info, sessions list, and enrollment count.
 */
const getCohortById = async (cohortId: string) => {
  const cohort = await prisma.cohortProgram.findFirst({
    where: {
      id: cohortId,
      deletedAt: null,
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          mentorProfile: true,
        },
      },
      sessions: {
        orderBy: { sessionNumber: "asc" },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
  });

  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }

  return cohort;
};

/**
 * 4. Get Mentor's Created Cohorts
 * - Retrieves all cohorts created by the logged-in mentor.
 * - Includes drafts, pending approval, and published cohorts.
 */
const getMyCreatedCohorts = async (mentorId: string) => {
  const cohorts = await prisma.cohortProgram.findMany({
    where: {
      mentorId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      sessions: {
        orderBy: { sessionNumber: "asc" },
      },
      _count: {
        select: {
          enrollments: true,
          sessions: true,
        },
      },
    },
  });

  return cohorts;
};

/**
 * 5. Update Cohort Program
 * - Updates details of a cohort owned by the mentor.
 */
const updateCohort = async (
  cohortId: string,
  mentorId: string,
  payload: IUpdateCohortInput,
) => {
  const existingCohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null },
  });

  if (!existingCohort) {
    throw new AppError("Cohort program not found", 404);
  }

  if (existingCohort.mentorId !== mentorId) {
    throw new AppError("You are not authorized to update this cohort program", 403);
  }

  const updatedCohort = await prisma.cohortProgram.update({
    where: { id: cohortId },
    data: {
      ...payload,
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return updatedCohort;
};

/**
 * 6. Soft Delete Cohort Program
 * - Marks cohort as ARCHIVED and sets deletedAt timestamp.
 */
const deleteCohort = async (cohortId: string, mentorId: string) => {
  const existingCohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null },
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
      deletedAt: new Date(),
      status: "ARCHIVED",
    },
  });

  return { message: "Cohort program deleted successfully" };
};

/**
 * 7. Register Student for Cohort Program
 * - Checks cohort status, capacity, and prevents duplicate enrollment.
 */
const registerCohort = async (cohortId: string, studentId: string) => {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
  });

  if (!student) {
    throw new AppError("Student user account not found", 404);
  }

  const cohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null },
    include: {
      _count: {
        select: { enrollments: true },
      },
    },
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
        studentId,
      },
    },
  });

  if (existingEnrollment) {
    throw new AppError("You are already enrolled in this cohort program", 400);
  }

  const enrollment = await prisma.cohortEnrollment.create({
    data: {
      cohortId,
      studentId,
    },
    include: {
      cohort: {
        select: {
          id: true,
          title: true,
          durationWeeks: true,
        },
      },
    },
  });

  return enrollment;
};

export const cohortService = {
  createCohort,
  getAllPublishedCohorts,
  getCohortById,
  getMyCreatedCohorts,
  updateCohort,
  deleteCohort,
  registerCohort,
};


