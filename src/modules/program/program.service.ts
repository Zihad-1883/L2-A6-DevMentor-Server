/**
 * @file src/modules/program/program.service.ts
 * @description Domain service functions for Program operations.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
  ICreateProgramInput,
  IUpdateProgramInput,
  IProgramQueryFilters,
} from "./program.interface.js";

// ── 1. Create Program ─────────────────────────────────────────────────────────
const createProgram = async (mentorId: string, payload: ICreateProgramInput) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { mentorProfile: true },
  });

  if (!mentor || mentor.role !== "mentor") {
    throw new AppError("Only mentors can create mentorship programs", 403);
  }

  if (mentor.mentorProfile?.approvalStatus !== "APPROVED") {
    throw new AppError("Your mentor application must be approved by an Admin before creating programs", 403);
  }

  const { title, description, durationWeeks, techStackTags } = payload;

  const program = await prisma.program.create({
    data: {
      mentorId,
      title,
      description,
      durationWeeks,
      techStackTags,
      status: "DRAFT",
    },
    include: {
      sessions: true,
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

  return program;
};

// ── 2. Get All Programs (Public Directory with Search, Filter & Pagination) ───
const getPrograms = async (filters: IProgramQueryFilters) => {
  const { search, tag, status = "PUBLISHED", mentorId } = filters;
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;

  const skip = (page - 1) * limit;

  const where: any = {
    deletedAt: null,
    status,
  };

  if (mentorId) {
    where.mentorId = mentorId;
  }

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

  const [programs, total] = await Promise.all([
    prisma.program.findMany({
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
          },
        },
        sessions: {
          orderBy: { sessionNumber: "asc" },
        },
      },
    }),
    prisma.program.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    programs,
  };
};

// ── 3. Get Single Program By ID ───────────────────────────────────────────────
const getProgramById = async (programId: string) => {
  const program = await prisma.program.findFirst({
    where: {
      id: programId,
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
    },
  });

  if (!program) {
    throw new AppError("Program not found", 404);
  }

  return program;
};

// ── 4. Get Mentor's Own Programs ──────────────────────────────────────────────
const getMentorPrograms = async (mentorId: string) => {
  const programs = await prisma.program.findMany({
    where: {
      mentorId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      sessions: {
        orderBy: { sessionNumber: "asc" },
      },
    },
  });

  return programs;
};

// ── 5. Update Program ─────────────────────────────────────────────────────────
const updateProgram = async (
  programId: string,
  mentorId: string,
  payload: IUpdateProgramInput,
) => {
  const existingProgram = await prisma.program.findFirst({
    where: { id: programId, deletedAt: null },
  });

  if (!existingProgram) {
    throw new AppError("Program not found", 404);
  }

  if (existingProgram.mentorId !== mentorId) {
    throw new AppError("You are not authorized to update this program", 403);
  }

  const updatedProgram = await prisma.program.update({
    where: { id: programId },
    data: payload,
    include: {
      sessions: true,
    },
  });

  return updatedProgram;
};

// ── 6. Soft Delete Program ────────────────────────────────────────────────────
const deleteProgram = async (programId: string, mentorId: string) => {
  const existingProgram = await prisma.program.findFirst({
    where: { id: programId, deletedAt: null },
  });

  if (!existingProgram) {
    throw new AppError("Program not found", 404);
  }

  if (existingProgram.mentorId !== mentorId) {
    throw new AppError("You are not authorized to delete this program", 403);
  }

  await prisma.program.update({
    where: { id: programId },
    data: { deletedAt: new Date() },
  });

  return { message: "Program deleted successfully" };
};

// ── Service Export Object ─────────────────────────────────────────────────────
export const programService = {
  createProgram,
  getPrograms,
  getProgramById,
  getMentorPrograms,
  updateProgram,
  deleteProgram,
};
