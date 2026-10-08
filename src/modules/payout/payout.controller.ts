import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { payoutService } from "./payout.service.js";
import type { PayoutStatusType } from "./payout.interface.js";

// 1. Mentor Creates Payout Request
const createPayoutRequestHandler = catchAsync(
  async (req: Request, res: Response) => {
    const mentorId = req.user!.id;
    const result = await payoutService.createPayoutRequest(mentorId, req.body);
    sendSuccess(res, result.message, result, 201);
  }
);

// 2. Mentor Gets Own Payout Requests History
const getMyPayoutRequestsHandler = catchAsync(
  async (req: Request, res: Response) => {
    const mentorId = req.user!.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await payoutService.getMyPayoutRequests(
      mentorId,
      page,
      limit
    );
    sendSuccess(res, "Payout requests fetched successfully", result);
  }
);

// 3. Admin Gets All Payout Requests (Queue)
const getAdminPayoutsHandler = catchAsync(
  async (req: Request, res: Response) => {
    const status = req.query.status as PayoutStatusType | undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await payoutService.getAdminPayouts({ status, page, limit });
    sendSuccess(res, "Admin payouts queue fetched successfully", result);
  }
);

// 4. Admin Processes Payout Request (Approve / Reject)
const processPayoutRequestHandler = catchAsync(
  async (req: Request, res: Response) => {
    const adminId = req.user!.id;
    const { id } = req.params;

    const result = await payoutService.processPayoutRequest(
      adminId,
      id as string,
      req.body
    );
    sendSuccess(res, result.message, result);
  }
);

export const payoutController = {
  createPayoutRequestHandler,
  getMyPayoutRequestsHandler,
  getAdminPayoutsHandler,
  processPayoutRequestHandler,
};
