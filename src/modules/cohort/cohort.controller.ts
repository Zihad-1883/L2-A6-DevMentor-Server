/**
 * @file src/modules/cohort/cohort.controller.ts
 * @description HTTP Request Controllers for Mentor Cohort Program operations.
 */

import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { cohortService } from "./cohort.service.js";

// ── 1. Create Cohort Program (Mentor Only) ────────────────────────────────────
const createCohort = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const result = await cohortService.createCohort(mentorId, req.body);
  sendSuccess(res, "Cohort program created successfully (pending admin approval)", result, 201);
});

// ── 2. Get All Published Cohorts (Public Directory) ───────────────────────────
const getAllPublishedCohorts = catchAsync(async (req: Request, res: Response) => {
  const result = await cohortService.getAllPublishedCohorts(req.query);
  sendSuccess(res, "Published cohort programs fetched successfully", result);
});

// ── 3. Get Single Cohort By ID ────────────────────────────────────────────────
const getCohortById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await cohortService.getCohortById(id as string);
  sendSuccess(res, "Cohort program details fetched successfully", result);
});

// ── 4. Get Mentor's Created Cohorts ───────────────────────────────────────────
const getMyCreatedCohorts = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const result = await cohortService.getMyCreatedCohorts(mentorId);
  sendSuccess(res, "Mentor created cohorts fetched successfully", result);
});

// ── 5. Update Cohort Program ──────────────────────────────────────────────────
const updateCohort = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { id } = req.params;
  const result = await cohortService.updateCohort(id as string, mentorId, req.body);
  sendSuccess(res, "Cohort program updated successfully", result);
});

// ── 6. Soft Delete Cohort Program ─────────────────────────────────────────────
const deleteCohort = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { id } = req.params;
  const result = await cohortService.deleteCohort(id as string, mentorId);
  sendSuccess(res, result.message, result);
});

// ── 7. Register Student for Cohort Program ────────────────────────────────────
const registerCohort = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const { id } = req.params;
  const result = await cohortService.registerCohort(id as string, studentId);
  sendSuccess(res, "Enrolled in cohort program successfully", result, 201);
});

export const cohortController = {
  createCohort,
  getAllPublishedCohorts,
  getCohortById,
  getMyCreatedCohorts,
  updateCohort,
  deleteCohort,
  registerCohort,
};

