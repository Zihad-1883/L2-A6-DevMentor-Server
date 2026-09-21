import multer from "multer";
import { AppError } from "../utils/apiError.js";

// Set up Multer memory storage with 10MB file limit and allowed formats
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`Invalid file format '${file.mimetype}'. Only images and documents (PDF/DOC) are allowed.`, 400) as unknown as null, false);
    }
  },
});