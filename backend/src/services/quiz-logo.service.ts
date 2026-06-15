import { extname } from "node:path";

import { env } from "../config/env.js";
import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../models/app-error.js";
import type { QuizSummary } from "../models/quiz.js";
import type { AuthenticatedRequestUser } from "../models/user.js";
import {
  findAccessibleQuiz,
  updateQuiz,
} from "./quiz.service.js";

export async function uploadQuizLogo(
  user: AuthenticatedRequestUser,
  quizId: string,
  file: Express.Multer.File,
): Promise<QuizSummary> {
  const quiz = await findAccessibleQuiz(user, quizId);
  const extension = getSafeExtension(file);
  const path = `${quiz.user_id}/${quiz.id}/logo-${Date.now()}${extension}`;
  const bucket = supabaseAdmin.storage.from(env.supabaseStorageBucket);
  const { error: uploadError } = await bucket.upload(path, file.buffer, {
    contentType: file.mimetype,
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    throw new AppError(`Não foi possível enviar a logo: ${uploadError.message}`);
  }

  const { data: publicUrlData } = bucket.getPublicUrl(path);
  const previousPath =
    typeof quiz.settings.logoPath === "string"
      ? quiz.settings.logoPath
      : null;

  try {
    const updated = await updateQuiz(user, quizId, {
      settings: {
        ...quiz.settings,
        logoPath: path,
        logoUrl: publicUrlData.publicUrl,
      },
    });

    if (previousPath && previousPath !== path) {
      await bucket.remove([previousPath]);
    }

    return updated;
  } catch (error) {
    await bucket.remove([path]);
    throw error;
  }
}

function getSafeExtension(file: Express.Multer.File): string {
  const byMime: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };

  return byMime[file.mimetype] ?? extname(file.originalname).toLowerCase();
}
