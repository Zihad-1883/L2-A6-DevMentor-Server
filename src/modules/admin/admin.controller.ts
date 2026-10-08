import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { adminService } from "./admin.service.js";

// 1. Approve or Reject Mentor Application
const approveOrRejectMentor = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const id = req.params.id as string;
  const result = await adminService.approveOrRejectMentor(adminId, id, req.body);
  sendSuccess(res, `Mentor application status updated to ${result.approvalStatus}`, result);
});

// 2. Toggle User Block Status
const toggleUserBlock = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const id = req.params.id as string;
  const result = await adminService.toggleUserBlock(adminId, id, req.body);
  sendSuccess(res, `User account ${result.isBlocked ? "blocked" : "unblocked"} successfully`, result);
});

// 3. Get All Users Directory
const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.getAllUsers(req.query);
  sendSuccess(res, "Users directory fetched successfully", result);
});

// 4. Approve or Reject Mentor Cohort Program 
const approveOrRejectCohort = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const id = req.params.id as string;
  const result = await adminService.approveOrRejectCohort(adminId, id, req.body);
  sendSuccess(res, `Cohort program approval status updated to ${result.approvalStatus}`, result);
});

// 5. Get All Cohort Submissions (Admin Queue)
const getAllCohorts = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.getAdminCohorts(req.query);
  sendSuccess(res, "Admin cohorts fetched successfully", result);
});

// 6. Aggregate Real-Time Platform Overview Statistics
const getPlatformStats = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.getPlatformStats();
  sendSuccess(res, "Platform overview statistics fetched successfully", result);
});

// 7. Get Platform Settings (Singleton)
const getPlatformSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.getPlatformSettings();
  sendSuccess(res, "Platform settings fetched successfully", result);
});

// 8. Update Platform Settings
const updatePlatformSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.updatePlatformSettings(req.body);
  sendSuccess(res, "Platform settings updated successfully", result);
});

export const adminController = {
  approveOrRejectMentor,
  toggleUserBlock,
  getAllUsers,
  approveOrRejectCohort,
  getAllCohorts,
  getPlatformStats,
  getPlatformSettings,
  updatePlatformSettings,
};


