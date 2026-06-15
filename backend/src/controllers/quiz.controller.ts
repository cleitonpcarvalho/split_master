import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../models/app-error.js";
import type { ApiResponse } from "../models/api-response.js";
import { quizStatuses, type QuizSummary } from "../models/quiz.js";
import {
  createQuiz,
  deleteQuiz,
  duplicateQuiz,
  getQuiz,
  listQuizzes,
  updateQuiz,
} from "../services/quiz.service.js";

const quizIdSchema = z.uuid("ID de quiz inválido.");
const createQuizSchema = z.object({
  title: z.string().trim().min(2).max(160),
  settings: z.record(z.string(), z.unknown()).optional(),
});
const updateQuizSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use apenas letras minúsculas, números e hífens no slug.",
      )
      .optional(),
    status: z.enum(quizStatuses).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    subdomain: z
      .string()
      .trim()
      .min(3)
      .max(63)
      .regex(
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
        "Informe um subdomínio válido.",
      )
      .nullable()
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe pelo menos um campo para atualização.",
  });

export async function index(
  request: Request,
  response: Response<ApiResponse<QuizSummary[]>>,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(request);
    const status = parseOptionalStatus(request.query.status);
    const userId =
      user.role === "admin" ? parseOptionalUuid(request.query.userId) : undefined;
    const quizzes = await listQuizzes(user, { status, userId });

    response.status(200).json({ success: true, data: quizzes });
  } catch (error) {
    next(error);
  }
}

export async function store(
  request: Request,
  response: Response<ApiResponse<QuizSummary>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(createQuizSchema, request.body);
    const quiz = await createQuiz(requireUser(request), input);

    response.status(201).json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
}

export async function show(
  request: Request,
  response: Response<ApiResponse<QuizSummary>>,
  next: NextFunction,
): Promise<void> {
  try {
    const quiz = await getQuiz(requireUser(request), parseId(request.params.id));

    response.status(200).json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
}

export async function update(
  request: Request,
  response: Response<ApiResponse<QuizSummary>>,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parse(updateQuizSchema, request.body);
    const quiz = await updateQuiz(
      requireUser(request),
      parseId(request.params.id),
      input,
    );

    response.status(200).json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
}

export async function destroy(
  request: Request,
  response: Response<ApiResponse<{ deleted: true }>>,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteQuiz(requireUser(request), parseId(request.params.id));

    response.status(200).json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
}

export async function duplicate(
  request: Request,
  response: Response<ApiResponse<QuizSummary>>,
  next: NextFunction,
): Promise<void> {
  try {
    const quiz = await duplicateQuiz(
      requireUser(request),
      parseId(request.params.id),
    );

    response.status(201).json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
}

function requireUser(request: Request) {
  if (!request.user) {
    throw new AppError("Usuário não autenticado.", 401);
  }

  return request.user;
}

function parseId(value: unknown): string {
  return parse(quizIdSchema, value);
}

function parseOptionalStatus(value: unknown) {
  if (value === undefined || value === "") {
    return undefined;
  }

  return parse(z.enum(quizStatuses), value);
}

function parseOptionalUuid(value: unknown): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return parse(z.uuid("ID de usuário inválido."), value);
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
