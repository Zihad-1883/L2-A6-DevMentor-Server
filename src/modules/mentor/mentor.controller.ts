/**
 * @file src/modules/mentor/mentor.controller.ts
 * @description HTTP Controllers for Mentor application & directory endpoints.
 */

import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { mentorService } from "./mentor.service.js";

// ── 1. Apply for Mentor Role (Authenticated Student) ─────────────────────────
const applyForMentor = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await mentorService.applyForMentor(userId, req.body);
  sendSuccess(res, result.message, result.mentorProfile, 201);
});

// ── 2. Get Approved Mentors Public Directory ──────────────────────────────────
const getApprovedMentors = catchAsync(async (req: Request, res: Response) => {
  const result = await mentorService.getApprovedMentors(req.query);
  sendSuccess(res, "Approved mentors fetched successfully", result);
});

// ── 3. Get Single Mentor Profile Details ──────────────────────────────────────
const getMentorById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await mentorService.getMentorById(id as string);
  sendSuccess(res, "Mentor profile fetched successfully", result);
});

export const mentorController = {
  applyForMentor,
  getApprovedMentors,
  getMentorById,
};

