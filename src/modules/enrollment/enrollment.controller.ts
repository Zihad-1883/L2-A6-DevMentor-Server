/**
 * @file src/modules/enrollment/enrollment.controller.ts
 * @description HTTP controllers for student enrollment queries.
 */

import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { enrollmentService } from "./enrollment.service.js";

// ── 1. Get Student Enrolled Cohorts ───────────────────────────────────────────
const getMyEnrolledCohorts = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const result = await enrollmentService.getMyEnrolledCohorts(studentId, req.query);
  sendSuccess(res, "Student enrolled cohorts fetched successfully", result);
});

// ── 2. Get Student Sprint Requests ───────────────────────────────────────────
const getMyEnrolledSprints = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const result = await enrollmentService.getMyEnrolledSprints(studentId, req.query);
  sendSuccess(res, "Student sprint requests fetched successfully", result);
});

export const enrollmentController = {
  getMyEnrolledCohorts,
  getMyEnrolledSprints,
};

