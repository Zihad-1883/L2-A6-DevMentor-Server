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

export const aiController = {
  chatWithAssistantHandler,
};
