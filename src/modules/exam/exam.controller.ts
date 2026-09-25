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

// 5. Get Available Exams Controller (Students)
const getAvailableExamsController = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await examService.getAvailableExams(studentId, page, limit);

  sendSuccess(res, "Available exams fetched successfully", result);
});

// 6. Start Exam Attempt Controller (Sanitized)
const startExamAttemptController = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const { examId } = req.params;

  const result = await examService.startExamAttempt(studentId, examId as string);

  sendSuccess(res, "Exam attempt started successfully. Good luck!", result);
});

// 7. Submit Exam Attempt & Auto-Evaluate Controller
const submitExamAttemptController = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const { examId } = req.params;
  const { answers } = req.body;

  const result = await examService.submitExamAttempt(studentId, examId as string, answers);

  sendSuccess(res, "Exam submitted and evaluated successfully", result);
});

// 8. Get Student Attempts Controller
const getStudentAttemptsController = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user!.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await examService.getStudentAttempts(studentId, page, limit);

  sendSuccess(res, "Student exam attempts fetched successfully", result);
});

export const examController = {
  createExamController,
  addQuestionsController,
  publishExamController,
  getMentorExamsController,
  getAvailableExamsController,
  startExamAttemptController,
  submitExamAttemptController,
  getStudentAttemptsController,
};

