/**
 * @file src/modules/user/user.controller.ts
 * @description HTTP Controllers for User profile view, profile updates, and dashboard summary.
 */

import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { userService } from "./user.service.js";

// ── 1. Get Logged-In User Profile ────────────────────────────────────────────
const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await userService.getMyProfile(userId);
  sendSuccess(res, "User profile fetched successfully", result);
});

// ── 2. Update Logged-In User Profile ─────────────────────────────────────────
const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await userService.updateMyProfile(userId, req.body);
  sendSuccess(res, "User profile updated successfully", result);
});

// ── 3. Get User Summary Dashboard ─────────────────────────────────────────────
const getMyDashboard = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await userService.getMyDashboard(userId);
  sendSuccess(res, "User dashboard summary fetched successfully", result);
});

export const userController = {
  getMyProfile,
  updateMyProfile,
  getMyDashboard,
};

