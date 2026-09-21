/**
 * @file src/modules/cohortSession/cohortSession.controller.ts
 * @description HTTP Controllers for Cohort Group Session management and resources.
 */

import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { cohortSessionService } from "./cohortSession.service.js";

// ── 1. Add Session to Cohort (Mentor Only) ───────────────────────────────────
const addCohortSession = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { cohortId } = req.params;
  const result = await cohortSessionService.addCohortSession(cohortId as string, mentorId, req.body);
  sendSuccess(res, "Cohort session created successfully", result, 201);
});

// ── 2. Get Cohort Sessions (Gated Access for Unpaid vs Mentor/Paid) ───────────
const getCohortSessions = catchAsync(async (req: Request, res: Response) => {
  const { cohortId } = req.params;
  const userId = req.user?.id;
  const result = await cohortSessionService.getCohortSessions(cohortId as string, userId);
  sendSuccess(res, "Cohort sessions fetched successfully", result);
});

// ── 3. Update Cohort Session (Mentor Only) ───────────────────────────────────
const updateCohortSession = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.updateCohortSession(sessionId as string, mentorId, req.body);
  sendSuccess(res, "Cohort session updated successfully", result);
});

// ── 4. Delete Cohort Session (Mentor Only) ───────────────────────────────────
const deleteCohortSession = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.deleteCohortSession(sessionId as string, mentorId);
  sendSuccess(res, result.message, result);
});

// ── 5. Add Single Resource to Session (Mentor Only) ──────────────────────────
const addSessionResource = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.addSessionResource(sessionId as string, mentorId, req.body);
  sendSuccess(res, "Resource added to session successfully", result, 201);
});

// ── 6. Remove Single Resource from Session (Mentor Only) ──────────────────────
const removeSessionResource = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { sessionId, resourceId } = req.params;
  const result = await cohortSessionService.removeSessionResource(
    sessionId as string,
    mentorId,
    resourceId as string,
  );
  sendSuccess(res, result.message, result);
});

// ── 7. Join Session with Credits (Student Only) ──────────────────────────────
const joinCohortSession = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.joinCohortSession(sessionId as string, studentId);
  sendSuccess(res, result.message, result, 201);
});

// ── 8. Mark Session as Completed (Mentor Only) ──────────────────────────────
const completeCohortSession = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.completeCohortSession(sessionId as string, mentorId);
  sendSuccess(res, typeof result.message === "string" ? result.message : "Cohort session marked as completed", result);
});

// ── 9. Cancel Session & Refund Escrow (Mentor Only) ─────────────────────────
const cancelCohortSession = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { sessionId } = req.params;
  const result = await cohortSessionService.cancelCohortSession(sessionId as string, mentorId);
  sendSuccess(res, result.message, result);
});

export const cohortSessionController = {
  addCohortSession,
  getCohortSessions,
  updateCohortSession,
  deleteCohortSession,
  addSessionResource,
  removeSessionResource,
  joinCohortSession,
  completeCohortSession,
  cancelCohortSession,
};

