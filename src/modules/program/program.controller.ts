import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { programService } from "./program.service.js";

// 1. Create Program
const createProgram = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const result = await programService.createProgram(mentorId, req.body);
  sendSuccess(res, "Program created successfully", result, 201);
});

// 2. Get All Programs (Search, Filter, Pagination)
const getPrograms = catchAsync(async (req: Request, res: Response) => {
  const result = await programService.getPrograms(req.query as any);
  sendSuccess(res, "Programs retrieved successfully", result);
});

// 3. Get Single Program By ID
const getProgramById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await programService.getProgramById(id);
  sendSuccess(res, "Program details retrieved successfully", result);
});

// 4. Get Mentor Programs
const getMentorPrograms = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const result = await programService.getMentorPrograms(mentorId);
  sendSuccess(res, "Mentor programs retrieved successfully", result);
});

// 5. Update Program
const updateProgram = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const mentorId = req.user!.id;
  const result = await programService.updateProgram(id, mentorId, req.body);
  sendSuccess(res, "Program updated successfully", result);
});

// 6. Soft Delete Program
const deleteProgram = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const mentorId = req.user!.id;
  const result = await programService.deleteProgram(id, mentorId);
  sendSuccess(res, "Program deleted successfully", result);
});


export const programController = {
  createProgram,
  getPrograms,
  getProgramById,
  getMentorPrograms,
  updateProgram,
  deleteProgram,
};
