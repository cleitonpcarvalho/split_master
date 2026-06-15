import type { RequestHandler } from "express";
import multer from "multer";

import { AppError } from "../models/app-error.js";

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new AppError("Envie uma imagem PNG, JPG, WEBP ou SVG.", 400),
      );
      return;
    }

    callback(null, true);
  },
});

function uploadImage(fieldName: string, label: string): RequestHandler {
  return (request, response, next) => {
    upload.single(fieldName)(request, response, (error) => {
      if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
      ) {
        next(new AppError(`${label} deve ter no máximo 5 MB.`, 400));
        return;
      }

      next(error);
    });
  };
}

export const uploadQuizLogoFile = uploadImage("logo", "A logo");
export const uploadFinalPageImageFile = uploadImage("image", "A imagem");
