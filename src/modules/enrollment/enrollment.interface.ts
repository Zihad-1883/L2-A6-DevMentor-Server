/**
 * @file src/modules/enrollment/enrollment.interface.ts
 * @description Interfaces for student enrollment queries.
 */

export interface IEnrollmentQueryFilters {
  status?: string;
  page?: number | string;
  limit?: number | string;
}
