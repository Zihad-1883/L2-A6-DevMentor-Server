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

export interface ICohortAdminQueryFilters {
  approvalStatus?: string;
  status?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface IRevenueMonthlyDataPoint {
  month: string;
  grossRevenue: number;
  platformCommission: number;
  mentorPayouts: number;
}

export interface IPlatformOverviewStats {
  totalUsers: number;
  totalStudents: number;
  totalMentors: number;
  pendingMentorApplications: number;
  totalCohorts: number;
  pendingCohorts: number;
  totalRevenueBdt: number;
  platformCommissionEarnedBdt: number;
  totalCreditsCirculating: number;
  monthlyRevenue: IRevenueMonthlyDataPoint[];
}

