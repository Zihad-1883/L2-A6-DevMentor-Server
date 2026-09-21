/**
 * @file src/modules/admin/admin.controller.ts
 * @description HTTP controllers for Admin governance, mentor/cohort approvals, and user management.
 */

import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { adminService } from "./admin.service.js";

// ── 1. Approve or Reject Mentor Application ──────────────────────────────────
const approveOrRejectMentor = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const id = req.params.id as string;
  const result = await adminService.approveOrRejectMentor(adminId, id, req.body);
  sendSuccess(res, `Mentor application status updated to ${result.approvalStatus}`, result);
});

// ── 2. Toggle User Block Status ───────────────────────────────────────────────
const toggleUserBlock = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const id = req.params.id as string;
  const result = await adminService.toggleUserBlock(adminId, id, req.body);
  sendSuccess(res, `User account ${result.isBlocked ? "blocked" : "unblocked"} successfully`, result);
});

// ── 3. Get All Users Directory ────────────────────────────────────────────────
const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.getAllUsers(req.query);
  sendSuccess(res, "Users directory fetched successfully", result);
});

// ── 4. Approve or Reject Mentor Cohort Program ────────────────────────────────
const approveOrRejectCohort = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const id = req.params.id as string;
  const result = await adminService.approveOrRejectCohort(adminId, id, req.body);
  sendSuccess(res, `Cohort program status updated to ${result.status}`, result);
});

export const adminController = {
  approveOrRejectMentor,
  toggleUserBlock,
  getAllUsers,
  approveOrRejectCohort,
};

