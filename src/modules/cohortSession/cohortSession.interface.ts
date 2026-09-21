export interface ICohortResourceItem {
  id?: string;
  title: string;
  type: "FILE" | "LINK" | "NOTE" | "CODE_SNIPPET";
  url?: string;
  publicId?: string;
  fileSize?: number;
  fileType?: string;
  content?: string;
  createdAt?: string;
}

export interface ICreateCohortSessionInput {
  sessionNumber: number;
  dayNumber: number;
  title: string;
  scheduledAt: string | Date;
  durationMinutes?: number;
  creditCost: number;
  joinLink?: string;
  resources?: ICohortResourceItem[];
}

export interface IUpdateCohortSessionInput {
  sessionNumber?: number;
  dayNumber?: number;
  title?: string;
  scheduledAt?: string | Date;
  durationMinutes?: number;
  creditCost?: number;
  joinLink?: string;
  resources?: ICohortResourceItem[];
}

