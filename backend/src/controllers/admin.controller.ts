import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import { userPlans } from "../models/user.js";
import type { QuizSummary } from "../models/quiz.js";
import {
  type AdminUser,
  listUsers,
  updateUserByAdmin,
} from "../services/admin.service.js";
import { listQuizzes } from "../services/quiz.service.js";

const userIdSchema = z.uuid("ID de usuário inválido.");
const updateUserSchema = z
  .object({
    plan: z.enum(userPlans).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualização.",
  });

export async function users(
  request: Request,
  response: Response<ApiResponse<AdminUser[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const plan = parseOptionalPlan(request.query.plan);
    const isActive = parseOptionalBoolean(request.query.status);
    const data = await listUsers({ plan, isActive });

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  request: Request,
  response: Response<ApiResponse<AdminUser>>,
  next: NextFunction,
): Promise<void> {
  try {
    if (!request.user) {
      throw new AppError("Usuário não autenticado.", 401);
    }

    const id = parse(userIdSchema, request.params.id);
    const input = parse(updateUserSchema, request.body);
    const data = await updateUserByAdmin(request.user.id, id, input);

    response.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function userQuizzes(
  request: Request,
  response: Response<ApiResponse<QuizSummary[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    if (!request.user) {
      throw new AppError("Usuário não autenticado.", 401);
    }

    const userId = parse(userIdSchema, request.params.id);
    const quizzes = await listQuizzes(request.user, { userId });

    response.status(200).json({ success: true, data: quizzes });
  } catch (error) {
    next(error);
  }
}

function parseOptionalPlan(value: unknown) {
  if (value === undefined || value === "") {
    return undefined;
  }

  return parse(z.enum(userPlans), value);
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === "" || value === "all") {
    return undefined;
  }

  if (value === "active") {
    return true;
  }

  if (value === "inactive") {
    return false;
  }

  throw new AppError("Filtro de status inválido.", 400);
}

function parse<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  return result.data;
}
