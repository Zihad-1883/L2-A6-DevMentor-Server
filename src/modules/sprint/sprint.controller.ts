import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { sprintService } from "./sprint.service.js";

// 1. Create Sprint Request
const createSprint = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const result = await sprintService.createSprint(studentId, req.body);
  sendSuccess(res, "Sprint request created successfully", result, 201);
});

// 2. Get Open Sprint Pool
const getOpenSprintPool = catchAsync(async (req: Request, res: Response) => {
  const result = await sprintService.getOpenSprintPool(req.query);
  sendSuccess(res, "Open sprint pool fetched successfully", result);
});

// 3. Claim Sprint Request
const claimSprint = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { sprintId } = req.params;
  const result = await sprintService.claimSprint(sprintId as string, mentorId);
  sendSuccess(res, "Sprint request claimed successfully", result);
});

// 4. Get Single Sprint By ID
const getSprintById = catchAsync(async (req: Request, res: Response) => {
  const { sprintId } = req.params;
  const userId = req.user!.id;
  const result = await sprintService.getSprintById(sprintId as string, userId);
  sendSuccess(res, "Sprint request details fetched successfully", result);
});

// 5. Get User's Own Sprints
const getUserSprints = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const role = req.user!.role;
  const result = await sprintService.getUserSprints(userId, role);
  sendSuccess(res, "User sprints fetched successfully", result);
});

// 6. Update Sprint Request
const updateSprint = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const { sprintId } = req.params;
  const result = await sprintService.updateSprint(sprintId as string, studentId, req.body);
  sendSuccess(res, "Sprint request updated successfully", result);
});

// 7. Delete / Cancel Sprint Request
const deleteSprint = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const { sprintId } = req.params;
  const result = await sprintService.deleteSprint(sprintId as string, studentId);
  sendSuccess(res, result.message, result);
});

export const sprintController = {
  createSprint,
  getOpenSprintPool,
  claimSprint,
  getSprintById,
  getUserSprints,
  updateSprint,
  deleteSprint,
};
