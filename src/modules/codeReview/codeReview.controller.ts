import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { codeReviewService } from "./codeReview.service.js";

// 1. Create Request (Student)
const createReviewRequestHandler = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const result = await codeReviewService.createReviewRequest(studentId, req.body);
  sendSuccess(res, result.message, result.data, 201);
});

// 2. Update Code Snippet / Request Info (Student)
const updateCodeSnippetHandler = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const id = req.params.id as string;
  const result = await codeReviewService.updateCodeSnippet(studentId, id, req.body);
  sendSuccess(res, result.message, result.data, 200);
});

// 3. 10-Minute Temporary Preview Lock (Mentor)
const previewLockHandler = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const id = req.params.id as string;
  const result = await codeReviewService.previewLockReviewRequest(mentorId, id);
  sendSuccess(res, result.message, result.data, 200);
});

// 4. Claim Review Request (Mentor)
const claimReviewRequestHandler = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const id = req.params.id as string;
  const result = await codeReviewService.claimReviewRequest(mentorId, id);
  sendSuccess(res, result.message, result.data, 200);
});

// 5. Submit Review Delivery (Mentor)
const submitReviewHandler = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const id = req.params.id as string;
  const result = await codeReviewService.submitReview(mentorId, id, req.body);
  sendSuccess(res, result.message, result.data, 201);
});

// 6. Approve Review & Release 100% Credits (Student / Admin)
const approveAndReleaseHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = req.params.id as string;
  const result = await codeReviewService.approveAndRelease(userId, id);
  sendSuccess(res, result.message, result.data, 200);
});

// 7. Cancel Unclaimed Review Request (Student)
const cancelReviewRequestHandler = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const id = req.params.id as string;
  const result = await codeReviewService.cancelReviewRequest(studentId, id);
  sendSuccess(res, result.message, result.data, 200);
});

// 8. Get Open Pool Directory (Mentor / Admin)
const getOpenPoolHandler = catchAsync(async (req: Request, res: Response) => {
  const result = await codeReviewService.getOpenCodeReviewPool();
  sendSuccess(res, "Open code review requests retrieved successfully", result.data, 200);
});

export const codeReviewController = {
  createReviewRequestHandler,
  updateCodeSnippetHandler,
  previewLockHandler,
  claimReviewRequestHandler,
  submitReviewHandler,
  approveAndReleaseHandler,
  cancelReviewRequestHandler,
  getOpenPoolHandler,
};
