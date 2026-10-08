import multer from "multer";
import { AppError } from "../utils/apiError.js";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
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
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "text/plain",
      "text/x-patch",
      "text/x-diff",
      "text/javascript",
      "text/typescript",
      "application/json",
    ];

    const allowedExtensions = [
      ".jpg", ".jpeg", ".png", ".webp", ".gif",
      ".pdf", ".doc", ".docx",
      ".diff", ".patch", ".txt", ".md",
      ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".go", ".rs", ".json", ".zip"
    ];

    const fileName = (file.originalname || "").toLowerCase();
    const isExtensionMatch = allowedExtensions.some((ext) => fileName.endsWith(ext));
    const isMimeMatch = allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith("text/");

    if (isMimeMatch || isExtensionMatch) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `Invalid file format '${file.mimetype}'. Only images, documents, git diff/patches (.diff, .patch), source code files, and archives are allowed.`,
          400
        ) as unknown as null,
        false
      );
    }
  },
});
