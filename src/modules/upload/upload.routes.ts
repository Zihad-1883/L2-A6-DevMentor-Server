/**
 * @file src/modules/upload/upload.routes.ts
 * @description Express routes for file upload using Multer and Cloudinary.
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { upload } from "../../lib/multer.js";
import { uploadController } from "./upload.controller.js";

const router = Router();

// All upload endpoints require authentication
router.use(requireAuth);

router.post("/", upload.any(), uploadController.handleFileUpload);

export default router;
