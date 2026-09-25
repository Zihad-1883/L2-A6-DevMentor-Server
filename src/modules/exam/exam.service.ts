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

export const examService = {
    createExam,
    addQuestionsToExam,
    publishExam,
    getMentorExams,
};
