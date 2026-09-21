/**
 * @file src/modules/mentor/mentor.interface.ts
 * @description Type definitions for Mentor application & directory query payloads.
 */

export interface IApplyMentorInput {
  bio: string;
  techStackTags: string[];
  experienceLevel?: "JUNIOR" | "MID" | "SENIOR";
  githubUrl?: string;
  resumeUrl: string;
}

export interface IMentorQueryFilters {
  search?: string;
  tag?: string;
  experienceLevel?: "JUNIOR" | "MID" | "SENIOR";
  page?: number | string;
  limit?: number | string;
}
