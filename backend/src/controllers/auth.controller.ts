import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import type { PublicUser, UserRole } from "../models/user.js";
import {
  getUserById,
  loginUser,
  registerUser,
  type AuthResult,
} from "../services/auth.service.js";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(120, "O nome deve ter no máximo 120 caracteres."),
  email: z.email("Informe um e-mail válido.").max(255),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(72, "A senha deve ter no máximo 72 caracteres."),
  role: z.enum(["admin", "client"]).default("client"),
});

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").max(255),
  password: z.string().min(1, "Informe sua senha.").max(72),
});

export async function register(
  request: Request,
  response: Response<ApiResponse<AuthResult>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseBody(registerSchema, request.body);
    validateAdminBootstrap(input.role, request.header("x-admin-bootstrap"));

    const result = await registerUser(input);

    response.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(
  request: Request,
  response: Response<ApiResponse<AuthResult>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseBody(loginSchema, request.body);
    const result = await loginUser(input);

    response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function me(
  request: Request,
  response: Response<ApiResponse<PublicUser>>,
  next: NextFunction,
): Promise<void> {
  try {
    if (!request.user) {
      throw new AppError("Usuário não autenticado.", 401);
    }

    const user = await getUserById(request.user.id);

    response.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

function validateAdminBootstrap(
  role: UserRole,
  bootstrapSecret: string | undefined,
): void {
  if (role !== "admin") {
    return;
  }

  if (bootstrapSecret !== env.adminBootstrapSecret) {
    throw new AppError(
      "O cadastro de administradores exige autorização de bootstrap.",
      403,
    );
  }
}

function parseBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Dados inválidos.", 400);
  }

  return result.data;
}
