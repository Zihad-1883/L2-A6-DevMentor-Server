import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { examService } from "./exam.service.js";

// 1. Create Exam Controller
const createExamController = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const result = await examService.createExam(mentorId, req.body);

  sendSuccess(res, "Exam created successfully in DRAFT mode", result, 201);
});

// 2. Add Questions Controller
const addQuestionsController = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { examId } = req.params;
  const result = await examService.addQuestionsToExam(mentorId, examId as string, req.body.questions);

  sendSuccess(res, `${result.addedCount} question(s) added successfully to exam`, result.exam);
});

// 3. Publish Exam Controller
const publishExamController = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const { examId } = req.params;
  const result = await examService.publishExam(mentorId, examId as string);

  sendSuccess(res, "Exam published successfully and is now active for students", result);
});

// 4. Get Mentor Exams Controller
const getMentorExamsController = catchAsync(async (req: Request, res: Response) => {
  const mentorId = req.user!.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await examService.getMentorExams(mentorId, page, limit);

  sendSuccess(res, "Mentor exams fetched successfully", result);
});

export const examController = {
  createExamController,
  addQuestionsController,
  publishExamController,
  getMentorExamsController,
};
