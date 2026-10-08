export type PayoutMethod = "BKASH" | "NAGAD" | "BANK";
export type PayoutStatusType = "PENDING" | "PROCESSED" | "REJECTED";

export interface ICreatePayoutRequestInput {
  amountBdt: number;
  method?: PayoutMethod;
  accountNumber: string;
}

export interface IProcessPayoutInput {
  status: "PROCESSED" | "REJECTED";
  rejectionReason?: string;
}

export interface IPayoutQueryFilters {
  status?: PayoutStatusType;
  page?: number;
  limit?: number;
}
