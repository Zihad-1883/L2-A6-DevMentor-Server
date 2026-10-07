import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { mentorController } from "./mentor.controller.js";
import { applyMentorSchema } from "./mentor.validation.js";

const router = Router();

// Public Approved Mentors Directory Routes
router.get("/", mentorController.getApprovedMentors);
router.get("/:id", mentorController.getMentorById);

// Student Application Route
router.post(
  "/apply",
  requireAuth,
  validate(applyMentorSchema),
  mentorController.applyForMentor,
);

export default router;

