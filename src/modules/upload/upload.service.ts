/**
 * @file src/modules/upload/upload.service.ts
 * @description Cloudinary buffer upload stream service.
 */

import { cloudinary } from "../../lib/cloudinary.js";
import { AppError } from "../../utils/apiError.js";

interface IUploadResponse {
  url: string;
  public_id: string;
  format: string;
  bytes: number;
}

const uploadFileToCloudinary = async (
  file: Express.Multer.File,
  folderName = "devmentor_uploads",
): Promise<IUploadResponse> => {
  if (!file || !file.buffer) {
    throw new AppError("No file provided for upload", 400);
  }

  return new Promise((resolve, reject) => {
    // 15-second timeout guard for Cloudinary network connection
    const timeout = setTimeout(() => {
      reject(new AppError("Cloudinary upload request timed out. Please try again.", 504));
    }, 15000);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: "auto",
        access_mode: "public",
      },
      (error, result) => {
        clearTimeout(timeout);

        if (error || !result) {
          return reject(new AppError(`Cloudinary upload failed: ${error?.message || "Unknown error"}`, 500));
        }

        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    uploadStream.end(file.buffer);
  });
};

const uploadMultipleFilesToCloudinary = async (
  files: Express.Multer.File[],
  folderName = "devmentor_uploads",
): Promise<IUploadResponse[]> => {
  if (!files || files.length === 0) {
    throw new AppError("No files provided for upload", 400);
  }

  // Upload all files in parallel to Cloudinary
  const uploadPromises = files.map((file) => uploadFileToCloudinary(file, folderName));
  return Promise.all(uploadPromises);
};

export const uploadService = {
  uploadFileToCloudinary,
  uploadMultipleFilesToCloudinary,
};
