import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
    ICreateExamInput,
    IUpdateExamInput,
    IAddQuestionInput,
} from "./exam.interface.js";

// 1. Create a new Exam (Free, Cohort-linked, or Sprint-linked)
const createExam = async (mentorId: string, payload: ICreateExamInput) => {
    const {
        title,
        description,
        durationMinutes = 30,
        totalMarks = 100,
        passMark = 70,
        isFree = true,
        cohortId,
        sprintId,
    } = payload;

    // Validate Cohort ownership if cohortId is provided
    if (cohortId) {
        const cohort = await prisma.cohortProgram.findUnique({
            where: { id: cohortId },
        });
        if (!cohort) {
            throw new AppError("Target Cohort Program not found", 404);
        }
        if (cohort.mentorId !== mentorId) {
            throw new AppError("You can only attach exams to your own Cohort Programs", 403);
        }
    }

    // Validate Sprint existence if sprintId is provided
    if (sprintId) {
        const sprint = await prisma.sprintRequest.findUnique({
            where: { id: sprintId },
        });
        if (!sprint) {
            throw new AppError("Target Sprint Request not found", 404);
        }
    }

    const exam = await prisma.exam.create({
        data: {
            mentorId,
            title,
            description,
            durationMinutes,
            totalMarks,
            passMark,
            isFree: cohortId || sprintId ? false : isFree,
            cohortId: cohortId || null,
            sprintId: sprintId || null,
            status: "DRAFT",
        },
        include: {
            cohort: { select: { id: true, title: true } },
            sprint: { select: { id: true, title: true } },
        },
    });

    return exam;
};

// 2. Add or Bulk Upload MCQs to an Exam
const addQuestionsToExam = async (
    mentorId: string,
    examId: string,
    questions: IAddQuestionInput[]
) => {
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
    });

    if (!exam) {
        throw new AppError("Exam not found", 404);
    }

    if (exam.mentorId !== mentorId) {
        throw new AppError("You do not have permission to modify questions for this exam", 403);
    }

    if (exam.status === "ARCHIVED") {
        throw new AppError("Cannot add questions to an archived exam", 400);
    }

    // Validate option bounds for each question
    questions.forEach((q, index) => {
        if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
            throw new AppError(
                `Question ${index + 1}: correctOptionIndex (${q.correctOptionIndex}) is out of bounds for ${q.options.length} options`,
                400
            );
        }
    });

    const createdQuestions = await prisma.$transaction(
        questions.map((q) =>
            prisma.question.create({
                data: {
                    examId,
                    questionText: q.questionText,
                    options: q.options,
                    correctOptionIndex: q.correctOptionIndex,
                    explanation: q.explanation || null,
                    marks: q.marks || 5,
                },
            })
        )
    );

    const updatedExam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
            questions: true,
            _count: { select: { questions: true } },
        },
    });

    return {
        addedCount: createdQuestions.length,
        exam: updatedExam,
    };
};

// 3. Publish Exam (Activates the exam for students)
const publishExam = async (mentorId: string, examId: string) => {
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
            _count: { select: { questions: true } },
        },
    });

    if (!exam) {
        throw new AppError("Exam not found", 404);
    }

    if (exam.mentorId !== mentorId) {
        throw new AppError("You do not have permission to publish this exam", 403);
    }

  if (exam.status === "PUBLISHED") {
    throw new AppError("Exam is already published", 400);
  }

    if (exam._count.questions === 0) {
        throw new AppError("Cannot publish an exam with 0 questions. Please add questions first.", 400);
    }

    const publishedExam = await prisma.exam.update({
        where: { id: examId },
        data: { status: "PUBLISHED" },
        include: {
            questions: true,
            _count: { select: { questions: true, attempts: true } },
        },
    });

    return publishedExam;
};

// 4. Get Mentor's Created Exams with Statistics
const getMentorExams = async (
    mentorId: string,
    page: number = 1,
    limit: number = 10
) => {
    const skip = (page - 1) * limit;

    const [exams, total] = await Promise.all([
        prisma.exam.findMany({
            where: { mentorId },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                cohort: { select: { id: true, title: true } },
                sprint: { select: { id: true, title: true } },
                _count: { select: { questions: true, attempts: true } },
            },
        }),
        prisma.exam.count({ where: { mentorId } }),
    ]);

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: exams,
    };
};

// 5. Get Available Exams for Student (Free public exams + enrolled cohort & sprint exams)
const getAvailableExams = async (
  studentId: string,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  // Fetch student's cohort enrollments and sprint requests
  const [cohortEnrollments, sprintRequests] = await Promise.all([
    prisma.cohortEnrollment.findMany({
      where: { studentId },
      select: { cohortId: true },
    }),
    prisma.sprintRequest.findMany({
      where: { studentId },
      select: { id: true },
    }),
  ]);

  const cohortIds = cohortEnrollments.map((c) => c.cohortId);
  const sprintIds = sprintRequests.map((s) => s.id);

  const whereClause = {
    status: "PUBLISHED" as const,
    OR: [
      { isFree: true },
      { cohortId: { in: cohortIds } },
      { sprintId: { in: sprintIds } },
    ],
  };

  const [exams, total] = await Promise.all([
    prisma.exam.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        mentor: { select: { id: true, name: true, image: true } },
        cohort: { select: { id: true, title: true } },
        sprint: { select: { id: true, title: true } },
        _count: { select: { questions: true } },
      },
    }),
    prisma.exam.count({ where: whereClause }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: exams,
  };
};

// 6. Start Exam Attempt (Sanitizes questions by hiding correctOptionIndex to prevent cheating)
const startExamAttempt = async (studentId: string, examId: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      mentor: { select: { id: true, name: true } },
      questions: {
        select: {
          id: true,
          questionText: true,
          options: true,
          marks: true,
        },
      },
    },
  });

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  if (exam.status !== "PUBLISHED") {
    throw new AppError("This exam is not currently active or published", 400);
  }

  // Check eligibility if exam is paid/restricted
  if (!exam.isFree) {
    let isEligible = false;

    if (exam.cohortId) {
      const enrollment = await prisma.cohortEnrollment.findUnique({
        where: {
          cohortId_studentId: { cohortId: exam.cohortId, studentId },
        },
      });
      if (enrollment) isEligible = true;
    }

    if (exam.sprintId) {
      const sprint = await prisma.sprintRequest.findFirst({
        where: { id: exam.sprintId, studentId },
      });
      if (sprint) isEligible = true;
    }

    if (!isEligible) {
      throw new AppError(
        "You are not enrolled in the Cohort or Sprint required to take this exam",
        403
      );
    }
  }

  // Create an active ExamAttempt record
  const attempt = await prisma.examAttempt.create({
    data: {
      examId,
      studentId,
      startedAt: new Date(),
      answers: [],
    },
  });

  return {
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    exam: {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      passMark: exam.passMark,
      mentor: exam.mentor,
      questions: exam.questions, // Sanitized: correctOptionIndex & explanation are NOT included
    },
  };
};

// 7. Submit Exam Attempt & Auto-Evaluate
const submitExamAttempt = async (
  studentId: string,
  examId: string,
  submittedAnswers: { questionId: string; selectedOption: number }[]
) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: true,
    },
  });

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  // Fetch or find active attempt
  const attempt = await prisma.examAttempt.findFirst({
    where: { examId, studentId, submittedAt: null },
    orderBy: { startedAt: "desc" },
  });

  let totalEarnedScore = 0;
  const answerBreakdown = exam.questions.map((q) => {
    const studentAns = submittedAnswers.find((a) => a.questionId === q.id);
    const selectedOption = studentAns ? studentAns.selectedOption : -1;
    const isCorrect = selectedOption === q.correctOptionIndex;

    if (isCorrect) {
      totalEarnedScore += q.marks;
    }

    return {
      questionId: q.id,
      questionText: q.questionText,
      options: q.options,
      selectedOption,
      correctOptionIndex: q.correctOptionIndex,
      isCorrect,
      marksEarned: isCorrect ? q.marks : 0,
      totalMarks: q.marks,
      explanation: q.explanation,
    };
  });

  const passMark = exam.passMark ?? 70;
  const percentage = Math.round((totalEarnedScore / exam.totalMarks) * 100 * 100) / 100;
  const isPassed = percentage >= passMark;

  let updatedAttempt;
  if (attempt) {
    updatedAttempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        score: totalEarnedScore,
        percentage,
        isPassed,
        submittedAt: new Date(),
        answers: answerBreakdown as any,
      },
    });
  } else {
    updatedAttempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        score: totalEarnedScore,
        percentage,
        isPassed,
        startedAt: new Date(),
        submittedAt: new Date(),
        answers: answerBreakdown as any,
      },
    });
  }

  return {
    attemptId: updatedAttempt.id,
    score: totalEarnedScore,
    totalMarks: exam.totalMarks,
    percentage,
    passMark: exam.passMark,
    isPassed,
    submittedAt: updatedAttempt.submittedAt,
    breakdown: answerBreakdown,
  };
};

// 8. Get Student's Past Exam Attempts & Scores
const getStudentAttempts = async (
  studentId: string,
  page: number = 1,
  limit: number = 10
) => {
  const skip = (page - 1) * limit;

  const [attempts, total] = await Promise.all([
    prisma.examAttempt.findMany({
      where: { studentId },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            passMark: true,
            mentor: { select: { name: true } },
          },
        },
      },
    }),
    prisma.examAttempt.count({ where: { studentId } }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: attempts,
  };
};

export const examService = {
  createExam,
  addQuestionsToExam,
  publishExam,
  getMentorExams,
  getAvailableExams,
  startExamAttempt,
  submitExamAttempt,
  getStudentAttempts,
};

