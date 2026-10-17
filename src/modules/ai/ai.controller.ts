import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { aiService } from "./ai.service.js";

// AI Chatbot Assistant Controller
const chatWithAssistantHandler = catchAsync(
  async (req: Request, res: Response) => {
    const result = await aiService.chatWithAssistant(req.body);
    sendSuccess(res, "AI response generated successfully", result);
  }
);

// AI Smart Matcher Controller
const matchMentorsAndCohortsHandler = catchAsync(
  async (req: Request, res: Response) => {
    const result = await aiService.matchMentorsAndCohorts(req.body);
    sendSuccess(res, "Matches found successfully", result);
  }
);

// AI Code Review Pre-Scan Controller
const scanCodeSnippetHandler = catchAsync(
  async (req: Request, res: Response) => {
    const result = await aiService.scanCodeSnippet(req.body);
    sendSuccess(res, "Code scanned successfully", result);
  }
);

export const aiController = {
  chatWithAssistantHandler,
  matchMentorsAndCohortsHandler,
  scanCodeSnippetHandler,
};


