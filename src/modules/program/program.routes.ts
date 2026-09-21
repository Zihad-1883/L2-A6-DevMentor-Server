import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { programController } from "./program.controller.js";
import {
  createProgramSchema,
  updateProgramSchema,
  queryProgramsSchema,
} from "./program.validation.js";

const router = Router();

// Public: List/search programs
router.get(
  "/",
  validate(queryProgramsSchema, "query"),
  programController.getPrograms,
);

// Mentor: Get logged-in mentor's programs
router.get(
  "/my-programs",
  requireAuth,
  requireRole("mentor"),
  programController.getMentorPrograms,
);

// Public: Get program details by ID
router.get(
  "/:id",
  programController.getProgramById,
);

// Mentor: Create a new program
router.post(
  "/",
  requireAuth,
  requireRole("mentor"),
  validate(createProgramSchema),
  programController.createProgram,
);

// Mentor: Update a program
router.patch(
  "/:id",
  requireAuth,
  requireRole("mentor"),
  validate(updateProgramSchema),
  programController.updateProgram,
);

// Mentor: Delete a program (Soft Delete)
router.delete(
  "/:id",
  requireAuth,
  requireRole("mentor"),
  programController.deleteProgram,
);

export default router;
