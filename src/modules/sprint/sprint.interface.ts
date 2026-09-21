import { SprintStatus } from "../../generated/prisma/enums";


export interface ICreateSprintInput {
  title: string;
  description: string;
  techStackTags: string[];
  startDate: string;
  durationDays: number;
  selectedDays: number[];
}

export interface IUpdateSprintInput {
  title?: string;
  description?: string;
  techStackTags?: string[];
  startDate?: string;
  durationDays?: number;
  selectedDays?: number[];
}

export interface ISprintQueryFilters {
  search?: string;
  tag?: string;
  page?: number;
  limit?: number;
  status?: SprintStatus;
}
