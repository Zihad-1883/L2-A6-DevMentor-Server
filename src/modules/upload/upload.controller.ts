/**
 * @file src/modules/upload/upload.controller.ts
 * @description HTTP controller for single file upload to Cloudinary.
 */

import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/apiError.js";
import { uploadService } from "./upload.service.js";

const handleFileUpload = catchAsync(async (req: Request, res: Response) => {
  // Handle multiple files array (e.g. from req.files)
  if (Array.isArray(req.files) && req.files.length > 0) {
    const results = await uploadService.uploadMultipleFilesToCloudinary(req.files as Express.Multer.File[]);
    sendSuccess(res, `${results.length} file(s) uploaded to Cloudinary successfully`, results, 201);
    return;
  }

  // Handle single file (e.g. from req.file)
  const singleFile = req.file || (Array.isArray(req.files) ? req.files[0] : undefined);

  if (!singleFile) {
    throw new AppError("Please attach file(s) in form-data key 'file' or 'files'", 400);
  }

  const result = await uploadService.uploadFileToCloudinary(singleFile);
  sendSuccess(res, "File uploaded to Cloudinary successfully", result, 201);
});

export const uploadController = {
  handleFileUpload,
};
