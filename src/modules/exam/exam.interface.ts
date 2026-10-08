import { ExamStatus } from "../../generated/prisma/enums";

export interface ICreateExamInput {
  title: string;
  description?: string;
  durationMinutes?: number;
  totalMarks?: number;
  passMark?: number;
  isFree?: boolean;
  cohortId?: string;
  sprintId?: string;
}

export interface IQuestionInput {
  id?: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string | null;
  marks?: number;
}

export interface IUpdateExamInput {
  title?: string;
  description?: string;
  durationMinutes?: number;
  totalMarks?: number;
  passMark?: number;
  passingMarks?: number;
  isFree?: boolean;
  cohortId?: string | null;
  sprintId?: string | null;
  status?: ExamStatus;
  questions?: IQuestionInput[];
}

export interface IAddQuestionInput {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
  marks?: number;
}

export interface IBulkAddQuestionsInput {
  questions: IAddQuestionInput[];
}

export interface ISubmitAnswerItem {
  questionId: string;
  selectedOption: number;
}

export interface ISubmitExamInput {
  answers: ISubmitAnswerItem[];
}

export interface IExamFilterOptions {
  isFree?: boolean;
  cohortId?: string;
  sprintId?: string;
  status?: ExamStatus;
  page?: number;
  limit?: number;
}
