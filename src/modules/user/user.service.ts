import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type { IUpdateUserProfileInput } from "./user.interface.js";

// 1. Get Logged-In User Profile Details
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

  const wallet = await (prisma as any).wallet?.findUnique({
    where: { userId },
  });

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

// 2. Update Logged-In User Profile
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

  const { name, image, bio, techStackTags, githubUrl, resumeUrl } = payload;

  const userDataToUpdate: {
    name?: string;
    image?: string | null;
  } = {};
  if (name !== undefined) userDataToUpdate.name = name;
  if (image !== undefined) userDataToUpdate.image = image === "" ? null : image;

  if (Object.keys(userDataToUpdate).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: userDataToUpdate,
    });
  }

  if (user.mentorProfile) {
    const mentorDataToUpdate: {
      bio?: string;
      techStackTags?: string[];
      githubUrl?: string | null;
      resumeUrl?: string | null;
    } = {};
    if (bio !== undefined) mentorDataToUpdate.bio = bio;
    if (techStackTags !== undefined) mentorDataToUpdate.techStackTags = techStackTags;
    if (githubUrl !== undefined) mentorDataToUpdate.githubUrl = githubUrl === "" ? null : githubUrl;
    if (resumeUrl !== undefined) mentorDataToUpdate.resumeUrl = resumeUrl === "" ? null : resumeUrl;

    if (Object.keys(mentorDataToUpdate).length > 0) {
      await prisma.mentorProfile.update({
        where: { userId },
        data: mentorDataToUpdate,
      });
    }
  } else if (user.role === "mentor") {
    await prisma.mentorProfile.create({
      data: {
        userId,
        bio: bio ?? "Experienced software engineering mentor.",
        techStackTags: techStackTags ?? [],
        githubUrl: githubUrl === "" ? null : (githubUrl ?? null),
        resumeUrl: resumeUrl === "" ? null : (resumeUrl ?? null),
      },
    });
  }

  return getMyProfile(userId);
};

// 3. Get User Summary Dashboard
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

  if (user.role === "mentor") {
    const [createdCohorts, claimedSprints, directSprintRequests] = await Promise.all([
      prisma.cohortProgram.findMany({
        where: { mentorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sprintRequest.findMany({
        where: { claimedByMentorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          student: {
            select: { id: true, name: true, email: true, image: true },
          },
          sessions: {
            orderBy: { dayNumber: "asc" },
          },
        },
      }),
      prisma.sprintRequest.findMany({
        where: {
          targetMentorId: userId,
          status: "PENDING_CLAIM",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        include: {
          student: {
            select: { id: true, name: true, email: true, image: true },
          },
          sessions: {
            orderBy: { dayNumber: "asc" },
          },
        },
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
        totalDirectSprints: directSprintRequests.length,
        createdCohorts,
        claimedSprints,
        directSprintRequests,
      },
    };
  }

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

