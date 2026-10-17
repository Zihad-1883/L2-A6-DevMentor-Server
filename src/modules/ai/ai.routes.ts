import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { chatSchema, matchSchema } from "./ai.validation.js";
import { aiController } from "./ai.controller.js";

const router = Router();

// POST /api/v1/ai/chat - Open to both authenticated users & visitors
router.post(
  "/chat",
  validate(chatSchema, "body"),
  aiController.chatWithAssistantHandler
);

// POST /api/v1/ai/match - AI Smart Mentor & Cohort Matcher
router.post(
  "/match",
  validate(matchSchema, "body"),
  aiController.matchMentorsAndCohortsHandler
);


export default router;
