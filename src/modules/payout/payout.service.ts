import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
  ICreatePayoutRequestInput,
  IProcessPayoutInput,
  IPayoutQueryFilters,
  PayoutStatusType,
} from "./payout.interface.js";

const CREDIT_RATE = 4;

// 1. Get or Initialize Platform Admin / Treasury Wallet
export const getTreasuryWallet = async (tx?: any) => {
  const db = tx || prisma;
  // Locate system administrator user
  const admin = await db.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    throw new AppError("System admin user account is required for platform treasury.", 500);
  }

  // Get or initialize admin wallet
  const treasuryWallet = await db.wallet.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
    },
    update: {},
  });

  return treasuryWallet;
};

// 2. Dynamic Platform Commission Percentage from DB
export const getPlatformCommissionPercent = async (tx?: any): Promise<number> => {
  const db = tx || prisma;
  const settings = await db.platformSetting.findFirst();
  return settings?.sessionCommissionPercent ?? 15;
};

// 3. Mentor Creates a Payout Request (deducts credits from wallet in escrow)
const createPayoutRequest = async (
  mentorId: string,
  payload: ICreatePayoutRequestInput
) => {
  const { amountBdt, method = "BKASH", accountNumber } = payload;
  const creditsRequired = Math.ceil(amountBdt / CREDIT_RATE);

  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    include: { wallet: true },
  });

  if (!mentor || (mentor.role !== "mentor" && mentor.role !== "admin")) {
    throw new AppError("Only verified mentors and administrators can request payouts.", 403);
  }

  const wallet = mentor.wallet;
  if (!wallet || wallet.balance < creditsRequired) {
    throw new AppError(
      `Insufficient credit balance. You need ${creditsRequired} Credits (৳${amountBdt.toLocaleString()}) to request this payout, but you only have ${wallet?.balance || 0} Credits available.`,
      400
    );
  }

  // Check if there is already a pending payout request for this mentor
  const existingPending = await prisma.payoutRequest.findFirst({
    where: {
      mentorId,
      status: "PENDING",
    },
  });

  if (existingPending) {
    throw new AppError(
      `You already have a pending payout request of ৳${existingPending.amountBdt.toLocaleString()} undergoing review. Please wait for it to be processed before submitting another.`,
      400
    );
  }

  const { payoutRequest, updatedWallet } = await prisma.$transaction(async (tx) => {
    // 1. Double-check wallet balance inside transaction lock
    const currentWallet = await tx.wallet.findUnique({
      where: { id: wallet.id },
    });

    if (!currentWallet || currentWallet.balance < creditsRequired) {
      throw new AppError(
        `Insufficient credit balance. Required: ${creditsRequired} Credits, Available: ${currentWallet?.balance || 0} Credits.`,
        400
      );
    }

    // 2. Deduct credits from wallet
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: creditsRequired },
      },
    });

    // 3. Create PayoutRequest
    const payoutRequest = await tx.payoutRequest.create({
      data: {
        mentorId,
        walletId: wallet.id,
        amountCredits: creditsRequired,
        amountBdt,
        method,
        accountNumber,
        status: "PENDING",
      },
      include: {
        mentor: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // 4. Log WITHDRAWAL CreditTransaction
    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -creditsRequired,
        type: "WITHDRAWAL",
        description: `Payout request created: ৳${amountBdt.toLocaleString()} (${creditsRequired} Credits) to ${method} ${accountNumber}`,
        referenceId: payoutRequest.id,
      },
    });

    return { payoutRequest, updatedWallet };
  });

  return {
    message: `Payout request of ৳${amountBdt.toLocaleString()} (${creditsRequired} Credits) submitted successfully! It is now pending administrator review.`,
    payoutRequest,
    wallet: updatedWallet,
  };
};

// 4. Mentor Fetches Own Payout Requests
const getMyPayoutRequests = async (mentorId: string, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [payouts, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { mentorId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.payoutRequest.count({ where: { mentorId } }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    data: payouts,
  };
};

// 5. Admin Fetches All Payout Requests (Filtered by status)
const getAdminPayouts = async (filters: IPayoutQueryFilters = {}) => {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (filters.status) {
    where.status = filters.status;
  }

  const [payouts, total, statusCounts, totalPendingBdt] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        mentor: {
          select: { id: true, name: true, email: true, image: true },
        },
        wallet: true,
        admin: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.payoutRequest.count({ where }),
    prisma.payoutRequest.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.payoutRequest.aggregate({
      where: { status: "PENDING" },
      _sum: { amountBdt: true, amountCredits: true },
    }),
  ]);

  const summary = {
    pendingCount: statusCounts.find((s) => s.status === "PENDING")?._count || 0,
    processedCount: statusCounts.find((s) => s.status === "PROCESSED")?._count || 0,
    rejectedCount: statusCounts.find((s) => s.status === "REJECTED")?._count || 0,
    totalPendingBdt: totalPendingBdt._sum.amountBdt || 0,
    totalPendingCredits: totalPendingBdt._sum.amountCredits || 0,
  };

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    summary,
    data: payouts,
  };
};

// 6. Admin Processes a Payout Request (Approve or Reject with automatic refund)
const processPayoutRequest = async (
  adminId: string,
  payoutRequestId: string,
  payload: IProcessPayoutInput
) => {
  const payoutRequest = await prisma.payoutRequest.findUnique({
    where: { id: payoutRequestId },
    include: {
      wallet: true,
      mentor: { select: { id: true, name: true, email: true } },
    },
  });

  if (!payoutRequest) {
    throw new AppError("Payout request not found", 404);
  }

  if (payoutRequest.status !== "PENDING") {
    throw new AppError(
      `This payout request has already been ${payoutRequest.status.toLowerCase()} on ${payoutRequest.processedAt?.toISOString()} and cannot be modified again.`,
      400
    );
  }

  const { status, rejectionReason } = payload;

  const result = await prisma.$transaction(async (tx) => {
    if (status === "PROCESSED") {
      // 1. Mark request as PROCESSED
      const updated = await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: "PROCESSED",
          processedBy: adminId,
          processedAt: new Date(),
        },
        include: {
          mentor: { select: { id: true, name: true, email: true, image: true } },
          admin: { select: { id: true, name: true, email: true } },
        },
      });

      // 2. Increment totalWithdrawn on mentor's wallet
      await tx.wallet.update({
        where: { id: payoutRequest.walletId },
        data: {
          totalWithdrawn: { increment: payoutRequest.amountBdt },
        },
      });

      return {
        message: `Payout request of ৳${payoutRequest.amountBdt.toLocaleString()} approved and marked as PROCESSED.`,
        payoutRequest: updated,
      };
    } else {
      // REJECTED Flow:
      // 1. Mark request as REJECTED with rejection reason
      const updated = await tx.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: "REJECTED",
          processedBy: adminId,
          processedAt: new Date(),
          rejectionReason: rejectionReason || "Declined by administrator",
        },
        include: {
          mentor: { select: { id: true, name: true, email: true, image: true } },
          admin: { select: { id: true, name: true, email: true } },
        },
      });

      // 2. Refund credits back to mentor wallet balance
      await tx.wallet.update({
        where: { id: payoutRequest.walletId },
        data: {
          balance: { increment: payoutRequest.amountCredits },
        },
      });

      // 3. Log WITHDRAWAL_REFUND transaction
      await tx.creditTransaction.create({
        data: {
          walletId: payoutRequest.walletId,
          amount: payoutRequest.amountCredits,
          type: "WITHDRAWAL_REFUND",
          description: `Payout refund: +${payoutRequest.amountCredits} Credits returned. Reason: ${rejectionReason || "Admin declined"}`,
          referenceId: payoutRequest.id,
        },
      });

      return {
        message: `Payout request rejected and ${payoutRequest.amountCredits} Credits successfully refunded to mentor's wallet.`,
        payoutRequest: updated,
      };
    }
  });

  return result;
};

export const payoutService = {
  getTreasuryWallet,
  getPlatformCommissionPercent,
  createPayoutRequest,
  getMyPayoutRequests,
  getAdminPayouts,
  processPayoutRequest,
};
