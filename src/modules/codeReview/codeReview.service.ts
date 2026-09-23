import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import { ICreateCodeReviewInput, ISubmitCodeReviewInput, IUpdateCodeSnippetInput } from "./codeReview.interface.js";

// Helper to determine credit reward based on review tier
const getCreditCostByTier = (tier: "QUICK" | "DEEP"): number => {
  return tier === "QUICK" ? 10 : 50;
};

// 1. Create Code Review Request (Student) with Atomic Credit Escrow Hold
const createReviewRequest = async (studentId: string, payload: ICreateCodeReviewInput) => {
  const { tier, title, description, codeSnippet, language, githubRepoUrl, branchName, specificFiles } = payload;
  const requiredCredits = getCreditCostByTier(tier);

  // Check student wallet balance
  const wallet = await prisma.wallet.findUnique({
    where: { userId: studentId },
  });

  if (!wallet || wallet.balance < requiredCredits) {
    throw new AppError(
      `Insufficient wallet balance. ${tier} Code Review requires ${requiredCredits} Credits but you have ${wallet?.balance || 0} Credits.`,
      400
    );
  }

  // Atomic transaction: Deduct wallet balance, record Escrow transaction, and create CodeReviewRequest
  const { reviewRequest, updatedWallet } = await prisma.$transaction(async (tx: any) => {
    // 1. Deduct credits from student wallet
    const updatedWallet = await tx.wallet.update({
      where: { userId: studentId },
      data: {
        balance: { decrement: requiredCredits },
      },
    });

    // 2. Create Code Review Request
    const reviewRequest = await tx.codeReviewRequest.create({
      data: {
        studentId,
        tier,
        title,
        description,
        codeSnippet,
        language: language || "typescript",
        githubRepoUrl,
        branchName: branchName || "main",
        specificFiles,
        creditReward: requiredCredits,
        status: "OPEN",
      },
    });

    // 3. Create Escrow Credit Transaction Record
    await tx.creditTransaction.create({
      data: {
        walletId: updatedWallet.id,
        amount: -requiredCredits,
        type: "SPRINT_ESCROW",
        description: `Escrow hold for ${tier} Code Review request: "${title}"`,
        referenceId: reviewRequest.id,
      },
    });

    return { reviewRequest, updatedWallet };
  });

  return {
    success: true,
    message: `${tier} Code Review request created successfully with ${requiredCredits} Credits held in escrow`,
    data: {
      request: reviewRequest,
      wallet: updatedWallet,
    },
  };
};

// 2. Update Student Code Snippet / Request Info (Student)
const updateCodeSnippet = async (studentId: string, requestId: string, payload: IUpdateCodeSnippetInput) => {
  const existingRequest = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId },
  });

  if (!existingRequest) {
    throw new AppError("Code review request not found", 404);
  }

  if (existingRequest.studentId !== studentId) {
    throw new AppError("You are not authorized to update this code review request", 403);
  }

  if (existingRequest.status !== "OPEN") {
    throw new AppError(
      `Code review request cannot be updated because its current status is '${existingRequest.status}'. Only OPEN requests can be updated.`,
      400
    );
  }

  const updatedRequest = await prisma.codeReviewRequest.update({
    where: { id: requestId },
    data: {
      ...(payload.title && { title: payload.title }),
      ...(payload.description && { description: payload.description }),
      ...(payload.codeSnippet !== undefined && { codeSnippet: payload.codeSnippet }),
      ...(payload.language && { language: payload.language }),
      ...(payload.githubRepoUrl !== undefined && { githubRepoUrl: payload.githubRepoUrl }),
      ...(payload.branchName && { branchName: payload.branchName }),
      ...(payload.specificFiles !== undefined && { specificFiles: payload.specificFiles }),
    },
  });

  return {
    success: true,
    message: "Code review request updated successfully",
    data: updatedRequest,
  };
};

// 3. Acquire 10-Minute Temporary Preview Lock (Mentor)
const previewLockReviewRequest = async (mentorId: string, requestId: string) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
  });

  if (!mentor || (mentor.role !== "mentor" && mentor.role !== "admin")) {
    throw new AppError("Only verified mentors can preview code review requests", 403);
  }

  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new AppError("Code review request not found", 404);
  }

  if (request.status !== "OPEN" && request.status !== "PREVIEW_LOCKED") {
    throw new AppError(`Code review request is no longer available for preview (Status: ${request.status})`, 400);
  }

  // Check if locked by another mentor with active timer
  const now = new Date();
  if (
    request.status === "PREVIEW_LOCKED" &&
    request.previewMentorId !== mentorId &&
    request.previewExpiresAt &&
    request.previewExpiresAt > now
  ) {
    throw new AppError(
      `This code review request is currently preview-locked by another mentor until ${request.previewExpiresAt.toISOString()}`,
      400
    );
  }

  // Set 10-minute preview lock
  const previewExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  const updatedRequest = await prisma.codeReviewRequest.update({
    where: { id: requestId },
    data: {
      status: "PREVIEW_LOCKED",
      previewMentorId: mentorId,
      previewExpiresAt,
    },
  });

  return {
    success: true,
    message: "10-minute preview lock acquired successfully",
    data: updatedRequest,
  };
};

// 4. Officially Claim Code Review Request (Mentor) with SLA Deadline Calculation
const claimReviewRequest = async (mentorId: string, requestId: string) => {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
  });

  if (!mentor || (mentor.role !== "mentor" && mentor.role !== "admin")) {
    throw new AppError("Only verified mentors can claim code review requests", 403);
  }

  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new AppError("Code review request not found", 404);
  }

  if (request.status === "CLAIMED" || request.status === "DELIVERED" || request.status === "COMPLETED" || request.status === "CANCELLED" || request.status === "EXPIRED") {
    throw new AppError(`Code review request is no longer open for claiming (Status: ${request.status})`, 400);
  }

  // If preview locked by someone else, check lock expiration
  const now = new Date();
  if (
    request.status === "PREVIEW_LOCKED" &&
    request.previewMentorId !== mentorId &&
    request.previewExpiresAt &&
    request.previewExpiresAt > now
  ) {
    throw new AppError("Cannot claim request preview-locked by another mentor", 400);
  }

  // Calculate Delivery SLA Deadline (QUICK: +2 Hours, DEEP: +24 Hours / 1 Day)
  const slaDurationMs = request.tier === "QUICK" ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const deliveryDeadline = new Date(now.getTime() + slaDurationMs);

  const updatedRequest = await prisma.codeReviewRequest.update({
    where: { id: requestId },
    data: {
      status: "CLAIMED",
      assignedMentorId: mentorId,
      deliveryDeadline,
      previewMentorId: null,
      previewExpiresAt: null,
    },
  });

  return {
    success: true,
    message: `Code review request claimed successfully. Target delivery deadline: ${deliveryDeadline.toISOString()} (${request.tier === "QUICK" ? "2 Hours" : "24 Hours"})`,
    data: updatedRequest,
  };
};

// 5. Submit Review Delivery (Assigned Mentor)
const submitReview = async (mentorId: string, requestId: string, payload: ISubmitCodeReviewInput) => {
  const { summary, reviewedCodeSnippet, videoUrl, pullRequestUrl, comments } = payload;

  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new AppError("Code review request not found", 404);
  }

  if (request.assignedMentorId !== mentorId) {
    throw new AppError("You are not the assigned mentor for this code review request", 403);
  }

  if (request.status !== "CLAIMED") {
    throw new AppError(`Review feedback can only be submitted when status is CLAIMED (Current status: ${request.status})`, 400);
  }

  const { submission, updatedRequest } = await prisma.$transaction(async (tx: any) => {
    // 1. Create Submission with inline comments
    const submission = await tx.codeReviewSubmission.create({
      data: {
        requestId,
        mentorId,
        summary,
        reviewedCodeSnippet,
        videoUrl,
        pullRequestUrl,
        ...(comments && comments.length > 0 && {
          comments: {
            createMany: {
              data: comments.map((c) => ({
                filePath: c.filePath,
                lineNumber: c.lineNumber,
                commentText: c.commentText,
                severity: c.severity || "SUGGESTION",
              })),
            },
          },
        }),
      },
      include: {
        comments: true,
      },
    });

    // 2. Update Request status to DELIVERED
    const updatedRequest = await tx.codeReviewRequest.update({
      where: { id: requestId },
      data: {
        status: "DELIVERED",
      },
    });

    return { submission, updatedRequest };
  });

  return {
    success: true,
    message: "Code review feedback submitted successfully. Pending student approval for credit release.",
    data: {
      request: updatedRequest,
      submission,
    },
  };
};

// 6. Approve Review & Release 100% Credits to Mentor (Student / Admin)
const approveAndRelease = async (userId: string, requestId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new AppError("Code review request not found", 404);
  }

  // Must be the request student or an admin
  if (request.studentId !== userId && user.role !== "admin") {
    throw new AppError("Only the student who created the request or an admin can approve and release funds", 403);
  }

  if (request.status !== "DELIVERED") {
    throw new AppError(`Credits can only be released when review status is DELIVERED (Current status: ${request.status})`, 400);
  }

  if (!request.assignedMentorId) {
    throw new AppError("No mentor assigned to this code review request", 400);
  }

  const creditPayout = request.creditReward; // 100% Payout to Mentor (0% Platform Fee)

  const { updatedRequest, mentorWallet } = await prisma.$transaction(async (tx: any) => {
    // 1. Credit mentor wallet balance and totalEarned (100% Payout)
    const mentorWallet = await tx.wallet.upsert({
      where: { userId: request.assignedMentorId! },
      create: {
        userId: request.assignedMentorId!,
        balance: creditPayout,
        totalEarned: creditPayout,
        totalWithdrawn: 0,
      },
      update: {
        balance: { increment: creditPayout },
        totalEarned: { increment: creditPayout },
      },
    });

    // 2. Record Credit Transaction for Mentor
    await tx.creditTransaction.create({
      data: {
        walletId: mentorWallet.id,
        amount: creditPayout,
        type: "SPRINT_RELEASE",
        description: `100% Escrow release for ${request.tier} Code Review completion: "${request.title}"`,
        referenceId: request.id,
      },
    });

    // 3. Update Request status to COMPLETED
    const updatedRequest = await tx.codeReviewRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
      },
    });

    return { updatedRequest, mentorWallet };
  });

  return {
    success: true,
    message: `Review approved! Released 100% (${creditPayout} Credits) to mentor's wallet balance.`,
    data: {
      request: updatedRequest,
      mentorWallet,
    },
  };
};

// 7. Cancel Unclaimed Review Request & Refund Student (Student)
const cancelReviewRequest = async (studentId: string, requestId: string) => {
  const request = await prisma.codeReviewRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new AppError("Code review request not found", 404);
  }

  if (request.studentId !== studentId) {
    throw new AppError("You are not authorized to cancel this code review request", 403);
  }

  if (request.status !== "OPEN" && request.status !== "PREVIEW_LOCKED") {
    throw new AppError(`Only OPEN or PREVIEW_LOCKED requests can be cancelled (Current status: ${request.status})`, 400);
  }

  const refundCredits = request.creditReward;

  const { updatedRequest, studentWallet } = await prisma.$transaction(async (tx: any) => {
    // 1. Refund student wallet balance
    const studentWallet = await tx.wallet.update({
      where: { userId: studentId },
      data: {
        balance: { increment: refundCredits },
      },
    });

    // 2. Record Refund Credit Transaction
    await tx.creditTransaction.create({
      data: {
        walletId: studentWallet.id,
        amount: refundCredits,
        type: "SPRINT_REFUND",
        description: `Refund for cancelled ${request.tier} Code Review request: "${request.title}"`,
        referenceId: request.id,
      },
    });

    // 3. Update Request status to CANCELLED
    const updatedRequest = await tx.codeReviewRequest.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED",
        previewMentorId: null,
        previewExpiresAt: null,
      },
    });

    return { updatedRequest, studentWallet };
  });

  return {
    success: true,
    message: `Code review request cancelled. Refunded ${refundCredits} Credits back to student wallet.`,
    data: {
      request: updatedRequest,
      studentWallet,
    },
  };
};

// 8. Get Open Code Review Requests Pool with Filters & Pagination (Mentors)
const getOpenCodeReviewPool = async (filters: import("./codeReview.interface.js").ICodeReviewQueryFilters = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const now = new Date();

  // Availability condition: OPEN or PREVIEW_LOCKED whose 10-min lock has expired
  const availabilityCondition: any = {
    OR: [
      { status: "OPEN" },
      {
        status: "PREVIEW_LOCKED",
        previewExpiresAt: { lte: now },
      },
    ],
  };

  const whereConditions: any[] = [availabilityCondition];

  if (filters.tier) {
    whereConditions.push({ tier: filters.tier });
  }

  if (filters.language) {
    whereConditions.push({
      language: { contains: filters.language, mode: "insensitive" },
    });
  }

  if (filters.search) {
    whereConditions.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { specificFiles: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }

  const where = { AND: whereConditions };

  const [totalCount, requests] = await Promise.all([
    prisma.codeReviewRequest.count({ where }),
    prisma.codeReviewRequest.findMany({
      where,
      skip,
      take: limit,
      include: {
        student: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    success: true,
    data: requests,
    meta: {
      page,
      limit,
      totalCount,
      totalPages,
    },
  };
};

export const codeReviewService = {
  createReviewRequest,
  updateCodeSnippet,
  previewLockReviewRequest,
  claimReviewRequest,
  submitReview,
  approveAndRelease,
  cancelReviewRequest,
  getOpenCodeReviewPool,
};
