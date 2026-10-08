import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/apiError.js";
import type {
  ICreateExamInput,
  IUpdateExamInput,
  IAddQuestionInput,
} from "./exam.interface.js";

// 1. Create a new Exam
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

  questions.forEach((q, index) => {
    if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
      throw new AppError(
        `Question ${index + 1}: correctOptionIndex (${q.correctOptionIndex}) is out of bounds for ${q.options.length} options`,
        400
      );
    }
  });

  const createdQuestions = await prisma.$transaction(
    async (tx) => {
      const results = [];
      for (const q of questions) {
        const item = await tx.question.create({
          data: {
            examId,
            questionText: q.questionText,
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
            explanation: q.explanation || null,
            marks: q.marks || 1,
          },
        });
        results.push(item);
      }
      return results;
    },
    {
      maxWait: 10000,
      timeout: 25000,
    }
  );

  const allQuestions = await prisma.question.findMany({
    where: { examId },
  });

  const totalQuestionsCount = allQuestions.length;
  const computedTotalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);

  const updatedExam = await prisma.exam.update({
    where: { id: examId },
    data: {
      totalQuestions: totalQuestionsCount,
      totalMarks: computedTotalMarks,
      durationMinutes: totalQuestionsCount > 0 ? totalQuestionsCount : exam.durationMinutes,
    },
    include: {
      questions: true,
      _count: { select: { questions: true } },
    },
  });

  return {
    addedCount: createdQuestions.length,
    totalQuestions: totalQuestionsCount,
    totalMarks: computedTotalMarks,
    durationMinutes: updatedExam.durationMinutes,
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

// 3.1. Update Exam (Metadata and/or replacement Questions)
const updateExam = async (
  mentorId: string,
  examId: string,
  payload: IUpdateExamInput,
  userRole?: string
) => {
  const existingExam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: true,
      _count: { select: { attempts: true } },
    },
  });

  if (!existingExam) {
    throw new AppError("Exam not found", 404);
  }

  if (existingExam.mentorId !== mentorId && userRole !== "admin") {
    throw new AppError("You do not have permission to modify this exam", 403);
  }

  if (payload.cohortId) {
    const cohort = await prisma.cohortProgram.findUnique({
      where: { id: payload.cohortId },
    });
    if (!cohort) {
      throw new AppError("Target Cohort Program not found", 404);
    }
    if (cohort.mentorId !== mentorId && userRole !== "admin") {
      throw new AppError("You can only attach exams to your own Cohort Programs", 403);
    }
  }

  if (payload.sprintId) {
    const sprint = await prisma.sprintRequest.findUnique({
      where: { id: payload.sprintId },
    });
    if (!sprint) {
      throw new AppError("Target Sprint Request not found", 404);
    }
  }

  // Handle questions replacement if provided
  if (payload.questions && Array.isArray(payload.questions)) {
    payload.questions.forEach((q, index) => {
      if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
        throw new AppError(
          `Question ${index + 1}: correctOptionIndex (${q.correctOptionIndex}) is out of bounds for ${q.options.length} options`,
          400
        );
      }
    });

    await prisma.$transaction(
      async (tx) => {
        await tx.question.deleteMany({ where: { examId } });
        for (const q of payload.questions!) {
          await tx.question.create({
            data: {
              examId,
              questionText: q.questionText,
              options: q.options,
              correctOptionIndex: q.correctOptionIndex,
              explanation: q.explanation || null,
              marks: q.marks || 1,
            },
          });
        }
      },
      {
        maxWait: 10000,
        timeout: 25000,
      }
    );
  }

  // Fetch up-to-date questions to recompute marks & count
  const allQuestions = await prisma.question.findMany({
    where: { examId },
  });

  const totalQuestionsCount = allQuestions.length;
  const computedTotalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);

  const passMarkValue = payload.passMark ?? payload.passingMarks ?? existingExam.passMark;

  const updatedExam = await prisma.exam.update({
    where: { id: examId },
    data: {
      ...(payload.title !== undefined && { title: payload.title }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.isFree !== undefined && { isFree: payload.isFree }),
      ...(payload.cohortId !== undefined && { cohortId: payload.cohortId }),
      ...(payload.sprintId !== undefined && { sprintId: payload.sprintId }),
      ...(payload.status !== undefined && { status: payload.status }),
      passMark: passMarkValue,
      totalQuestions: totalQuestionsCount,
      totalMarks: payload.totalMarks !== undefined ? payload.totalMarks : computedTotalMarks,
      durationMinutes:
        payload.durationMinutes !== undefined
          ? payload.durationMinutes
          : totalQuestionsCount > 0
          ? totalQuestionsCount
          : existingExam.durationMinutes,
    },
    include: {
      cohort: { select: { id: true, title: true } },
      sprint: { select: { id: true, title: true } },
      questions: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });

  return updatedExam;
};

// 3.2. Delete or Soft-Delete / Archive Exam
const deleteExam = async (mentorId: string, examId: string, userRole?: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      _count: { select: { attempts: true } },
    },
  });

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  if (exam.mentorId !== mentorId && userRole !== "admin") {
    throw new AppError("You do not have permission to delete this exam", 403);
  }

  // If exam already has student attempts, archive it to preserve academic audit records
  if (exam._count.attempts > 0) {
    const archivedExam = await prisma.exam.update({
      where: { id: examId },
      data: { status: "ARCHIVED" },
    });
    return {
      message: "Exam has recorded student attempts; safely archived and unpublished.",
      archived: true,
      exam: archivedExam,
    };
  }

  // No student attempts exist: permanently remove
  await prisma.exam.delete({
    where: { id: examId },
  });

  return {
    message: "Exam deleted successfully",
    deleted: true,
  };
};

// 3.3. Get Single Exam By ID
const getExamById = async (examId: string, userId?: string, userRole?: string) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      mentor: { select: { id: true, name: true, email: true, image: true } },
      cohort: { select: { id: true, title: true } },
      sprint: { select: { id: true, title: true } },
      questions: true,
      _count: { select: { questions: true, attempts: true } },
    },
  });

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  const isOwnerOrAdmin = (userId && exam.mentorId === userId) || userRole === "admin";
  if (!isOwnerOrAdmin) {
    return {
      ...exam,
      questions: exam.questions.map((q) => ({
        id: q.id,
        examId: q.examId,
        questionText: q.questionText,
        options: q.options,
        correctOptionIndex: -1,
        explanation: null,
        marks: q.marks,
      })),
    };
  }

  return exam;
};

// 3.4. Update Single Question in Exam
const updateQuestion = async (
  mentorId: string,
  examId: string,
  questionId: string,
  payload: Partial<IAddQuestionInput>,
  userRole?: string
) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
  });

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  if (exam.mentorId !== mentorId && userRole !== "admin") {
    throw new AppError("You do not have permission to modify questions for this exam", 403);
  }

  const question = await prisma.question.findFirst({
    where: { id: questionId, examId },
  });

  if (!question) {
    throw new AppError("Question not found in this exam", 404);
  }

  const finalOptions = payload.options || question.options;
  const finalCorrectIndex =
    payload.correctOptionIndex !== undefined
      ? payload.correctOptionIndex
      : question.correctOptionIndex;

  if (finalCorrectIndex < 0 || finalCorrectIndex >= finalOptions.length) {
    throw new AppError(
      `correctOptionIndex (${finalCorrectIndex}) is out of bounds for ${finalOptions.length} options`,
      400
    );
  }

  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      ...(payload.questionText && { questionText: payload.questionText }),
      ...(payload.options && { options: payload.options }),
      ...(payload.correctOptionIndex !== undefined && {
        correctOptionIndex: payload.correctOptionIndex,
      }),
      ...(payload.explanation !== undefined && { explanation: payload.explanation }),
      ...(payload.marks !== undefined && { marks: payload.marks }),
    },
  });

  // Recompute totalMarks
  const allQuestions = await prisma.question.findMany({ where: { examId } });
  const totalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);
  await prisma.exam.update({
    where: { id: examId },
    data: { totalMarks },
  });

  return updatedQuestion;
};

// 3.5. Delete Single Question from Exam
const deleteQuestion = async (
  mentorId: string,
  examId: string,
  questionId: string,
  userRole?: string
) => {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
  });

  if (!exam) {
    throw new AppError("Exam not found", 404);
  }

  if (exam.mentorId !== mentorId && userRole !== "admin") {
    throw new AppError("You do not have permission to delete questions from this exam", 403);
  }

  const question = await prisma.question.findFirst({
    where: { id: questionId, examId },
  });

  if (!question) {
    throw new AppError("Question not found in this exam", 404);
  }

  await prisma.question.delete({
    where: { id: questionId },
  });

  const remainingQuestions = await prisma.question.findMany({ where: { examId } });
  const totalQuestions = remainingQuestions.length;
  const totalMarks = remainingQuestions.reduce((sum, q) => sum + q.marks, 0);

  await prisma.exam.update({
    where: { id: examId },
    data: {
      totalQuestions,
      totalMarks,
      durationMinutes: totalQuestions > 0 ? totalQuestions : exam.durationMinutes,
    },
  });

  return { message: "Question deleted successfully", totalQuestions, totalMarks };
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

// 6. Start Exam Attempt
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
      questions: exam.questions,
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
  updateExam,
  deleteExam,
  getExamById,
  updateQuestion,
  deleteQuestion,
  getMentorExams,
  getAvailableExams,
  startExamAttempt,
  submitExamAttempt,
  getStudentAttempts,
};

