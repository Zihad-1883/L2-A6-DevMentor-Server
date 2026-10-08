import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
  ICreateCohortInput,
  IUpdateCohortInput,
  ICohortQueryFilters,
} from "./cohort.interface.js";


// 1. Create Cohort Program 
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


// 2. Get All Published Cohorts (Public Directory)
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

// 3. Get Single Cohort By ID
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


// 4. Get Mentor's Created Cohorts
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


// 5. Update Cohort Program
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

  if (payload.status === "PUBLISHED" && existingCohort.status !== "PUBLISHED") {
    if (existingCohort.approvalStatus !== "APPROVED") {
      throw new AppError("Cannot publish cohort program until it has been approved by an administrator", 400);
    }

    const existingPublishedCohort = await prisma.cohortProgram.findFirst({
      where: {
        mentorId,
        status: "PUBLISHED",
        id: { not: cohortId },
        deletedAt: null,
      },
    });

    if (existingPublishedCohort) {
      throw new AppError("You already have an active published cohort program. Only 1 published cohort is allowed at a time.", 400);
    }
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

// 6. Soft Delete Cohort Program
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

// 7. Register Student for Cohort Program
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

// 8. Get Enrolled Students for a Cohort (Mentor Only)
const getCohortEnrollments = async (
  cohortId: string,
  userId: string,
  userRole?: string
) => {
  const cohort = await prisma.cohortProgram.findFirst({
    where: { id: cohortId, deletedAt: null },
  });

  if (!cohort) {
    throw new AppError("Cohort program not found", 404);
  }

  // Ensure only the mentor creator (or admin) can access the student roster
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
          image: true,
        },
      },
    },
  });

  return enrollments;
};

export const cohortService = {
  createCohort,
  getAllPublishedCohorts,
  getCohortById,
  getMyCreatedCohorts,
  updateCohort,
  deleteCohort,
  registerCohort,
  getCohortEnrollments,
};


