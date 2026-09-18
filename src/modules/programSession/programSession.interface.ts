/**
 * @file src/modules/programSession/programSession.interface.ts
 * @description Type definitions for Program Session domain operations.
 */

export interface ICreateSessionInput {
  title?: string;
  sessionNumber?: number;
  weekNumber: number;
  priceInCredits: number;
  scheduledAt?: Date | string;
  durationMinutes?: number;
  joinLink?: string;
}

export interface IUpdateSessionInput {
  title?: string;
  sessionNumber?: number;
  weekNumber?: number;
  priceInCredits?: number;
  scheduledAt?: Date | string;
  durationMinutes?: number;
  joinLink?: string;
}

export interface IBookSessionInput {
  scheduledAt: string | Date;
  durationMinutes?: number;
  joinLink?: string;
}
