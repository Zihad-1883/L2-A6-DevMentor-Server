export type AiProvider = "gemini" | "groq" | "fallback";

// 1. AI Chatbot Interfaces
export interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface ChatResponse {
  answer: string;
  suggestedPrompts: string[];
  providerUsed: AiProvider;
}

// 2. AI Smart Matcher Interfaces
export interface MatchedMentor {
  id: string;
  name: string;
  bio?: string | null;
  experienceLevel: string;
  techStackTags: string[];
  matchScore: number; // e.g. 96 (%)
  matchReason: string;
  avatarUrl?: string | null;
}

export interface MatchedCohort {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  techStackTags: string[];
  totalCost: number;
  matchScore: number; // e.g. 92 (%)
  matchReason: string;
}

export interface RawMatchOutput {
  analysisSummary: string;
  recommendedMentors: {
    id: string;
    matchScore: number;
    matchReason: string;
  }[];
  recommendedCohorts: {
    id: string;
    matchScore: number;
    matchReason: string;
  }[];
}

export interface MatchResultResponse {
  analysisSummary: string;
  recommendedMentors: MatchedMentor[];
  recommendedCohorts: MatchedCohort[];
  providerUsed: AiProvider;
}

// 3. AI Code Review Pre-Scan Interfaces
export interface CodeIssueFinding {
  severity: "critical" | "warning" | "suggestion";
  title: string;
  description: string;
  lineRange?: string;
}

export interface CodeScanResponse {
  language: string;
  complexitySummary: {
    timeComplexity: string;
    spaceComplexity: string;
    maintainabilityScore: number; // 1-100
  };
  findings: CodeIssueFinding[];
  suggestedMentorFocus: string[];
  providerUsed: AiProvider;
}
