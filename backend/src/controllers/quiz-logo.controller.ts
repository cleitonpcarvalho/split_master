import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import type { QuizSummary } from "../models/quiz.js";
import { uploadQuizLogo } from "../services/quiz-logo.service.js";

export async function logoUpload(
  request: Request,
  response: Response<ApiResponse<QuizSummary>>,
  next: NextFunction,
): Promise<void> {
  try {
    if (!request.user) {
      throw new AppError("Usuário não autenticado.", 401);
    }
    if (!request.file) {
      throw new AppError("Selecione uma imagem para a logo.", 400);
    }

    const idResult = z.uuid("ID de quiz inválido.").safeParse(request.params.id);

    if (!idResult.success) {
      throw new AppError(idResult.error.issues[0]?.message ?? "ID inválido.", 400);
    }

    const data = await uploadQuizLogo(request.user, idResult.data, request.file);
    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
