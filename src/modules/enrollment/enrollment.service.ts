/**
 * @file src/modules/enrollment/enrollment.service.ts
 * @description Domain logic for querying student cohort enrollments and sprint requests.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type { IEnrollmentQueryFilters } from "./enrollment.interface.js";

// ── 1. Get Logged-In Student Enrolled Cohorts ─────────────────────────────────
const getMyEnrolledCohorts = async (studentId: string, filters: IEnrollmentQueryFilters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = { studentId };

  const [enrollments, total] = await Promise.all([
    prisma.cohortEnrollment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { enrolledAt: "desc" },
      include: {
        cohort: {
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
              select: {
                id: true,
                title: true,
                scheduledAt: true,
                status: true,
              },
            },
          },
        },
      },
    }),
    prisma.cohortEnrollment.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    enrollments,
  };
};

// ── 2. Get Logged-In Student Sprint Requests ─────────────────────────────────
const getMyEnrolledSprints = async (studentId: string, filters: IEnrollmentQueryFilters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = { studentId, deletedAt: null };

  if (filters.status) {
    where.status = filters.status;
  }

  const [sprints, total] = await Promise.all([
    prisma.sprintRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
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
          select: {
            id: true,
            dayNumber: true,
            scheduledAt: true,
            status: true,
            creditCost: true,
          },
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

export const enrollmentService = {
  getMyEnrolledCohorts,
  getMyEnrolledSprints,
};

