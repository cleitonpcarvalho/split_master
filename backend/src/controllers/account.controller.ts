import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import type { PublicUser } from "../models/user.js";
import {
  updatePassword,
  updateProfile,
} from "../services/account.service.js";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email("Informe um e-mail válido.").max(255),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export async function profile(
  request: Request,
  response: Response<ApiResponse<PublicUser>>,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(request);
    const input = parse(profileSchema, request.body);
    const user = await updateProfile(userId, input);

    response.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function password(
  request: Request,
  response: Response<ApiResponse<{ updated: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUserId(request);
    const input = parse(passwordSchema, request.body);
    await updatePassword(userId, input.currentPassword, input.newPassword);

    response.status(200).json({
      success: true,
      data: { updated: true },
    });
  } catch (error) {
    next(error);
  }
}

function requireUserId(request: Request): string {
  if (!request.user) {
    throw new AppError("Usuário não autenticado.", 401);
  }

  return request.user.id;
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
