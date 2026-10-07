import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { upload } from "../../lib/multer.js";
import { uploadController } from "./upload.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", upload.any(), uploadController.handleFileUpload);

export default router;
