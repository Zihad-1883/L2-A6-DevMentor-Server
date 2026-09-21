export interface ICreateCohortInput {
  title: string;
  description: string;
  durationWeeks: number;
  capacity: number;
  techStackTags: string[];
}

export interface IUpdateCohortInput {
  title?: string;
  description?: string;
  durationWeeks?: number;
  capacity?: number;
  techStackTags?: string[];
}

export interface ICohortQueryFilters {
  search?: string;
  tag?: string;
  page?: number | string;
  limit?: number | string;
}

