import { v2 as Cloudinary } from "cloudinary";
import { env } from "../config/env.js";

Cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const cloudinary = Cloudinary;
