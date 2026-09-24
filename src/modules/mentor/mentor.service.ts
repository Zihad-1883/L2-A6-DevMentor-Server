import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type { IApplyMentorInput, IMentorQueryFilters } from "./mentor.interface.js";

// 1. Apply for Mentor Role (Student Initiated)
const applyForMentor = async (userId: string, payload: IApplyMentorInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { mentorProfile: true },
  });

  if (!user) {
    throw new AppError("User account not found", 404);
  }

  if (user.isBlocked) {
    throw new AppError("Your account has been blocked by an administrator", 403);
  }

  if (user.mentorProfile) {
    if (user.mentorProfile.approvalStatus === "APPROVED") {
      throw new AppError("You are already an approved mentor on DevMentor", 400);
    }
    if (user.mentorProfile.approvalStatus === "PENDING") {
      throw new AppError("Your mentor application is currently under review by an Admin", 400);
    }
  }

  const { bio, techStackTags, experienceLevel, githubUrl, resumeUrl } = payload;

  const mentorProfile = await prisma.mentorProfile.upsert({
    where: { userId },
    create: {
      userId,
      bio,
      techStackTags: techStackTags || [],
      experienceLevel: experienceLevel || "MID",
      githubUrl: githubUrl || null,
      resumeUrl,
      approvalStatus: "PENDING",
    },
    update: {
      bio,
      techStackTags: techStackTags || [],
      experienceLevel: experienceLevel || "MID",
      githubUrl: githubUrl || null,
      resumeUrl,
      approvalStatus: "PENDING",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return {
    message: "Mentor application submitted successfully and is pending Admin approval",
    mentorProfile,
  };
};

// 2. Get Public Approved Mentors Directory
const getApprovedMentors = async (filters: IMentorQueryFilters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const skip = (page - 1) * limit;

  const where: any = {
    approvalStatus: "APPROVED",
    user: {
      isBlocked: false,
    },
  };

  if (filters.tag) {
    where.techStackTags = {
      has: filters.tag,
    };
  }

  if (filters.experienceLevel) {
    where.experienceLevel = filters.experienceLevel;
  }

  if (filters.search) {
    where.OR = [
      { bio: { contains: filters.search, mode: "insensitive" } },
      { user: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const [mentors, total] = await Promise.all([
    prisma.mentorProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }),
    prisma.mentorProfile.count({ where }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    mentors,
  };
};

// 3. Get Single Mentor Profile Details
const getMentorById = async (mentorIdOrUserId: string) => {
  const mentorProfile = await prisma.mentorProfile.findFirst({
    where: {
      OR: [{ id: mentorIdOrUserId }, { userId: mentorIdOrUserId }],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
          cohortsCreated: {
            where: { status: "PUBLISHED", deletedAt: null },
            select: {
              id: true,
              title: true,
              description: true,
              durationWeeks: true,
              totalCost: true,
              capacity: true,
              techStackTags: true,
              createdAt: true,
            },
          },
          sprintsClaimed: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              status: true,
              techStackTags: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!mentorProfile || mentorProfile.approvalStatus !== "APPROVED") {
    throw new AppError("Approved mentor profile not found", 404);
  }

  return mentorProfile;
};

export const mentorService = {
  applyForMentor,
  getApprovedMentors,
  getMentorById,
};

