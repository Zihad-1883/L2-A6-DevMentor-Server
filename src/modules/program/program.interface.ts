/**
 * @file src/modules/program/program.interface.ts
 * @description Type definitions & interfaces for Program domain logic.
 */

export interface ICreateProgramInput {
  title: string;
  description: string;
  durationWeeks: number;
  techStackTags: string[];
}

export interface IUpdateProgramInput {
  title?: string;
  description?: string;
  durationWeeks?: number;
  techStackTags?: string[];
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export interface IProgramQueryFilters {
  search?: string;
  tag?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  mentorId?: string;
  page?: number;
  limit?: number;
}
