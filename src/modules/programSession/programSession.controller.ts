import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { programSessionService } from "./programSession.service.js";

// 1. Add Session to Program
const addSessionToProgram = catchAsync(async (req: Request, res: Response) => {
  const programId = req.params.programId as string;
  const mentorId = req.user!.id;
  const result = await programSessionService.addSessionToProgram(programId, mentorId, req.body);
  sendSuccess(res, "Session added to program successfully", result, 201);
});

// 2. Update Session
const updateSession = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const mentorId = req.user!.id;
  const result = await programSessionService.updateSession(sessionId, mentorId, req.body);
  sendSuccess(res, "Session updated successfully", result);
});

// 3. Delete Session
const deleteSession = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const mentorId = req.user!.id;
  const result = await programSessionService.deleteSession(sessionId, mentorId);
  sendSuccess(res, "Session removed successfully", result);
});

// 4. Book Session
const bookSession = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const userId = req.user!.id;
  const result = await programSessionService.bookSession(sessionId, userId, req.body);
  sendSuccess(res, "Session booked successfully", result);
});

// 5. Cancel Session
const cancelSession = catchAsync(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const userId = req.user!.id;
  const result = await programSessionService.cancelSession(sessionId, userId);
  sendSuccess(res, result.message, result);
});


export const programSessionController = {
  addSessionToProgram,
  updateSession,
  deleteSession,
  bookSession,
  cancelSession,
};
