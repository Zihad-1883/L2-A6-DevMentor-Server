import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { userController } from "./user.controller.js";
import { updateUserProfileSchema } from "./user.validation.js";

const router = Router();

// All user routes require authentication
router.use(requireAuth);

router.get("/me", userController.getMyProfile);
router.patch("/me", validate(updateUserProfileSchema), userController.updateMyProfile);
router.get("/me/dashboard", userController.getMyDashboard);

export default router;

