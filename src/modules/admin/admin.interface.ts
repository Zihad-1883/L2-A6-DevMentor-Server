/**
 * @file src/modules/admin/admin.interface.ts
 * @description Interfaces for admin moderation and user management payloads.
 */

export interface IUserQueryFilters {
  search?: string;
  role?: string;
  isBlocked?: boolean | string;
  page?: number | string;
  limit?: number | string;
}

export interface IApproveMentorInput {
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}

export interface IApproveCohortInput {
  status: "APPROVED" | "REJECTED";
}

export interface IToggleUserBlockInput {
  isBlocked: boolean;
}
