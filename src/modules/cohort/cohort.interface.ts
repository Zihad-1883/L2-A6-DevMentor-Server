export interface ICreateCohortInput {
  title: string;
  description: string;
  durationWeeks: number;
  capacity: number;
  totalCost: number;
  techStackTags: string[];
}

export interface IUpdateCohortInput {
  title?: string;
  description?: string;
  durationWeeks?: number;
  capacity?: number;
  totalCost?: number;
  techStackTags?: string[];
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export interface ICohortQueryFilters {
  search?: string;
  tag?: string;
  page?: number | string;
  limit?: number | string;
}

