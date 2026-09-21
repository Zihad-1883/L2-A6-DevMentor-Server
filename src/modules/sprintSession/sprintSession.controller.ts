import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { sprintSessionService } from "./sprintSession.service.js";

// 1. Mentor Proposes Session Slot
const proposeSprintSessionSlot = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const sessionId = req.params.sessionId as string;
  const result = await sprintSessionService.proposeSprintSessionSlot(sessionId, mentorId, req.body);
  sendSuccess(res, "Sprint session time slot proposed successfully", result);
});

// 2. Student Confirms Session Slot & Pays Credits
const confirmSprintSession = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const sessionId = req.params.sessionId as string;
  const result = await sprintSessionService.confirmSprintSession(sessionId, studentId);
  sendSuccess(res, result.message, result.session);
});

// 3. Complete Sprint Session
const completeSprintSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const sessionId = req.params.sessionId as string;
  const result = await sprintSessionService.completeSprintSession(sessionId, userId);
  sendSuccess(res, result.message, result.session);
});

// 4. Cancel Sprint Session (1-Hour Cutoff Rule)
const cancelSprintSession = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const sessionId = req.params.sessionId as string;
  const result = await sprintSessionService.cancelSprintSession(sessionId, userId);
  sendSuccess(res, result.message, {
    refundIssued: result.refundIssued,
    session: result.session,
  });
});

// 5. Get Sessions for a Sprint Request
const getSprintSessionsBySprintId = catchAsync(async (req: Request, res: Response) => {
  const sprintId = req.params.sprintId as string;
  const result = await sprintSessionService.getSprintSessionsBySprintId(sprintId);
  sendSuccess(res, "Sprint sessions fetched successfully", result);
});

export const sprintSessionController = {
  proposeSprintSessionSlot,
  confirmSprintSession,
  completeSprintSession,
  cancelSprintSession,
  getSprintSessionsBySprintId,
};
