import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
    IApproveMentorInput,
    IToggleUserBlockInput,
    IUserQueryFilters,
    IApproveCohortInput,
} from "./admin.interface.js";

// 1. Approve or Reject Mentor Application
const approveOrRejectMentor = async (
    adminId: string,
    mentorProfileId: string,
    payload: IApproveMentorInput,
) => {
    const mentorProfile = await prisma.mentorProfile.findUnique({
        where: { id: mentorProfileId },
    });

    if (!mentorProfile) {
        throw new AppError("Mentor application profile not found", 404);
    }

    if (mentorProfile.approvalStatus === "APPROVED") {
        throw new AppError("Mentor is already approved", 400)
    }

    const { status } = payload;

    const updatedMentorProfile = await prisma.$transaction(async (tx) => {
        // Update MentorProfile approval status
        const profile = await tx.mentorProfile.update({
            where: { id: mentorProfileId },
            data: {
                approvalStatus: status,
                approvedBy: adminId,
                approvedAt: status === "APPROVED" ? new Date() : null,
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true, isBlocked: true },
                },
            },
        });

        // If approved, upgrade target user's role to 'mentor'
        if (status === "APPROVED") {
            await tx.user.update({
                where: { id: mentorProfile.userId },
                data: { role: "mentor" },
            });
        }

        return profile;
    });

    return updatedMentorProfile;
};

// 2. Toggle User Blocked Status
const toggleUserBlock = async (
    adminId: string,
    userIdToBlock: string,
    payload: IToggleUserBlockInput,
) => {
    if (adminId === userIdToBlock) {
        throw new AppError("Admin cannot block or unblock their own account", 400);
    }

    const user = await prisma.user.findUnique({
        where: { id: userIdToBlock },
    });

    if (!user) {
        throw new AppError("Target user account not found", 404);
    }

    const updatedUser = await prisma.user.update({
        where: { id: userIdToBlock },
        data: {
            isBlocked: payload.isBlocked,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isBlocked: true,
            updatedAt: true,
        },
    });

    return updatedUser;
};

// 3. Get Paginated Users Directory
const getAllUsers = async (filters: IUserQueryFilters = {}) => {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.search) {
        where.OR = [
            { name: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
        ];
    }

    if (filters.role) {
        where.role = filters.role;
    }

    if (filters.isBlocked !== undefined && filters.isBlocked !== "") {
        where.isBlocked = String(filters.isBlocked) === "true";
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isBlocked: true,
                image: true,
                createdAt: true,
                updatedAt: true,
                mentorProfile: {
                    select: {
                        id: true,
                        approvalStatus: true,
                        experienceLevel: true,
                    },
                },
            },
        }),
        prisma.user.count({ where }),
    ]);

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        users,
    };
};

// 4. Approve or Reject Mentor Cohort Program
const approveOrRejectCohort = async (
    _adminId: string,
    cohortId: string,
    payload: IApproveCohortInput,
) => {
    const cohort = await prisma.cohortProgram.findUnique({
        where: { id: cohortId },
    });

    if (!cohort) {
        throw new AppError("Cohort program not found", 404);
    }

    const updatedCohort = await prisma.cohortProgram.update({
        where: { id: cohortId },
        data: {
            status: payload.status as any,
        },
        include: {
            mentor: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    return updatedCohort;
};

export const adminService = {
    approveOrRejectMentor,
    toggleUserBlock,
    getAllUsers,
    approveOrRejectCohort,
};

