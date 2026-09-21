export interface CreateCohortSessionInput {
    sessionNumber: number;
    dayNumber: number;
    title: string;
    scheduledAt: string;
    durationMinutes?: number;
    creditCost: number;
    joinLink?: string;
    resources?: unknown;
}
