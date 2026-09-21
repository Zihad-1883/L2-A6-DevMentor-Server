/**
 * @file src/modules/user/user.service.ts
 * @description Domain logic for user profile management and student/mentor dashboard metrics.
 */

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type { IUpdateUserProfileInput } from "./user.interface.js";

// ── 1. Get Logged-In User Profile Details ────────────────────────────────────
const getMyProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isBlocked: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      mentorProfile: true,
    },
  });

  if (!user) {
    throw new AppError("User profile not found", 404);
  }

  // Fetch student/mentor wallet balance if available
  const wallet = await (prisma as any).wallet?.findUnique({
    where: { userId },
  });

  // Students only see balance; Mentors/Admins see totalEarned & totalWithdrawn
  const walletData =
    user.role === "mentor" || user.role === "admin"
      ? {
          balance: wallet?.balance ?? 0,
          totalEarned: wallet?.totalEarned ?? 0,
          totalWithdrawn: wallet?.totalWithdrawn ?? 0,
        }
      : {
          balance: wallet?.balance ?? 0,
        };

  return {
    ...user,
    wallet: walletData,
  };
};

// ── 2. Update Logged-In User Profile ─────────────────────────────────────────
const updateMyProfile = async (userId: string, payload: IUpdateUserProfileInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { mentorProfile: true },
  });

  if (!user) {
    throw new AppError("User profile not found", 404);
  }

  if (user.isBlocked) {
    throw new AppError("Your account has been blocked by an administrator", 403);
  }

  const { name, image, bio } = payload;

  const userDataToUpdate: any = {};
  if (name !== undefined) userDataToUpdate.name = name;
  if (image !== undefined) userDataToUpdate.image = image;

  if (Object.keys(userDataToUpdate).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: userDataToUpdate,
    });
  }

  if (bio !== undefined && user.mentorProfile) {
    await prisma.mentorProfile.update({
      where: { userId },
      data: { bio },
    });
  }

  return getMyProfile(userId);
};

// ── 3. Get User Summary Dashboard (Role-Specific) ───────────────────────────
const getMyDashboard = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isBlocked: true },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const wallet = await (prisma as any).wallet?.findUnique({
    where: { userId },
  });

  // If Mentor: Return Mentor-only statistics & earning history
  if (user.role === "mentor") {
    const [createdCohorts, claimedSprints] = await Promise.all([
      prisma.cohortProgram.findMany({
        where: { mentorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sprintRequest.findMany({
        where: { claimedByMentorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      wallet: {
        balance: wallet?.balance ?? 0,
        totalEarned: wallet?.totalEarned ?? 0,
        totalWithdrawn: wallet?.totalWithdrawn ?? 0,
      },
      summary: {
        totalCohortsCreated: createdCohorts.length,
        totalSprintsClaimed: claimedSprints.length,
        createdCohorts,
        claimedSprints,
      },
    };
  }

  // If Student / Default: Return Student-only enrollments & credit balance
  const [enrolledCohorts, requestedSprints] = await Promise.all([
    prisma.cohortEnrollment.findMany({
      where: { studentId: userId },
      include: {
        cohort: {
          select: {
            id: true,
            title: true,
            description: true,
            durationWeeks: true,
            totalCost: true,
            status: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.sprintRequest.findMany({
      where: { studentId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    wallet: {
      balance: wallet?.balance ?? 0,
    },
    summary: {
      totalEnrolledCohorts: enrolledCohorts.length,
      totalRequestedSprints: requestedSprints.length,
      enrolledCohorts,
      recentSprintRequests: requestedSprints,
    },
  };
};

export const userService = {
  getMyProfile,
  updateMyProfile,
  getMyDashboard,
};

